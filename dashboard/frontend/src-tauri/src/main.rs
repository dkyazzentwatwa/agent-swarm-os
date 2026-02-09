#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Utc};
use notify::{Config as NotifyConfig, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tokio::process::Command;
use url::Url;
use walkdir::WalkDir;

use commands::AllowedCommand;

const DEFAULT_TEAM_NAME: &str = "agent-squad-team";
const DEFAULT_COMMS_FILE: &str = "~/.claude/teams/{teamName}/team-feed.jsonl";
const DEFAULT_SUMMARY_FILE: &str = "artifacts/summary/summary.md";
const FALLBACK_SUMMARY_KEYWORDS: [&str; 7] = [
    "summary",
    "final",
    "overview",
    "handoff",
    "report",
    "executive",
    "brief",
];

#[derive(Debug, Clone)]
struct AppConfig {
    project_root: PathBuf,
    team_name: String,
    workspaces_dir: PathBuf,
    teams_dir: PathBuf,
    tasks_dir: PathBuf,
    sample_data_dir: PathBuf,
    demo_mode: bool,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    team_name: Option<String>,
    workspaces_dir: Option<String>,
    teams_dir: Option<String>,
    tasks_dir: Option<String>,
    preferred_template: Option<String>,
    default_agents: Option<u8>,
    teammate_mode: Option<String>,
    claude_agent_teams_env: Option<bool>,
    kickoff_command: Option<String>,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
struct LastChanged {
    teams: u64,
    tasks: u64,
    workspaces: u64,
}

#[derive(Clone)]
struct AppState {
    config: Arc<AppConfig>,
    settings: Arc<Mutex<AppSettings>>,
    last_changed: Arc<Mutex<LastChanged>>,
    watchers: Arc<Mutex<Vec<RecommendedWatcher>>>,
}

#[derive(Debug, Clone)]
struct WorkspaceEntry {
    id: String,
    workspace_path: PathBuf,
    manifest_path: PathBuf,
    mtime: u64,
}

#[derive(Debug, Clone)]
struct WorkspaceContext {
    workspace_id: String,
    workspace_path: PathBuf,
    manifest: Value,
}

#[derive(Debug, Clone)]
struct CommsOptions {
    workspace_id: Option<String>,
    allow_unscoped_fallback: bool,
    fallback_workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitWorkspaceRequest {
    topic: String,
    agents: Option<u8>,
    template: Option<String>,
    team_name: Option<String>,
    quick: Option<bool>,
    dry_run: Option<bool>,
    agent_roles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SaveAppSettingsRequest {
    team_name: Option<String>,
    workspaces_dir: Option<String>,
    teams_dir: Option<String>,
    tasks_dir: Option<String>,
    preferred_template: Option<String>,
    default_agents: Option<u8>,
    teammate_mode: Option<String>,
    claude_agent_teams_env: Option<bool>,
    kickoff_command: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn system_time_to_ms(value: Option<SystemTime>) -> u64 {
    value
        .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn to_iso_from_ms(ms: u64) -> Option<String> {
    if ms == 0 {
        return None;
    }

    let secs = (ms / 1_000) as i64;
    let nanos = ((ms % 1_000) * 1_000_000) as u32;
    DateTime::<Utc>::from_timestamp(secs, nanos).map(|dt| dt.to_rfc3339())
}

fn format_iso(value: SystemTime) -> Option<String> {
    let ms = system_time_to_ms(Some(value));
    to_iso_from_ms(ms)
}

fn normalize_slashes(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn clean_optional_string(value: Option<String>) -> Option<String> {
    value.map(|entry| entry.trim().to_string()).filter(|entry| !entry.is_empty())
}

fn expand_user_path(raw: &str) -> PathBuf {
    let trimmed = raw.trim();
    if trimmed == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    }

    if let Some(rest) = trimmed.strip_prefix("~/") {
        return dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(rest);
    }

    PathBuf::from(trimmed)
}

fn normalize_workspace_id(value: Option<&str>) -> Option<String> {
    let raw = value?.trim();
    if raw.is_empty() {
        return None;
    }

    if let Some((_, rest)) = raw.split_once("workspaces/") {
        let id = rest.split('/').next().unwrap_or_default().trim();
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }

    let cleaned = raw.trim_start_matches("./").trim_end_matches('/');
    if cleaned.is_empty() {
        return None;
    }

    if cleaned.contains('/') {
        return cleaned
            .split('/')
            .filter(|part| !part.is_empty())
            .last()
            .map(|part| part.to_string());
    }

    Some(cleaned.to_string())
}

fn normalize_status(status: Option<&str>) -> String {
    let lower = status.unwrap_or("pending").trim().to_lowercase();
    match lower.as_str() {
        "done" | "complete" | "finished" => "completed".to_string(),
        "active" | "running" | "in-progress" => "in_progress".to_string(),
        "blocked" | "waiting" => "blocked".to_string(),
        "todo" | "to-do" | "open" => "pending".to_string(),
        _ => {
            if lower.is_empty() {
                "pending".to_string()
            } else {
                lower
            }
        }
    }
}

fn get_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn get_path_string(root: &Value, path: &[&str]) -> Option<String> {
    let mut cursor = root;
    for segment in path {
        cursor = cursor.get(*segment)?;
    }
    get_string(Some(cursor))
}

fn read_json_file(path: &Path) -> Option<Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&content).ok()
}

fn validate_manifest(manifest: &Value) -> bool {
    manifest.get("workspace").and_then(|v| v.get("id")).is_some()
        && manifest.get("team").and_then(|v| v.get("name")).is_some()
        && manifest.get("agents").and_then(|v| v.as_array()).is_some()
        && manifest.get("groups").and_then(|v| v.as_array()).is_some()
        && manifest.get("modules").and_then(|v| v.as_array()).is_some()
        && manifest
            .get("workflowLanes")
            .and_then(|v| v.as_array())
            .is_some()
}

fn locate_project_root() -> PathBuf {
    if let Ok(value) = env::var("AGENT_SQUAD_PROJECT_ROOT") {
        let candidate = PathBuf::from(value);
        if candidate.exists() {
            return candidate;
        }
    }

    let mut current = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    loop {
        let has_scripts = current.join("scripts/init-workflow.js").exists();
        let has_templates = current.join("templates/agent-squad").exists();
        let has_dashboard = current.join("dashboard/frontend/src").exists();

        if has_scripts && has_templates && has_dashboard {
            return current;
        }

        if !current.pop() {
            break;
        }
    }

    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn build_config() -> AppConfig {
    let project_root = locate_project_root();
    let team_name = env::var("TEAM_NAME").unwrap_or_else(|_| DEFAULT_TEAM_NAME.to_string());

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let workspaces_dir = env::var("WORKSPACES_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| project_root.join("workspaces"));
    let teams_dir = env::var("TEAMS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join(".claude/teams").join(&team_name));
    let tasks_dir = env::var("TASKS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join(".claude/todos"));

    let sample_data_dir = project_root.join("dashboard/backend/sample-data");
    let demo_mode = env::var("DEMO_MODE")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false);

    AppConfig {
        project_root,
        team_name,
        workspaces_dir,
        teams_dir,
        tasks_dir,
        sample_data_dir,
        demo_mode,
    }
}

fn settings_file_path(config: &AppConfig) -> PathBuf {
    config.project_root.join(".agentsquad.desktop-settings.json")
}


fn load_app_settings(config: &AppConfig) -> AppSettings {
    let path = settings_file_path(config);
    if !path.exists() {
        return AppSettings::default();
    }

    let content = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(_) => return AppSettings::default(),
    };

    serde_json::from_str::<AppSettings>(&content).unwrap_or_default()
}

fn persist_app_settings(config: &AppConfig, settings: &AppSettings) -> Result<(), String> {
    let path = settings_file_path(config);
    let payload = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, payload).map_err(|error| error.to_string())
}

fn read_settings(state: &AppState) -> AppSettings {
    state
        .settings
        .lock()
        .map(|value| value.clone())
        .unwrap_or_default()
}

fn resolve_effective_config(base: &AppConfig, settings: &AppSettings) -> AppConfig {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let team_name = clean_optional_string(settings.team_name.clone()).unwrap_or_else(|| base.team_name.clone());
    let workspaces_dir = clean_optional_string(settings.workspaces_dir.clone())
        .map(|value| expand_user_path(&value))
        .unwrap_or_else(|| base.workspaces_dir.clone());

    let teams_dir = clean_optional_string(settings.teams_dir.clone())
        .map(|value| expand_user_path(&value))
        .unwrap_or_else(|| home.join(".claude/teams").join(&team_name));

    let tasks_dir = clean_optional_string(settings.tasks_dir.clone())
        .map(|value| expand_user_path(&value))
        .unwrap_or_else(|| home.join(".claude/todos"));

    AppConfig {
        project_root: base.project_root.clone(),
        team_name,
        workspaces_dir,
        teams_dir,
        tasks_dir,
        sample_data_dir: base.sample_data_dir.clone(),
        demo_mode: base.demo_mode,
    }
}

fn current_config(state: &AppState) -> AppConfig {
    resolve_effective_config(&state.config, &read_settings(state))
}

fn merge_save_settings(request: SaveAppSettingsRequest) -> AppSettings {
    AppSettings {
        team_name: clean_optional_string(request.team_name),
        workspaces_dir: clean_optional_string(request.workspaces_dir),
        teams_dir: clean_optional_string(request.teams_dir),
        tasks_dir: clean_optional_string(request.tasks_dir),
        preferred_template: clean_optional_string(request.preferred_template),
        default_agents: request
            .default_agents
            .and_then(|value| (1..=8).contains(&value).then_some(value)),
        teammate_mode: clean_optional_string(request.teammate_mode),
        claude_agent_teams_env: request.claude_agent_teams_env,
        kickoff_command: clean_optional_string(request.kickoff_command),
    }
}

fn list_workspace_entries(workspaces_dir: &Path) -> Vec<WorkspaceEntry> {
    if !workspaces_dir.exists() {
        return Vec::new();
    }

    let mut out = Vec::new();

    if let Ok(entries) = fs::read_dir(workspaces_dir) {
        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(value) => value,
                Err(_) => continue,
            };
            if !file_type.is_dir() {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();
            if name == "archive" || name.starts_with('.') {
                continue;
            }

            let workspace_path = entry.path();
            let manifest_path = workspace_path.join("workspace.json");
            if !manifest_path.exists() {
                continue;
            }

            let mtime = system_time_to_ms(entry.metadata().ok().and_then(|m| m.modified().ok()));

            out.push(WorkspaceEntry {
                id: name,
                workspace_path,
                manifest_path,
                mtime,
            });
        }
    }

    out.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    out
}

fn get_sample_workspace(sample_data_dir: &Path) -> Option<WorkspaceEntry> {
    let workspace_path = sample_data_dir.join("sample-workspace");
    let manifest_path = workspace_path.join("workspace.json");
    if !manifest_path.exists() {
        return None;
    }

    Some(WorkspaceEntry {
        id: "sample-workspace".to_string(),
        mtime: system_time_to_ms(workspace_path.metadata().ok().and_then(|m| m.modified().ok())),
        workspace_path,
        manifest_path,
    })
}

fn to_workspace_summary(entry: &WorkspaceEntry) -> Option<Value> {
    let manifest = read_json_file(&entry.manifest_path)?;
    if !validate_manifest(&manifest) {
        return None;
    }

    Some(json!({
        "id": entry.id,
        "title": get_path_string(&manifest, &["workspace", "title"]).unwrap_or_else(|| entry.id.clone()),
        "createdAt": get_path_string(&manifest, &["workspace", "createdAt"]),
        "templateId": get_path_string(&manifest, &["workspace", "templateId"]),
        "mtime": entry.mtime,
    }))
}

fn get_workspace_context(config: &AppConfig, requested_workspace_id: Option<&str>) -> Option<WorkspaceContext> {
    if config.demo_mode {
        let sample_workspace = get_sample_workspace(&config.sample_data_dir)?;
        if let Some(requested) = requested_workspace_id {
            if requested != sample_workspace.id {
                return None;
            }
        }

        let manifest = read_json_file(&sample_workspace.manifest_path)?;
        if !validate_manifest(&manifest) {
            return None;
        }

        return Some(WorkspaceContext {
            workspace_id: sample_workspace.id,
            workspace_path: sample_workspace.workspace_path,
            manifest,
        });
    }

    let entries = list_workspace_entries(&config.workspaces_dir);
    if entries.is_empty() {
        return None;
    }

    let selected = if let Some(requested) = requested_workspace_id {
        entries.into_iter().find(|entry| entry.id == requested)?
    } else {
        entries.into_iter().next()?
    };

    let manifest = read_json_file(&selected.manifest_path)?;
    if !validate_manifest(&manifest) {
        return None;
    }

    Some(WorkspaceContext {
        workspace_id: selected.id,
        workspace_path: selected.workspace_path,
        manifest,
    })
}

fn read_synthesis_meta(workspace_path: &Path) -> Option<Value> {
    read_json_file(&workspace_path.join(".agentsquad/synthesis.meta.json"))
}

fn read_blueprint_audit(workspace_path: &Path) -> Value {
    let root = workspace_path.join(".agentsquad");
    json!({
        "request": read_json_file(&root.join("blueprint.request.json")),
        "response": read_json_file(&root.join("blueprint.response.json")),
        "validated": read_json_file(&root.join("blueprint.validated.json")),
        "meta": read_json_file(&root.join("synthesis.meta.json")),
    })
}

fn normalize_task(task: &Value) -> Value {
    let id = get_string(task.get("id").or_else(|| task.get("taskId")));
    let subject = get_string(
        task.get("subject")
            .or_else(|| task.get("title"))
            .or_else(|| task.get("label"))
            .or_else(|| task.get("name")),
    )
    .unwrap_or_else(|| "Untitled".to_string());

    let description = get_string(task.get("description").or_else(|| task.get("body"))).unwrap_or_default();
    let status = normalize_status(get_string(task.get("status").or_else(|| task.get("state"))).as_deref());
    let assignee = get_string(task.get("assignee").or_else(|| task.get("owner")).or_else(|| task.get("agent")));

    let blocked_by = task
        .get("blockedBy")
        .or_else(|| task.get("dependencies"))
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();

    let blocks = task
        .get("blocks")
        .or_else(|| task.get("dependents"))
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();

    json!({
        "id": id,
        "subject": subject,
        "description": description,
        "status": status,
        "assignee": assignee,
        "blockedBy": blocked_by,
        "blocks": blocks,
        "lane": get_string(task.get("lane").or_else(|| task.get("laneId")).or_else(|| task.get("phase"))),
        "createdAt": get_string(task.get("createdAt").or_else(|| task.get("created_at")).or_else(|| task.get("created"))),
        "completedAt": get_string(task.get("completedAt").or_else(|| task.get("completed_at")).or_else(|| task.get("completed"))),
    })
}

fn read_workspace_tasks(workspace_path: &Path) -> Vec<Value> {
    let tasks_path = workspace_path.join("tasks.json");
    let data = match read_json_file(&tasks_path) {
        Some(value) => value,
        None => return Vec::new(),
    };

    let items = if let Some(array) = data.as_array() {
        array.clone()
    } else if let Some(array) = data.get("tasks").and_then(|value| value.as_array()) {
        array.clone()
    } else {
        vec![data]
    };

    items
        .iter()
        .filter(|value| value.is_object())
        .map(normalize_task)
        .collect()
}

fn extract_workspace_id(item: &Value, parent: &Value) -> Option<String> {
    normalize_workspace_id(
        get_string(item.get("workspaceId").or_else(|| item.get("workspace_id")).or_else(|| item.get("workspace")))
            .or_else(|| get_string(parent.get("workspaceId").or_else(|| parent.get("workspace_id")).or_else(|| parent.get("workspace"))))
            .as_deref(),
    )
}

fn read_todos_dir(todos_dir: &Path, selected_workspace_id: Option<&str>) -> Vec<Value> {
    if !todos_dir.exists() {
        return Vec::new();
    }

    let selected = normalize_workspace_id(selected_workspace_id);
    let mut tasks = Vec::new();

    for entry in WalkDir::new(todos_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|item| item.file_type().is_file())
    {
        if entry.path().extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let data = match read_json_file(entry.path()) {
            Some(value) => value,
            None => continue,
        };

        let items = if let Some(array) = data.as_array() {
            array.clone()
        } else if let Some(array) = data.get("tasks").and_then(|value| value.as_array()) {
            array.clone()
        } else {
            vec![data.clone()]
        };

        for item in items {
            if !item.is_object() {
                continue;
            }
            let item_workspace_id = extract_workspace_id(&item, &data);
            if item_workspace_id.is_none() {
                continue;
            }
            if let Some(selected_workspace_id) = &selected {
                if item_workspace_id.as_ref() != Some(selected_workspace_id) {
                    continue;
                }
            }

            let has_identity = item.get("id").is_some()
                || item.get("subject").is_some()
                || item.get("title").is_some()
                || item.get("name").is_some();

            if !has_identity {
                continue;
            }

            tasks.push(normalize_task(&item));
        }
    }

    tasks
}

fn read_tasks(config: &AppConfig, workspace_path: &Path, workspace_id: Option<&str>) -> Vec<Value> {
    let mut tasks = Vec::new();
    tasks.extend(read_workspace_tasks(workspace_path));
    tasks.extend(read_todos_dir(&config.tasks_dir, workspace_id));

    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for task in tasks {
        let id = get_string(task.get("id"));
        if let Some(task_id) = id {
            if seen.contains(&task_id) {
                continue;
            }
            seen.insert(task_id);
        }
        deduped.push(task);
    }

    deduped
}

fn read_sample_tasks(sample_data_dir: &Path) -> Vec<Value> {
    let file = sample_data_dir.join("sample-workspace/tasks.json");
    let parsed = match read_json_file(&file) {
        Some(value) => value,
        None => return Vec::new(),
    };

    let items = if let Some(array) = parsed.as_array() {
        array.clone()
    } else if let Some(array) = parsed.get("tasks").and_then(|value| value.as_array()) {
        array.clone()
    } else {
        Vec::new()
    };

    items.iter().map(normalize_task).collect()
}

fn normalize_entity(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .trim()
        .to_lowercase()
        .replace('_', "-")
        .replace(' ', "-")
}

fn matches_assignee(task: &Value, agent: &Value) -> bool {
    let assignee = normalize_entity(get_string(task.get("assignee")).as_deref());
    if assignee.is_empty() {
        return false;
    }

    let agent_id = normalize_entity(get_string(agent.get("id")).as_deref());
    let agent_name = normalize_entity(get_string(agent.get("displayName")).as_deref());

    assignee == agent_id || assignee == agent_name
}

fn infer_agent_status(agent_tasks: &[Value]) -> (String, Option<String>) {
    for task in agent_tasks {
        if get_string(task.get("status")).as_deref() == Some("in_progress") {
            return (
                "working".to_string(),
                get_string(task.get("subject")).or_else(|| Some("In progress".to_string())),
            );
        }
    }

    let has_blocked = agent_tasks.iter().any(|task| {
        let status = get_string(task.get("status")).unwrap_or_default();
        let blocked_by = task
            .get("blockedBy")
            .and_then(|value| value.as_array())
            .map(|value| !value.is_empty())
            .unwrap_or(false);

        status == "blocked" || (status == "pending" && blocked_by)
    });

    let has_pending = agent_tasks
        .iter()
        .any(|task| get_string(task.get("status")).as_deref() == Some("pending"));

    if has_blocked {
        return ("waiting".to_string(), None);
    }

    if has_pending {
        return ("idle".to_string(), None);
    }

    if !agent_tasks.is_empty()
        && agent_tasks
            .iter()
            .all(|task| get_string(task.get("status")).as_deref() == Some("completed"))
    {
        return ("idle".to_string(), None);
    }

    ("idle".to_string(), None)
}

fn resolve_comms_file(manifest: &Value, team_name: &str) -> PathBuf {
    let template = get_path_string(manifest, &["comms", "file"]).unwrap_or_else(|| DEFAULT_COMMS_FILE.to_string());
    let with_team = template.replace("{teamName}", team_name);

    if with_team.starts_with("~/") {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        return home.join(with_team.trim_start_matches("~/"));
    }

    PathBuf::from(with_team)
}

fn read_workspace_id(raw: &Value) -> Option<String> {
    normalize_workspace_id(
        get_string(raw.get("workspaceId").or_else(|| raw.get("workspace_id")).or_else(|| raw.get("workspace")))
            .as_deref(),
    )
}

fn to_timestamp_millis(raw: Option<&str>) -> Option<i64> {
    let value = raw?;
    let parsed = DateTime::parse_from_rfc3339(value).ok()?;
    Some(parsed.timestamp_millis())
}

fn normalize_message(raw: &Value) -> Value {
    json!({
        "timestamp": get_string(raw.get("timestamp")).unwrap_or_else(|| Utc::now().to_rfc3339()),
        "agent": get_string(raw.get("agent")).unwrap_or_else(|| "system".to_string()),
        "type": get_string(raw.get("type")).unwrap_or_else(|| "update".to_string()),
        "message": get_string(raw.get("message")).unwrap_or_default(),
        "workspaceId": read_workspace_id(raw),
    })
}

fn read_comms_from_file(file_path: &Path, since: Option<&str>, options: CommsOptions) -> Vec<Value> {
    if !file_path.exists() {
        return Vec::new();
    }

    let text = match fs::read_to_string(file_path) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let since_ts = to_timestamp_millis(since);
    let selected_workspace_id = normalize_workspace_id(options.workspace_id.as_deref());
    let fallback_workspace_id = normalize_workspace_id(options.fallback_workspace_id.as_deref())
        .or_else(|| selected_workspace_id.clone());

    let mut out = Vec::new();

    for line in text.lines().filter(|line| !line.trim().is_empty()) {
        let parsed = match serde_json::from_str::<Value>(line) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let mut message = normalize_message(&parsed);
        let message_ts = to_timestamp_millis(get_string(message.get("timestamp")).as_deref());

        if let (Some(since_value), Some(message_value)) = (since_ts, message_ts) {
            if message_value <= since_value {
                continue;
            }
        }

        if let Some(selected_workspace) = &selected_workspace_id {
            let message_workspace = normalize_workspace_id(get_string(message.get("workspaceId")).as_deref());

            if let Some(message_workspace_id) = message_workspace {
                if &message_workspace_id != selected_workspace {
                    continue;
                }
            } else if options.allow_unscoped_fallback
                && fallback_workspace_id.as_deref() == Some(selected_workspace)
            {
                if let Some(object) = message.as_object_mut() {
                    object.insert("workspaceId".to_string(), Value::String(selected_workspace.clone()));
                }
            } else {
                continue;
            }
        }

        if get_string(message.get("message")).unwrap_or_default().is_empty() {
            continue;
        }

        out.push(message);
    }

    out.sort_by(|a, b| {
        let a_ts = to_timestamp_millis(get_string(a.get("timestamp")).as_deref()).unwrap_or_default();
        let b_ts = to_timestamp_millis(get_string(b.get("timestamp")).as_deref()).unwrap_or_default();
        a_ts.cmp(&b_ts)
    });

    out
}

fn read_sample_comms(sample_data_dir: &Path, since: Option<&str>) -> Vec<Value> {
    let sample_path = sample_data_dir.join("sample-comms.jsonl");
    read_comms_from_file(
        &sample_path,
        since,
        CommsOptions {
            workspace_id: None,
            allow_unscoped_fallback: false,
            fallback_workspace_id: None,
        },
    )
}

fn count_workspaces_for_team(workspaces_dir: &Path, target_team_name: &str) -> usize {
    if target_team_name.is_empty() {
        return 0;
    }

    let entries = list_workspace_entries(workspaces_dir);
    let mut count = 0usize;

    for entry in entries {
        let manifest = match read_json_file(&entry.manifest_path) {
            Some(value) => value,
            None => continue,
        };

        let team_name = get_path_string(&manifest, &["team", "name"]).unwrap_or_default();
        if team_name == target_team_name {
            count += 1;
        }
    }

    count
}

fn extension_for_path(relative_path: &str) -> String {
    let ext = Path::new(relative_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if ext.is_empty() {
        "none".to_string()
    } else {
        ext
    }
}

fn collect_module_meta(workspace_path: &Path, module_definition: &Value) -> (Vec<String>, Value) {
    let module_id = get_string(module_definition.get("id")).unwrap_or_default();
    let module_relative_path = get_string(module_definition.get("path"))
        .unwrap_or_else(|| format!("artifacts/{module_id}"));
    let module_path = workspace_path.join(module_relative_path.trim_start_matches('/'));

    if !module_path.exists() {
        return (
            Vec::new(),
            json!({
                "fileCount": 0,
                "folderCount": 0,
                "lastModified": Value::Null,
                "typeBreakdown": {},
                "totalSize": 0,
            }),
        );
    }

    let mut files = Vec::new();
    let mut folders = HashSet::new();
    let mut type_breakdown: HashMap<String, u64> = HashMap::new();
    let mut latest_mtime = 0u64;
    let mut total_size = 0u64;

    for entry in WalkDir::new(&module_path)
        .into_iter()
        .filter_map(Result::ok)
    {
        let relative = match entry.path().strip_prefix(&module_path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        if relative.as_os_str().is_empty() {
            continue;
        }

        if relative
            .components()
            .any(|component| component.as_os_str().to_string_lossy().starts_with('.'))
        {
            continue;
        }

        if entry.file_type().is_dir() {
            folders.insert(normalize_slashes(relative));
            continue;
        }

        if !entry.file_type().is_file() {
            continue;
        }

        let relative_string = normalize_slashes(relative);
        files.push(relative_string.clone());

        let metadata = match entry.metadata() {
            Ok(value) => value,
            Err(_) => continue,
        };

        let modified_ms = system_time_to_ms(metadata.modified().ok());
        if modified_ms > latest_mtime {
            latest_mtime = modified_ms;
        }

        total_size = total_size.saturating_add(metadata.len());

        let extension = extension_for_path(&relative_string);
        *type_breakdown.entry(extension).or_insert(0) += 1;
    }

    files.sort();

    let meta = json!({
        "fileCount": files.len(),
        "folderCount": folders.len(),
        "lastModified": to_iso_from_ms(latest_mtime),
        "typeBreakdown": type_breakdown,
        "totalSize": total_size,
    });

    (files, meta)
}

fn list_module_files(module_path: &Path) -> Vec<String> {
    if !module_path.exists() {
        return Vec::new();
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(module_path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|item| item.file_type().is_file())
    {
        let relative = match entry.path().strip_prefix(module_path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        if relative
            .components()
            .any(|component| component.as_os_str().to_string_lossy().starts_with('.'))
        {
            continue;
        }

        files.push(normalize_slashes(relative));
    }

    files.sort();
    files
}

fn read_module_files_with_content(module_path: &Path) -> Vec<Value> {
    if !module_path.exists() {
        return Vec::new();
    }

    let mut items = Vec::new();

    for entry in WalkDir::new(module_path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|item| item.file_type().is_file())
    {
        let relative = match entry.path().strip_prefix(module_path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        if relative
            .components()
            .any(|component| component.as_os_str().to_string_lossy().starts_with('.'))
        {
            continue;
        }

        let name = normalize_slashes(relative);
        let metadata = entry.metadata().ok();
        let content = fs::read_to_string(entry.path()).ok();

        if let Some(text) = content {
            items.push(json!({
                "name": name,
                "content": text,
                "size": metadata.as_ref().map(|value| value.len()).unwrap_or_default(),
                "lastModified": metadata
                    .as_ref()
                    .and_then(|value| value.modified().ok())
                    .and_then(format_iso),
            }));
        } else {
            items.push(json!({
                "name": name,
                "content": Value::Null,
                "error": "Could not read file",
            }));
        }
    }

    items.sort_by(|a, b| {
        get_string(a.get("name"))
            .unwrap_or_default()
            .cmp(&get_string(b.get("name")).unwrap_or_default())
    });

    items
}

fn resolve_summary_path(workspace_path: &Path, manifest: &Value) -> PathBuf {
    let summary_file = get_path_string(manifest, &["dashboard", "summaryFile"]) 
        .unwrap_or_else(|| DEFAULT_SUMMARY_FILE.to_string());
    workspace_path.join(summary_file.trim_start_matches('/'))
}

fn find_fallback_summary(workspace_path: &Path) -> Option<PathBuf> {
    let artifacts_dir = workspace_path.join("artifacts");
    if !artifacts_dir.exists() {
        return None;
    }

    for entry in WalkDir::new(&artifacts_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|item| item.file_type().is_file())
    {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if FALLBACK_SUMMARY_KEYWORDS
            .iter()
            .any(|keyword| name.contains(keyword))
        {
            return Some(entry.path().to_path_buf());
        }
    }

    None
}

fn discover_summary_candidates(workspace_path: &Path, manifest: &Value) -> Vec<Value> {
    let expected_summary_path = resolve_summary_path(workspace_path, manifest);
    let mut candidates: Vec<(i64, u64, String, Value)> = Vec::new();
    let mut seen = HashSet::new();

    let add_candidate = |absolute_path: &Path,
                         rank: i64,
                         expected_summary_path: &Path,
                         workspace_path: &Path,
                         seen: &mut HashSet<String>,
                         candidates: &mut Vec<(i64, u64, String, Value)>| {
        if !absolute_path.exists() {
            return;
        }

        let metadata = match absolute_path.metadata() {
            Ok(value) => value,
            Err(_) => return,
        };

        if !metadata.is_file() {
            return;
        }

        let relative = match absolute_path.strip_prefix(workspace_path) {
            Ok(value) => normalize_slashes(value),
            Err(_) => return,
        };

        if seen.contains(&relative) {
            return;
        }

        let extension = Path::new(&relative)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_lowercase())
            .unwrap_or_default();

        if extension != "md" && extension != "txt" {
            return;
        }

        let relative_lower = relative.to_lowercase();
        let keyword_hits = FALLBACK_SUMMARY_KEYWORDS
            .iter()
            .filter(|keyword| relative_lower.contains(**keyword))
            .count() as i64;

        let is_expected = absolute_path == expected_summary_path;
        let mut computed_rank = if is_expected { -100 } else { rank - keyword_hits };

        if relative_lower.contains("summary") {
            computed_rank -= 2;
        }

        let modified_ms = system_time_to_ms(metadata.modified().ok());

        let value = json!({
            "file": relative,
            "lastModified": format_iso(metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH)),
            "size": metadata.len(),
            "isExpected": is_expected,
            "keywordHits": keyword_hits,
            "rank": computed_rank,
        });

        seen.insert(relative.clone());
        candidates.push((computed_rank, modified_ms, relative, value));
    };

    add_candidate(
        &expected_summary_path,
        -50,
        &expected_summary_path,
        workspace_path,
        &mut seen,
        &mut candidates,
    );

    let artifacts_dir = workspace_path.join("artifacts");
    if artifacts_dir.exists() {
        for entry in WalkDir::new(&artifacts_dir)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|item| item.file_type().is_file())
        {
            let relative = match entry.path().strip_prefix(workspace_path) {
                Ok(value) => normalize_slashes(value),
                Err(_) => continue,
            };
            let relative_lower = relative.to_lowercase();

            let extension = Path::new(&relative)
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_lowercase())
                .unwrap_or_default();

            if extension != "md" && extension != "txt" {
                continue;
            }

            if !FALLBACK_SUMMARY_KEYWORDS
                .iter()
                .any(|keyword| relative_lower.contains(keyword))
            {
                continue;
            }

            add_candidate(
                entry.path(),
                20,
                &expected_summary_path,
                workspace_path,
                &mut seen,
                &mut candidates,
            );
        }
    }

    candidates.sort_by(|a, b| {
        if a.0 != b.0 {
            return a.0.cmp(&b.0);
        }

        if a.1 != b.1 {
            return b.1.cmp(&a.1);
        }

        a.2.cmp(&b.2)
    });

    candidates.into_iter().map(|(_, _, _, value)| value).collect()
}

fn parse_url(raw_url: &str) -> Result<(Vec<String>, HashMap<String, String>), String> {
    let with_base = if raw_url.starts_with("http://") || raw_url.starts_with("https://") {
        raw_url.to_string()
    } else if raw_url.starts_with('/') {
        format!("http://localhost{raw_url}")
    } else {
        format!("http://localhost/{raw_url}")
    };

    let parsed = Url::parse(&with_base).map_err(|error| format!("Invalid URL '{raw_url}': {error}"))?;
    let segments = parsed
        .path_segments()
        .map(|segments| segments.map(|segment| segment.to_string()).collect::<Vec<_>>())
        .unwrap_or_default();

    let query = parsed.query_pairs().into_owned().collect::<HashMap<String, String>>();

    Ok((segments, query))
}

fn endpoint_workspace(state: &AppState, requested_workspace_id: Option<&str>) -> Value {
    let config = current_config(state);

    let workspaces = if config.demo_mode {
        Vec::new()
    } else {
        list_workspace_entries(&config.workspaces_dir)
            .iter()
            .filter_map(to_workspace_summary)
            .collect::<Vec<_>>()
    };

    let workspace_context = get_workspace_context(&config, requested_workspace_id);

    if workspace_context.is_none() {
        return json!({
            "error": if requested_workspace_id.is_some() { "Workspace not found" } else { "No workspace found" },
            "manifest": Value::Null,
            "workspaceId": Value::Null,
            "workspaces": workspaces,
            "requestedWorkspaceId": requested_workspace_id,
            "workspaceNotFound": requested_workspace_id.is_some(),
        });
    }

    let context = workspace_context.expect("workspace context checked above");
    let meta = read_synthesis_meta(&context.workspace_path);

    let resolved_workspaces = if config.demo_mode {
        vec![json!({
            "id": context.workspace_id,
            "title": get_path_string(&context.manifest, &["workspace", "title"]).unwrap_or_else(|| "Sample Workspace".to_string())
        })]
    } else {
        workspaces
    };

    json!({
        "workspaceId": context.workspace_id,
        "manifest": context.manifest,
        "synthesis": meta,
        "workspaces": resolved_workspaces,
        "requestedWorkspaceId": requested_workspace_id,
        "workspaceNotFound": false,
    })
}

fn endpoint_workspace_blueprint(state: &AppState, workspace_id: &str) -> Value {
    let config = current_config(state);
    let Some(context) = get_workspace_context(&config, Some(workspace_id)) else {
        return json!({ "error": "Workspace not found", "status": 404 });
    };

    read_blueprint_audit(&context.workspace_path)
}

fn endpoint_agents(state: &AppState, requested_workspace_id: Option<&str>) -> Value {
    let config = current_config(state);
    let workspace_context = get_workspace_context(&config, requested_workspace_id);

    if workspace_context.is_none() {
        return json!({
            "agents": [],
            "requestedWorkspaceId": requested_workspace_id,
            "workspaceNotFound": requested_workspace_id.is_some(),
        });
    }

    let context = workspace_context.expect("workspace context checked above");

    let tasks = if config.demo_mode {
        read_sample_tasks(&config.sample_data_dir)
    } else {
        read_tasks(&config, &context.workspace_path, Some(&context.workspace_id))
    };

    let agents = context
        .manifest
        .get("agents")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|agent| {
            let assigned_tasks = tasks
                .iter()
                .filter(|task| matches_assignee(task, &agent))
                .cloned()
                .collect::<Vec<_>>();

            let (status, current_task) = infer_agent_status(&assigned_tasks);

            json!({
                "name": get_string(agent.get("id")).unwrap_or_default(),
                "display": get_string(agent.get("displayName")).unwrap_or_default(),
                "emoji": get_string(agent.get("emoji")).unwrap_or_else(|| "🤖".to_string()),
                "color": get_string(agent.get("color")).unwrap_or_else(|| "#60a5fa".to_string()),
                "role": get_string(agent.get("groupId")),
                "roleSummary": get_string(agent.get("roleSummary")).unwrap_or_default(),
                "groupId": get_string(agent.get("groupId")),
                "status": status,
                "currentTask": current_task,
                "active": agent.get("active").and_then(|value| value.as_bool()).unwrap_or(true),
                "agentId": get_string(agent.get("id")),
                "taskCount": assigned_tasks.len(),
            })
        })
        .collect::<Vec<_>>();

    json!({
        "agents": agents,
        "requestedWorkspaceId": requested_workspace_id,
        "workspaceNotFound": false,
    })
}

fn endpoint_tasks(state: &AppState, requested_workspace_id: Option<&str>) -> Value {
    let config = current_config(state);
    let workspace_context = get_workspace_context(&config, requested_workspace_id);

    if workspace_context.is_none() {
        return json!({
            "tasks": [],
            "summary": {
                "total": 0,
                "completed": 0,
                "inProgress": 0,
                "pending": 0,
                "blocked": 0,
            },
            "lanes": [],
            "requestedWorkspaceId": requested_workspace_id,
            "workspaceNotFound": requested_workspace_id.is_some(),
        });
    }

    let context = workspace_context.expect("workspace context checked above");

    let tasks = if config.demo_mode {
        read_sample_tasks(&config.sample_data_dir)
    } else {
        read_tasks(&config, &context.workspace_path, Some(&context.workspace_id))
    };

    let completed = tasks
        .iter()
        .filter(|task| get_string(task.get("status")).as_deref() == Some("completed"))
        .count();
    let in_progress = tasks
        .iter()
        .filter(|task| get_string(task.get("status")).as_deref() == Some("in_progress"))
        .count();
    let pending = tasks
        .iter()
        .filter(|task| get_string(task.get("status")).as_deref() == Some("pending"))
        .count();
    let blocked = tasks
        .iter()
        .filter(|task| {
            let status = get_string(task.get("status")).unwrap_or_default();
            let blocked_by = task
                .get("blockedBy")
                .and_then(|value| value.as_array())
                .map(|value| !value.is_empty())
                .unwrap_or(false);

            status == "blocked" || (status == "pending" && blocked_by)
        })
        .count();

    json!({
        "tasks": tasks,
        "summary": {
            "total": tasks.len(),
            "completed": completed,
            "inProgress": in_progress,
            "pending": pending,
            "blocked": blocked,
        },
        "lanes": context
            .manifest
            .get("workflowLanes")
            .cloned()
            .unwrap_or_else(|| Value::Array(vec![])),
        "requestedWorkspaceId": requested_workspace_id,
        "workspaceNotFound": false,
    })
}

fn endpoint_comms(state: &AppState, requested_workspace_id: Option<&str>, since: Option<&str>) -> Value {
    let config = current_config(state);

    if config.demo_mode {
        let messages = read_sample_comms(&config.sample_data_dir, since);
        return json!({
            "messages": messages,
            "count": messages.len(),
            "requestedWorkspaceId": requested_workspace_id,
            "workspaceNotFound": false,
        });
    }

    let workspace_context = get_workspace_context(&config, requested_workspace_id);

    if workspace_context.is_none() {
        return json!({
            "messages": [],
            "count": 0,
            "requestedWorkspaceId": requested_workspace_id,
            "workspaceNotFound": requested_workspace_id.is_some(),
        });
    }

    let context = workspace_context.expect("workspace context checked above");
    let workspace_team_name = get_path_string(&context.manifest, &["team", "name"]).unwrap_or_else(|| config.team_name.clone());
    let team_workspace_count = count_workspaces_for_team(&config.workspaces_dir, &workspace_team_name);
    let allow_unscoped_fallback = team_workspace_count == 1;

    let comms_file = resolve_comms_file(&context.manifest, &workspace_team_name);
    let scoped_messages = read_comms_from_file(
        &comms_file,
        since,
        CommsOptions {
            workspace_id: Some(context.workspace_id.clone()),
            allow_unscoped_fallback,
            fallback_workspace_id: Some(context.workspace_id.clone()),
        },
    );

    json!({
        "messages": scoped_messages,
        "count": scoped_messages.len(),
        "requestedWorkspaceId": requested_workspace_id,
        "workspaceNotFound": false,
    })
}

fn endpoint_artifacts(state: &AppState, requested_workspace_id: Option<&str>) -> Value {
    let config = current_config(state);

    if config.demo_mode {
        let context = match get_workspace_context(&config, requested_workspace_id) {
            Some(value) => value,
            None => return Value::Array(vec![]),
        };

        let mut modules = serde_json::Map::new();
        let mut module_meta = serde_json::Map::new();

        let module_defs = context
            .manifest
            .get("modules")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();

        for module_definition in module_defs {
            let module_id = get_string(module_definition.get("id")).unwrap_or_default();
            let (files, meta) = collect_module_meta(&context.workspace_path, &module_definition);
            modules.insert(module_id.clone(), json!(files));
            module_meta.insert(module_id, meta);
        }

        return Value::Array(vec![json!({
            "workspaceId": context.workspace_id,
            "title": get_path_string(&context.manifest, &["workspace", "title"]).unwrap_or_else(|| "Sample Workspace".to_string()),
            "modules": modules,
            "moduleMeta": module_meta,
            "moduleCount": modules.len(),
        })]);
    }

    let entries = list_workspace_entries(&config.workspaces_dir);
    let selected_entries = if let Some(workspace_id) = requested_workspace_id {
        entries
            .into_iter()
            .filter(|entry| entry.id == workspace_id)
            .collect::<Vec<_>>()
    } else {
        entries
    };

    let mut summaries = Vec::new();

    for entry in selected_entries {
        let manifest = match read_json_file(&entry.manifest_path) {
            Some(value) => value,
            None => continue,
        };

        let module_defs = manifest
            .get("modules")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();

        let mut modules = serde_json::Map::new();
        let mut module_meta = serde_json::Map::new();

        for module_definition in module_defs {
            let module_id = get_string(module_definition.get("id")).unwrap_or_default();
            let (files, meta) = collect_module_meta(&entry.workspace_path, &module_definition);
            modules.insert(module_id.clone(), json!(files));
            module_meta.insert(module_id, meta);
        }

        summaries.push(json!({
            "workspaceId": entry.id,
            "title": get_path_string(&manifest, &["workspace", "title"]).unwrap_or_else(|| "Workspace".to_string()),
            "modules": modules,
            "moduleMeta": module_meta,
            "moduleCount": modules.len(),
        }));
    }

    Value::Array(summaries)
}

fn endpoint_artifact_workspace(state: &AppState, workspace_id: &str) -> Value {
    let config = current_config(state);
    let Some(context) = get_workspace_context(&config, Some(workspace_id)) else {
        return json!({ "error": "Workspace not found", "status": 404 });
    };

    let mut result = serde_json::Map::new();

    let module_defs = context
        .manifest
        .get("modules")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    for module_definition in module_defs {
        let module_id = get_string(module_definition.get("id")).unwrap_or_default();
        let module_path = context.workspace_path.join(
            get_string(module_definition.get("path"))
                .unwrap_or_else(|| format!("artifacts/{module_id}")),
        );

        result.insert(module_id, json!(list_module_files(&module_path)));
    }

    Value::Object(result)
}

fn endpoint_artifact_module(state: &AppState, workspace_id: &str, module_id: &str) -> Value {
    let config = current_config(state);
    let Some(context) = get_workspace_context(&config, Some(workspace_id)) else {
        return json!({ "error": "Workspace not found", "status": 404 });
    };

    let module_definition = context
        .manifest
        .get("modules")
        .and_then(|value| value.as_array())
        .and_then(|modules| {
            modules
                .iter()
                .find(|module| get_string(module.get("id")).as_deref() == Some(module_id))
        })
        .cloned();

    let Some(module_definition) = module_definition else {
        return json!({ "error": "Module not found", "status": 404 });
    };

    let module_path = context.workspace_path.join(
        get_string(module_definition.get("path"))
            .unwrap_or_else(|| format!("artifacts/{module_id}")),
    );

    if !module_path.exists() {
        return json!({ "error": "Module path not found", "status": 404 });
    }

    Value::Array(read_module_files_with_content(&module_path))
}

fn endpoint_summary(state: &AppState, requested_workspace_id: Option<&str>, requested_file: Option<&str>) -> Value {
    let config = current_config(state);
    let Some(context) = get_workspace_context(&config, requested_workspace_id) else {
        return json!({ "error": "Workspace not found", "status": 404 });
    };

    let expected_summary_path = resolve_summary_path(&context.workspace_path, &context.manifest);
    let expected_relative_path = expected_summary_path
        .strip_prefix(&context.workspace_path)
        .map(normalize_slashes)
        .unwrap_or_else(|_| DEFAULT_SUMMARY_FILE.to_string());

    let candidates = discover_summary_candidates(&context.workspace_path, &context.manifest);

    let mut resolved_path = expected_summary_path.clone();

    if let Some(file) = requested_file {
        let requested = file.trim_start_matches('/');
        let requested_absolute = context.workspace_path.join(requested);
        if requested_absolute.exists() {
            resolved_path = requested_absolute;
        }
    }

    if !resolved_path.exists() {
        if let Some(first_candidate) = candidates.first().and_then(|value| get_string(value.get("file"))) {
            resolved_path = context.workspace_path.join(first_candidate);
        }
    }

    if !resolved_path.exists() {
        if let Some(fallback) = find_fallback_summary(&context.workspace_path) {
            resolved_path = fallback;
        }
    }

    if !resolved_path.exists() {
        return json!({
            "workspaceId": context.workspace_id,
            "file": expected_relative_path,
            "content": "",
            "expectedPath": expected_relative_path,
            "summaries": candidates,
        });
    }

    let content = fs::read_to_string(&resolved_path).unwrap_or_default();
    let selected_relative_path = resolved_path
        .strip_prefix(&context.workspace_path)
        .map(normalize_slashes)
        .unwrap_or_else(|_| expected_relative_path.clone());

    json!({
        "workspaceId": context.workspace_id,
        "file": selected_relative_path,
        "content": content,
        "expectedPath": expected_relative_path,
        "summaries": candidates,
    })
}

fn read_settings_env_flag(home: &Path) -> (bool, Option<String>) {
    let settings_path = home.join(".claude/settings.json");
    if !settings_path.exists() {
        return (false, None);
    }

    let Some(settings) = read_json_file(&settings_path) else {
        return (false, None);
    };

    let env_flag = settings
        .get("env")
        .and_then(|value| value.get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"))
        .and_then(|value| value.as_str())
        .map(|value| value == "1")
        .unwrap_or(false);

    let teammate_mode = settings
        .get("teammateMode")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());

    (env_flag, teammate_mode)
}

fn endpoint_setup_status(state: &AppState) -> Value {
    let settings = read_settings(state);
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let claude_output = std::process::Command::new("claude")
        .arg("--version")
        .output();

    let (claude_installed, claude_version, claude_error) = match claude_output {
        Ok(output) if output.status.success() => (
            true,
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            None,
        ),
        Ok(output) => (
            false,
            None,
            Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        ),
        Err(error) => (false, None, Some(error.to_string())),
    };

    let env_flag = env::var("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS")
        .map(|value| value == "1")
        .unwrap_or(false);

    let (settings_flag, teammate_mode) = read_settings_env_flag(&home);
    let saved_env_flag = settings.claude_agent_teams_env.unwrap_or(false);
    let agent_teams_enabled = env_flag || settings_flag || saved_env_flag;

    let tmux_available = which::which("tmux").is_ok();
    let recommended_teammate_mode = settings
        .teammate_mode
        .clone()
        .or(teammate_mode.clone())
        .unwrap_or_else(|| "in-process".to_string());
    let recommended_command = settings.kickoff_command.clone().unwrap_or_else(|| {
        format!(
            "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode {}",
            recommended_teammate_mode
        )
    });

    let readiness = claude_installed && agent_teams_enabled;

    json!({
        "ready": readiness,
        "claudeInstalled": claude_installed,
        "claudeVersion": claude_version,
        "claudeError": claude_error,
        "agentTeamsEnabled": agent_teams_enabled,
        "agentTeamsEnvFromProcess": env_flag,
        "agentTeamsEnvFromSettings": settings_flag,
        "agentTeamsEnvFromAppSettings": saved_env_flag,
        "teammateMode": teammate_mode,
        "savedTeammateMode": settings.teammate_mode,
        "tmuxAvailable": tmux_available,
        "recommendedCommand": recommended_command,
        "recommendedSettings": {
            "env": {
                "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
            },
            "teammateMode": recommended_teammate_mode
        },
        "notes": [
            "Agent Teams are experimental and must be enabled explicitly.",
            "For easiest startup, use in-process teammate mode.",
            "Use split panes only when tmux or iTerm2 pane tooling is set up."
        ]
    })
}

fn endpoint_health(state: &AppState) -> Value {
    let config = current_config(state);
    let workspace_context = get_workspace_context(&config, None);
    let synthesis_meta = workspace_context
        .as_ref()
        .and_then(|context| read_synthesis_meta(&context.workspace_path));

    let last_changed = state
        .last_changed
        .lock()
        .map(|value| value.clone())
        .unwrap_or_default();

    json!({
        "status": "ok",
        "appName": "Agent Swarm OS",
        "teamName": config.team_name,
        "demoMode": config.demo_mode,
        "workspaceId": workspace_context.as_ref().map(|ctx| ctx.workspace_id.clone()),
        "synthesisMode": synthesis_meta
            .as_ref()
            .and_then(|meta| meta.get("synthesisMode").and_then(|value| value.as_str())),
        "fallbackUsed": synthesis_meta
            .as_ref()
            .and_then(|meta| meta.get("fallbackUsed").and_then(|value| value.as_bool()))
            .unwrap_or(false),
        "lastChanged": last_changed,
    })
}

fn endpoint_settings(state: &AppState) -> Value {
    let config = current_config(state);
    let settings = read_settings(state);

    json!({
        "settings": settings,
        "effectiveConfig": {
            "projectRoot": normalize_slashes(&config.project_root),
            "teamName": config.team_name,
            "workspacesDir": normalize_slashes(&config.workspaces_dir),
            "teamsDir": normalize_slashes(&config.teams_dir),
            "tasksDir": normalize_slashes(&config.tasks_dir),
            "demoMode": config.demo_mode
        },
        "settingsPath": normalize_slashes(&settings_file_path(&state.config)),
    })
}

fn dispatch_api_get(state: &AppState, url: &str) -> Result<Value, String> {
    let (segments, query) = parse_url(url)?;

    let requested_workspace_id = query.get("workspaceId").map(String::as_str);
    let since = query.get("since").map(String::as_str);
    let requested_file = query.get("file").map(String::as_str);

    let response = match segments.as_slice() {
        [api, workspace] if api == "api" && workspace == "workspace" => {
            endpoint_workspace(state, requested_workspace_id)
        }
        [api, workspace, workspace_id, blueprint]
            if api == "api" && workspace == "workspace" && blueprint == "blueprint" =>
        {
            endpoint_workspace_blueprint(state, workspace_id)
        }
        [api, agents] if api == "api" && agents == "agents" => {
            endpoint_agents(state, requested_workspace_id)
        }
        [api, tasks] if api == "api" && tasks == "tasks" => {
            endpoint_tasks(state, requested_workspace_id)
        }
        [api, comms] if api == "api" && (comms == "comms" || comms == "coffee-room") => {
            endpoint_comms(state, requested_workspace_id, since)
        }
        [api, artifacts] if api == "api" && (artifacts == "artifacts" || artifacts == "content") => {
            endpoint_artifacts(state, requested_workspace_id)
        }
        [api, artifacts, workspace_id]
            if api == "api" && (artifacts == "artifacts" || artifacts == "content") =>
        {
            endpoint_artifact_workspace(state, workspace_id)
        }
        [api, artifacts, workspace_id, module_id]
            if api == "api" && (artifacts == "artifacts" || artifacts == "content") =>
        {
            endpoint_artifact_module(state, workspace_id, module_id)
        }
        [api, summary] if api == "api" && summary == "summary" => {
            endpoint_summary(state, requested_workspace_id, requested_file)
        }
        [api, health] if api == "api" && health == "health" => endpoint_health(state),
        [api, settings] if api == "api" && settings == "settings" => endpoint_settings(state),
        [api, setup, status] if api == "api" && setup == "setup" && status == "status" => {
            endpoint_setup_status(state)
        }
        _ => {
            return Err(format!("Unsupported API path: {url}"));
        }
    };

    Ok(response)
}

fn touch_last_changed(last_changed: &Arc<Mutex<LastChanged>>, key: &str) {
    if let Ok(mut state) = last_changed.lock() {
        match key {
            "teams" => state.teams = now_ms(),
            "tasks" => state.tasks = now_ms(),
            "workspaces" => state.workspaces = now_ms(),
            _ => {}
        }
    }
}

fn install_watcher(
    state: &AppState,
    app_handle: AppHandle<Wry>,
    watch_path: PathBuf,
    key: &'static str,
) {
    let last_changed = Arc::clone(&state.last_changed);
    let watched_root = watch_path.clone();

    let watcher = RecommendedWatcher::new(
        move |event: Result<notify::Event, notify::Error>| {
            if let Ok(payload) = event {
                touch_last_changed(&last_changed, key);
                let first_path = payload
                    .paths
                    .first()
                    .map(|path| normalize_slashes(path))
                    .unwrap_or_else(|| normalize_slashes(&watched_root));

                let _ = app_handle.emit(
                    "file-changed",
                    json!({
                        "kind": key,
                        "path": first_path,
                        "timestamp": now_ms(),
                    }),
                );
            }
        },
        NotifyConfig::default(),
    );

    let mut watcher = match watcher {
        Ok(value) => value,
        Err(_) => return,
    };

    if watcher.watch(&watch_path, RecursiveMode::Recursive).is_err() {
        return;
    }

    if let Ok(mut watchers) = state.watchers.lock() {
        watchers.push(watcher);
    }
}

fn init_watchers(state: &AppState, app_handle: AppHandle<Wry>, config: &AppConfig) {
    let paths = vec![
        (config.teams_dir.clone(), "teams"),
        (config.tasks_dir.clone(), "tasks"),
        (config.workspaces_dir.clone(), "workspaces"),
    ];

    for (target, key) in paths {
        if target.exists() {
            install_watcher(state, app_handle.clone(), target, key);
        } else if let Some(parent) = target.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
            install_watcher(state, app_handle.clone(), parent.to_path_buf(), key);
        }
    }
}

fn refresh_watchers(state: &AppState, app_handle: AppHandle<Wry>) {
    if let Ok(mut watchers) = state.watchers.lock() {
        watchers.clear();
    }

    let config = current_config(state);
    init_watchers(state, app_handle, &config);
}

#[tauri::command]
fn api_get(state: State<'_, AppState>, url: String) -> Result<Value, String> {
    dispatch_api_get(&state, &url)
}

#[tauri::command]
fn api_delete(state: State<'_, AppState>, url: String) -> Result<Value, String> {
    dispatch_api_delete(&state, &url)
}

fn dispatch_api_delete(state: &AppState, url: &str) -> Result<Value, String> {
    let (segments, query) = parse_url(url)?;
    let archive = query.get("archive").map(|s| s == "true").unwrap_or(false);

    match segments.as_slice() {
        [api, workspace, workspace_id] if api == "api" && workspace == "workspace" => {
            endpoint_delete_workspace(state, workspace_id, archive)
        }
        _ => Err(format!("Unsupported DELETE endpoint: {}", url)),
    }
}

fn endpoint_delete_workspace(state: &AppState, workspace_id: &str, archive: bool) -> Result<Value, String> {
    use std::fs;
    use std::path::Path;

    let workspaces_dir = &state.config.workspaces_dir;
    let workspace_path = Path::new(workspaces_dir).join(workspace_id);

    if !workspace_path.exists() {
        return Err(format!("Workspace not found: {}", workspace_id));
    }

    if archive {
        // Archive mode: move to .archived folder
        let archive_dir = Path::new(workspaces_dir).join(".archived");
        fs::create_dir_all(&archive_dir)
            .map_err(|e| format!("Failed to create archive directory: {}", e))?;

        let archived_path = archive_dir.join(workspace_id);
        fs::rename(&workspace_path, &archived_path)
            .map_err(|e| format!("Failed to archive workspace: {}", e))?;

        Ok(json!({
            "ok": true,
            "message": "Workspace archived successfully",
            "workspaceId": workspace_id,
            "archivedPath": archived_path.to_string_lossy()
        }))
    } else {
        // Delete mode: permanently remove
        fs::remove_dir_all(&workspace_path)
            .map_err(|e| format!("Failed to delete workspace: {}", e))?;

        Ok(json!({
            "ok": true,
            "message": "Workspace deleted successfully",
            "workspaceId": workspace_id
        }))
    }
}

#[tauri::command]
async fn init_workspace(
    state: State<'_, AppState>,
    request: InitWorkspaceRequest,
) -> Result<Value, String> {
    let config = current_config(&state);
    let settings = read_settings(&state);
    let topic = request.topic.trim();
    if topic.is_empty() {
        return Err("Mission topic is required".to_string());
    }

    let script_path = config.project_root.join("scripts/init-workflow.js");
    if !script_path.exists() {
        return Err(format!(
            "Init script not found at {}",
            script_path.display()
        ));
    }

    let mut command = Command::new("node");
    command.arg(script_path);
    command.arg("--task").arg(topic);

    let requested_agents = request.agents.or(settings.default_agents);
    if let Some(agents) = requested_agents {
        command.arg("--agents").arg(agents.to_string());
    }

    let requested_template = clean_optional_string(request.template.clone())
        .or(clean_optional_string(settings.preferred_template.clone()));
    if let Some(template) = requested_template.as_ref() {
        command.arg("--template").arg(template);
    }

    let requested_team_name =
        clean_optional_string(request.team_name.clone()).unwrap_or_else(|| config.team_name.clone());
    if !requested_team_name.is_empty() {
        command.arg("--team-name").arg(&requested_team_name);
    }

    if request.quick.unwrap_or(true) {
        command.arg("--quick");
    }

    if request.dry_run.unwrap_or(false) {
        command.arg("--dry-run");
    }

    if let Some(agent_roles) = request.agent_roles {
        for role in agent_roles.into_iter().filter(|value| !value.trim().is_empty()) {
            command.arg("--agent-role").arg(role);
        }
    }

    command.current_dir(&config.project_root);

    let output = command
        .output()
        .await
        .map_err(|error| format!("Failed to run init workflow: {error}"))?;

    let status_code = output.status.code();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let latest_workspace_id = list_workspace_entries(&config.workspaces_dir)
        .into_iter()
        .next()
        .map(|entry| entry.id);

    touch_last_changed(&state.last_changed, "workspaces");

    Ok(json!({
        "ok": output.status.success(),
        "exitCode": status_code,
        "stdout": stdout,
        "stderr": stderr,
        "effectiveConfig": {
            "teamName": config.team_name,
            "workspacesDir": normalize_slashes(&config.workspaces_dir),
            "teamsDir": normalize_slashes(&config.teams_dir),
            "tasksDir": normalize_slashes(&config.tasks_dir),
        },
        "latestWorkspaceId": latest_workspace_id,
    }))
}

#[tauri::command]
fn get_app_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let config = current_config(&state);

    // Check if effective workspaces directory exists (including fallback to project_root/workspaces)
    let needs_configuration = !config.workspaces_dir.exists() || !config.workspaces_dir.is_dir();

    let mut response = endpoint_settings(&state);
    if let Some(obj) = response.as_object_mut() {
        obj.insert("needsConfiguration".to_string(), json!(needs_configuration));
    }

    Ok(response)
}

#[tauri::command]
fn save_app_settings(
    state: State<'_, AppState>,
    app_handle: AppHandle<Wry>,
    request: SaveAppSettingsRequest,
) -> Result<Value, String> {
    let merged = merge_save_settings(request);
    persist_app_settings(&state.config, &merged)?;

    if let Ok(mut settings) = state.settings.lock() {
        *settings = merged.clone();
    }

    refresh_watchers(&state, app_handle);
    touch_last_changed(&state.last_changed, "teams");
    touch_last_changed(&state.last_changed, "tasks");
    touch_last_changed(&state.last_changed, "workspaces");

    Ok(json!({
        "ok": true,
        "settings": merged,
        "effectiveConfig": endpoint_settings(&state).get("effectiveConfig").cloned().unwrap_or(Value::Null),
    }))
}

#[tauri::command]
async fn run_claude_command(
    state: State<'_, AppState>,
    command: String,
    cwd: Option<String>,
) -> Result<Value, String> {
    let settings = read_settings(&state);
    let config = current_config(&state);
    let command_text = command.trim();
    if command_text.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let working_dir = clean_optional_string(cwd)
        .map(|value| expand_user_path(&value))
        .unwrap_or_else(|| config.project_root.clone());

    // SECURITY: Validate command against allowlist
    let validated_command = AllowedCommand::validate(command_text)
        .map_err(|e| format!("Command validation failed: {}", e))?;

    // Execute the validated command
    let mut output = validated_command
        .execute(&working_dir)
        .await
        .map_err(|e| format!("Command execution failed: {}", e))?;

    // Apply environment variables if needed for Claude commands
    if matches!(validated_command, AllowedCommand::Claude { .. }) {
        if settings.claude_agent_teams_env.unwrap_or(true) {
            // Re-execute with environment variable
            let mut process = Command::new("claude");
            if let AllowedCommand::Claude { args } = validated_command {
                process.args(&args);
            }
            process.current_dir(&working_dir);
            process.env("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1");

            output = process
                .output()
                .await
                .map_err(|error| format!("Failed to run command: {error}"))?;
        }
    }

    Ok(json!({
        "ok": output.status.success(),
        "exitCode": output.status.code(),
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "cwd": normalize_slashes(&working_dir),
        "validated": true,
    }))
}

#[tauri::command]
async fn run_swarm_kickoff(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Value, String> {
    let config = current_config(&state);
    let settings = read_settings(&state);

    let workspace = workspace_id.trim();
    if workspace.is_empty() {
        return Err("workspaceId is required".to_string());
    }

    let workspace_path = config.workspaces_dir.join(workspace);
    if !workspace_path.exists() {
        return Err(format!(
            "Workspace not found: {}",
            normalize_slashes(&workspace_path)
        ));
    }

    let kickoff_path = workspace_path.join(".agentsquad/kickoff-prompt.txt");
    if !kickoff_path.exists() {
        return Err(format!(
            "Kickoff prompt not found: {}",
            normalize_slashes(&kickoff_path)
        ));
    }

    let kickoff_prompt = fs::read_to_string(&kickoff_path)
        .map_err(|error| format!("Failed to read kickoff prompt: {error}"))?;
    if kickoff_prompt.trim().is_empty() {
        return Err("Kickoff prompt is empty".to_string());
    }

    let teammate_mode = settings
        .teammate_mode
        .clone()
        .unwrap_or_else(|| "in-process".to_string());

    let mut process = Command::new("claude");
    process
        .arg("-p")
        .arg(kickoff_prompt)
        .arg("--teammate-mode")
        .arg(&teammate_mode)
        .current_dir(&workspace_path);

    if settings.claude_agent_teams_env.unwrap_or(true) {
        process.env("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1");
    }

    let output = process
        .output()
        .await
        .map_err(|error| format!("Failed to run swarm kickoff: {error}"))?;

    Ok(json!({
        "ok": output.status.success(),
        "exitCode": output.status.code(),
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "workspaceId": workspace,
        "workspacePath": normalize_slashes(&workspace_path),
        "kickoffPromptPath": normalize_slashes(&kickoff_path),
        "teammateMode": teammate_mode,
    }))
}

fn main() {
    let config = build_config();
    let settings = load_app_settings(&config);
    let state = AppState {
        config: Arc::new(config),
        settings: Arc::new(Mutex::new(settings)),
        last_changed: Arc::new(Mutex::new(LastChanged::default())),
        watchers: Arc::new(Mutex::new(Vec::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            refresh_watchers(state.inner(), app_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api_get,
            api_delete,
            init_workspace,
            get_app_settings,
            save_app_settings,
            run_claude_command,
            run_swarm_kickoff
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agent Swarm OS");
}
