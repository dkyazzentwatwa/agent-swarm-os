#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const Ajv = require("ajv");

const MAX_AGENTS = 8;
const DEFAULT_TEAM_NAME = "agent-squad-team";
const DEFAULT_NAV = ["mission", "summary", "tasks", "comms", "artifacts", "analytics", "help"];
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 120000);
const MAX_SYNTHESIS_RETRIES = 2;

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, "templates", "agent-squad");
const WORKSPACES_ROOT = path.join(PROJECT_ROOT, "workspaces");
const CONFIG_PATHS = [
  path.join(PROJECT_ROOT, ".agentsquadrc"),
  path.join(PROJECT_ROOT, "agentsquad.config.json"),
  path.join(os.homedir(), ".agentsquadrc"),
];

// ─── Color helpers for non-clack output ──────────────────────────────────────

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
};

function c(text, ...styles) {
  return styles.join("") + text + color.reset;
}

// ─── Blueprint JSON Schema ───────────────────────────────────────────────────

const BLUEPRINT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "groups", "agents", "modules", "workflowLanes"],
  properties: {
    templateId: { type: "string" },
    title: { type: "string", minLength: 3 },
    dashboard: {
      type: "object",
      additionalProperties: true,
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        nav: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
      },
    },
    groups: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "description"],
        properties: {
          id: { type: "string", minLength: 2 },
          label: { type: "string", minLength: 2 },
          description: { type: "string", minLength: 2 },
          color: { type: "string" },
        },
      },
    },
    agents: {
      type: "array",
      minItems: 1,
      maxItems: MAX_AGENTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "displayName", "groupId", "roleSummary", "prompt"],
        properties: {
          id: { type: "string", minLength: 2 },
          displayName: { type: "string", minLength: 2 },
          emoji: { type: "string" },
          groupId: { type: "string", minLength: 2 },
          roleSummary: { type: "string", minLength: 3 },
          prompt: { type: "string", minLength: 10 },
          color: { type: "string" },
        },
      },
    },
    modules: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "description"],
        properties: {
          id: { type: "string", minLength: 2 },
          label: { type: "string", minLength: 2 },
          emoji: { type: "string" },
          description: { type: "string", minLength: 3 },
        },
      },
    },
    workflowLanes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "description"],
        properties: {
          id: { type: "string", minLength: 2 },
          label: { type: "string", minLength: 2 },
          description: { type: "string", minLength: 3 },
        },
      },
    },
    comms: {
      type: "object",
      additionalProperties: false,
      properties: {
        types: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

// ─── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    task: "",
    agents: null,
    template: "",
    teamName: "",
    wizard: false,
    quick: false,
    dryRun: false,
    help: false,
    agentRoles: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "-t" || token === "--task") {
      args.task = argv[i + 1] || "";
      i += 1;
    } else if (token === "-a" || token === "--agents") {
      const n = Number(argv[i + 1]);
      args.agents = Number.isFinite(n) ? n : null;
      i += 1;
    } else if (token === "--template") {
      args.template = argv[i + 1] || "";
      i += 1;
    } else if (token === "--team-name") {
      args.teamName = argv[i + 1] || "";
      i += 1;
    } else if (token === "--agent-role") {
      const value = argv[i + 1] || "";
      if (value.trim()) args.agentRoles.push(value.trim());
      i += 1;
    } else if (token === "--wizard") {
      args.wizard = true;
    } else if (token === "-q" || token === "--quick") {
      args.quick = true;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "-h" || token === "--help") {
      args.help = true;
    } else if (!token.startsWith("-")) {
      // Backward compatibility: positional mission title.
      args.task = args.task || token;
    }
  }

  return args;
}

// ─── Help screen ─────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${c("Agent Squad Init", color.bold, color.cyan)}
${c("Set up a multi-agent workspace for any mission.", color.dim)}

${c("USAGE", color.bold)}
  npm run init ${c("[options]", color.dim)}
  npm run init -- ${c("-t \"topic\"", color.dim)}

${c("OPTIONS", color.bold)}
  ${c("-t, --task", color.cyan)} <topic>       Mission topic ${c("(required in non-interactive mode)", color.dim)}
  ${c("-a, --agents", color.cyan)} <n>         Number of agents (1-${MAX_AGENTS}) ${c("[auto-detected]", color.dim)}
  ${c("--template", color.cyan)} <id>          Template hint ${c("[auto-detected]", color.dim)}
  ${c("--team-name", color.cyan)} <name>       Team name ${c(`[${DEFAULT_TEAM_NAME}]`, color.dim)}
  ${c("--agent-role", color.cyan)} <name[:brief]>  Add custom role (repeatable)
  ${c("--wizard", color.cyan)}                 Force interactive wizard mode
  ${c("-q, --quick", color.cyan)}              Skip all optional prompts, use smart defaults
  ${c("--dry-run", color.cyan)}                Preview what would be created without writing files
  ${c("-h, --help", color.cyan)}               Show this help message

${c("EXAMPLES", color.bold)}
  ${c("# Interactive wizard (recommended for first-timers)", color.gray)}
  npm run init

  ${c("# Quick start with just a topic", color.gray)}
  npm run init -- -q -t "Build a SaaS landing page"

  ${c("# Full control", color.gray)}
  npm run init -- -t "YouTube cooking channel" -a 6 --template social-media

  ${c("# Custom agent roles (repeat --agent-role)", color.gray)}
  npm run init -- -t "CRE deals" -a 5 --agent-role "deal-lead:Owns end-to-end flow" --agent-role "underwriter:Risk and financial analysis"

  ${c("# Preview without creating files", color.gray)}
  npm run init -- --dry-run -t "Research climate policy"

  ${c("# Force a specific template with custom team name", color.gray)}
  npm run init -- -t "REST API" --template software-build --team-name my-api-team

${c("TEMPLATES", color.bold)}
  ${c("social-media", color.yellow)}      YouTube, TikTok, Instagram content strategy
  ${c("research", color.yellow)}           Literature review, data analysis, fact-checking
  ${c("software-build", color.yellow)}     Full-stack engineering team

${c("CONFIG FILE", color.bold)}
  Create ${c(".agentsquadrc", color.yellow)} in the project root or home directory:
  {
    "defaultTeamName": "my-team",
    "defaultAgentCount": 4,
    "preferredTemplate": "software-build"
  }
`);
}

// ─── Config file support ─────────────────────────────────────────────────────

function loadConfig() {
  for (const configPath of CONFIG_PATHS) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return {
          defaultTeamName: raw.defaultTeamName || "",
          defaultAgentCount: raw.defaultAgentCount || null,
          preferredTemplate: raw.preferredTemplate || "",
        };
      } catch {
        // Ignore malformed config
      }
    }
  }
  return { defaultTeamName: "", defaultAgentCount: null, preferredTemplate: "" };
}

// ─── Utility functions ───────────────────────────────────────────────────────

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Template system ─────────────────────────────────────────────────────────

function loadRolePromptsFromFiles(templateDir, template) {
  const promptsDir = path.join(templateDir, "prompts");
  if (!Array.isArray(template.roles) || template.roles.length === 0) return template;
  if (!fs.existsSync(promptsDir)) return template;

  const roles = template.roles.map((role) => {
    const promptPath = path.join(promptsDir, `${role.id}.md`);
    if (!fs.existsSync(promptPath)) return role;

    try {
      const filePrompt = fs.readFileSync(promptPath, "utf-8").trim();
      if (!filePrompt) return role;
      return { ...role, prompt: filePrompt };
    } catch {
      return role;
    }
  });

  return { ...template, roles };
}

function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_ROOT)) {
    throw new Error(`Missing templates root: ${TEMPLATES_ROOT}`);
  }

  const templateIds = fs
    .readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const templates = new Map();
  for (const id of templateIds) {
    const templateDir = path.join(TEMPLATES_ROOT, id);
    const templatePath = path.join(TEMPLATES_ROOT, id, "template.json");
    if (!fs.existsSync(templatePath)) continue;

    const raw = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
    const withPromptFiles = loadRolePromptsFromFiles(templateDir, raw);
    templates.set(withPromptFiles.id || id, withPromptFiles);
  }

  if (templates.size === 0) {
    throw new Error("No valid templates found in templates/agent-squad");
  }

  return templates;
}

function getTemplateDescriptions(templates) {
  const descriptions = {
    "social-media": "YouTube, TikTok, Instagram content strategy",
    research: "Literature review, data analysis, fact-checking",
    "software-build": "Full-stack engineering team",
  };

  const result = [];
  for (const [id, template] of templates) {
    result.push({
      id,
      label: template.label || id,
      description: descriptions[id] || template.description || "Specialized agent team",
      defaultAgentCount: template.defaultAgentCount || 5,
      keywords: template.keywords || [],
      roleCount: (template.roles || []).length,
    });
  }
  return result;
}

// ─── Fuzzy template matching ─────────────────────────────────────────────────

function fuzzyMatchTemplate(input, templates) {
  if (!input) return null;

  const inputLower = input.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Exact match first
  if (templates.has(input)) return input;

  // Fuzzy: check if input is a prefix/substring of template IDs
  for (const id of templates.keys()) {
    const idNormalized = id.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (idNormalized.startsWith(inputLower) || idNormalized.includes(inputLower)) {
      return id;
    }
  }

  // Fuzzy: check template labels
  for (const [id, template] of templates) {
    const labelNormalized = (template.label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (labelNormalized.startsWith(inputLower) || labelNormalized.includes(inputLower)) {
      return id;
    }
  }

  // Fuzzy: check keywords
  for (const [id, template] of templates) {
    for (const keyword of template.keywords || []) {
      if (keyword.toLowerCase().startsWith(inputLower)) {
        return id;
      }
    }
  }

  return null;
}

// ─── Smart defaults: auto-detect template + agent count from topic ───────────

function autoDetectTemplate(topic, templates) {
  let best = null;
  let bestScore = 0;

  for (const [id, template] of templates) {
    let score = 0;
    const topicLower = topic.toLowerCase();

    for (const keyword of template.keywords || []) {
      if (topicLower.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }

  return best;
}

function autoDetectAgentCount(topic, template) {
  if (template && template.defaultAgentCount) {
    return template.defaultAgentCount;
  }

  // Heuristic: longer/more complex topics get more agents
  const words = topic.split(/\s+/).length;
  if (words <= 3) return 4;
  if (words <= 6) return 5;
  return 6;
}

// ─── Topic validation ────────────────────────────────────────────────────────

const VAGUE_TOPICS = new Set([
  "stuff", "test", "testing", "thing", "things", "hello", "hi", "hey",
  "foo", "bar", "baz", "asdf", "aaa", "abc", "xxx", "zzz", "blah",
]);

function validateTopic(topic) {
  const trimmed = (topic || "").trim();
  if (!trimmed || trimmed.length < 3) {
    return { valid: false, message: "Mission topic must be at least 3 characters." };
  }
  if (VAGUE_TOPICS.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      message: `"${trimmed}" is too vague. Try something specific like "Build a SaaS landing page" or "Research climate policy".`,
    };
  }
  return { valid: true };
}

// ─── Welcome banner ──────────────────────────────────────────────────────────

function hasExistingWorkspaces() {
  if (!fs.existsSync(WORKSPACES_ROOT)) return false;
  const entries = fs.readdirSync(WORKSPACES_ROOT, { withFileTypes: true });
  return entries.some((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "archive");
}

// ─── Interactive wizard (powered by @clack/prompts) ──────────────────────────

async function gatherInput(args, templates, config) {
  // Dynamic import for ESM-only @clack/prompts
  const clack = await import("@clack/prompts");

  const isFirstRun = !hasExistingWorkspaces();
  const templateDescriptions = getTemplateDescriptions(templates);

  // Welcome banner
  if (isFirstRun) {
    clack.intro(c(" Welcome to Agent Squad! ", color.bold, color.bgBlue, color.white));
    console.log(
      c(
        "  This wizard sets up a multi-agent workspace for your mission.\n" +
          "  You'll get a team of AI agents, each with a specialized role,\n" +
          "  plus a dashboard to track progress.\n",
        color.dim
      )
    );
  } else {
    clack.intro(c(" Agent Squad Init ", color.bold, color.bgBlue, color.white));
  }

  // ── Step 1: Mission topic (always required) ──

  let task = (args.task || "").trim();
  if (!task) {
    const topicResult = await clack.text({
      message: "What's your mission?",
      placeholder: 'e.g. "Build a SaaS landing page", "Research climate policy"',
      validate(value) {
        const check = validateTopic(value);
        if (!check.valid) return check.message;
      },
    });

    if (clack.isCancel(topicResult)) {
      clack.cancel("Init cancelled.");
      process.exit(0);
    }
    task = topicResult.trim();
  } else {
    const check = validateTopic(task);
    if (!check.valid) {
      clack.log.error(check.message);
      process.exit(1);
    }
    clack.log.info(`Mission: ${c(task, color.bold)}`);
  }

  // ── Auto-detect smart defaults ──

  const detectedTemplateId = autoDetectTemplate(task, templates);
  const detectedTemplate = detectedTemplateId ? templates.get(detectedTemplateId) : null;
  const detectedAgentCount = autoDetectAgentCount(task, detectedTemplate);

  // Apply config overrides for defaults
  const defaultTeamName = config.defaultTeamName || DEFAULT_TEAM_NAME;
  const defaultAgentCount = args.agents || config.defaultAgentCount || detectedAgentCount;
  const defaultTemplateId = args.template
    ? fuzzyMatchTemplate(args.template, templates) || args.template
    : config.preferredTemplate
      ? fuzzyMatchTemplate(config.preferredTemplate, templates)
      : detectedTemplateId;

  // ── Quick mode: accept all defaults ──

  if (args.quick) {
    const templateId = defaultTemplateId || null;
    const agents = Math.min(MAX_AGENTS, Math.max(1, defaultAgentCount));
    const teamName = args.teamName || defaultTeamName;

    clack.log.info(
      `Quick mode: ${c(String(agents), color.cyan)} agents, ` +
        `template ${c(templateId || "auto (AI synthesis)", color.cyan)}, ` +
        `team ${c(teamName, color.cyan)}`
    );

    return { task, agents, templateId, teamName };
  }

  // ── Step 2: Show auto-detected config and let user customize ──

  const autoSummary = [
    `  Template:   ${c(defaultTemplateId || "auto (AI will decide)", color.cyan)}`,
    `  Agents:     ${c(String(defaultAgentCount), color.cyan)}`,
    `  Team name:  ${c(defaultTeamName, color.cyan)}`,
  ].join("\n");

  clack.log.info(`Auto-configured based on your topic:\n${autoSummary}`);

  const customizeChoice = await clack.confirm({
    message: "Use these settings?",
    initialValue: true,
  });

  if (clack.isCancel(customizeChoice)) {
    clack.cancel("Init cancelled.");
    process.exit(0);
  }

  let agents = defaultAgentCount;
  let templateId = defaultTemplateId;
  let teamName = args.teamName || defaultTeamName;
  let customAgents = (args.agentRoles || [])
    .slice(0, MAX_AGENTS)
    .map((entry) => {
      const [namePart, ...briefParts] = String(entry || "").split(":");
      return {
        name: String(namePart || "").trim(),
        brief: String(briefParts.join(":") || "").trim(),
      };
    })
    .filter((agent) => agent.name);

  if (!customizeChoice) {
    // ── Template picker ──

    const templateOptions = templateDescriptions.map((t) => ({
      value: t.id,
      label: `${t.label}`,
      hint: `${t.description} (${t.roleCount} roles)`,
    }));
    templateOptions.push({
      value: "__auto__",
      label: "Auto-detect",
      hint: "Let AI pick based on your topic",
    });

    const templateChoice = await clack.select({
      message: "Pick a starting template:",
      options: templateOptions,
      initialValue: defaultTemplateId || "__auto__",
    });

    if (clack.isCancel(templateChoice)) {
      clack.cancel("Init cancelled.");
      process.exit(0);
    }

    templateId = templateChoice === "__auto__" ? null : templateChoice;

    // ── Agent count ──

    const selectedTemplate = templateId ? templates.get(templateId) : null;
    const suggestedCount = selectedTemplate
      ? selectedTemplate.defaultAgentCount
      : defaultAgentCount;

    const agentCountOptions = [];
    for (let n = 1; n <= MAX_AGENTS; n++) {
      const label = `${n} agent${n > 1 ? "s" : ""}`;
      const hint =
        n === suggestedCount
          ? "recommended"
          : n <= 3
            ? "small team"
            : n <= 5
              ? "medium team"
              : "large team";
      agentCountOptions.push({ value: n, label, hint });
    }

    const agentChoice = await clack.select({
      message: "How many agents?",
      options: agentCountOptions,
      initialValue: suggestedCount,
    });

    if (clack.isCancel(agentChoice)) {
      clack.cancel("Init cancelled.");
      process.exit(0);
    }

    agents = agentChoice;

    // ── Team name ──

    const teamNameResult = await clack.text({
      message: "Team name:",
      placeholder: defaultTeamName,
      defaultValue: defaultTeamName,
      validate(value) {
        if (value && value.trim().length < 2) return "Team name must be at least 2 characters.";
      },
    });

    if (clack.isCancel(teamNameResult)) {
      clack.cancel("Init cancelled.");
      process.exit(0);
    }

    teamName = (teamNameResult || "").trim() || defaultTeamName;
  }

  // ── Step 3: Agent setup mode (AI auto-build vs custom roster) ──
  // This step must always run in interactive mode, regardless of whether
  // the user accepted auto-config defaults above.
  const setupMode = await clack.select({
    message: "How should Agent Squad build agent roles?",
    options: [
      {
        value: "auto",
        label: "AI auto-build roster",
        hint: "recommended: generates domain-specialized team from topic",
      },
      {
        value: "custom",
        label: "Custom roster (you define roles)",
        hint: "enter role names and brief descriptions",
      },
    ],
    initialValue: customAgents.length > 0 ? "custom" : "auto",
  });

  if (clack.isCancel(setupMode)) {
    clack.cancel("Init cancelled.");
    process.exit(0);
  }

  if (setupMode === "custom" && customAgents.length === 0) {
    clack.log.info(`Define ${c(String(agents), color.cyan)} custom agent role(s).`);
    for (let i = 0; i < agents; i += 1) {
      const roleName = await clack.text({
        message: `Agent ${i + 1} role name:`,
        placeholder: i === 0 ? "e.g. deal-coordinator" : "e.g. compliance-reviewer",
        validate(value) {
          const trimmed = String(value || "").trim();
          if (!trimmed) return "Role name is required.";
          if (trimmed.length < 2) return "Role name must be at least 2 characters.";
        },
      });

      if (clack.isCancel(roleName)) {
        clack.cancel("Init cancelled.");
        process.exit(0);
      }

      const roleBrief = await clack.text({
        message: `Agent ${i + 1} brief (optional):`,
        placeholder: "What this agent is responsible for",
      });

      if (clack.isCancel(roleBrief)) {
        clack.cancel("Init cancelled.");
        process.exit(0);
      }

      customAgents.push({
        name: String(roleName || "").trim(),
        brief: String(roleBrief || "").trim(),
      });
    }
  }

  return { task, agents, templateId, teamName, customAgents };
}

// ─── Quick/flag-only gather (no interactive prompts) ─────────────────────────

function gatherFromFlags(args, templates, config) {
  let task = (args.task || "").trim();
  if (!task) {
    throw new Error("Missing mission topic. Provide --task \"...\" or run without --quick for interactive mode.");
  }

  const check = validateTopic(task);
  if (!check.valid) throw new Error(check.message);

  const detectedTemplateId = autoDetectTemplate(task, templates);
  const detectedTemplate = detectedTemplateId ? templates.get(detectedTemplateId) : null;

  let templateId = args.template
    ? fuzzyMatchTemplate(args.template, templates)
    : config.preferredTemplate
      ? fuzzyMatchTemplate(config.preferredTemplate, templates)
      : detectedTemplateId;

  if (args.template && !templateId) {
    console.warn(c(`  Warning: Unknown template '${args.template}', using auto-detect.`, color.yellow));
    templateId = detectedTemplateId;
  }

  const selectedTemplate = templateId ? templates.get(templateId) : detectedTemplate;
  const agents = args.agents || config.defaultAgentCount || autoDetectAgentCount(task, selectedTemplate);

  if (!Number.isInteger(agents) || agents < 1 || agents > MAX_AGENTS) {
    throw new Error(`Agent count must be an integer between 1 and ${MAX_AGENTS}.`);
  }

  const teamName = args.teamName || config.defaultTeamName || DEFAULT_TEAM_NAME;

  const customAgents = (args.agentRoles || [])
    .slice(0, MAX_AGENTS)
    .map((entry) => {
      const [namePart, ...briefParts] = String(entry || "").split(":");
      return {
        name: String(namePart || "").trim(),
        brief: String(briefParts.join(":") || "").trim(),
      };
    })
    .filter((agent) => agent.name);

  return { task, agents, templateId, teamName, customAgents };
}

// ─── Confirmation before write ───────────────────────────────────────────────

async function confirmBeforeWrite(input, blueprint, workspacePath, isDryRun) {
  const clack = await import("@clack/prompts");

  const coordinator = blueprint.agents.find((a) => rolePriority(a) === 0) || blueprint.agents[0];
  const otherAgents = blueprint.agents.filter((a) => a.id !== coordinator.id);

  const lines = [
    "",
    `  ${c("Topic:", color.dim)}      ${c(input.task, color.bold)}`,
    `  ${c("Template:", color.dim)}   ${c(blueprint.templateId || "ai-generated", color.cyan)}`,
    `  ${c("Team:", color.dim)}       ${c(input.teamName, color.cyan)}`,
    `  ${c("Location:", color.dim)}   ${c(path.relative(PROJECT_ROOT, workspacePath), color.cyan)}`,
    "",
    `  ${c("Agents:", color.dim)}`,
    `    ${coordinator.emoji || "🎯"} ${c(coordinator.displayName, color.bold)} ${c("(lead)", color.dim)}`,
    ...otherAgents.map(
      (a) => `    ${a.emoji || "🤖"} ${a.displayName} ${c(`- ${a.roleSummary}`, color.dim)}`
    ),
    "",
    `  ${c("Modules:", color.dim)}`,
    ...blueprint.modules.map(
      (m) => `    ${m.emoji || "📦"} ${m.label} ${c(`- ${m.description}`, color.dim)}`
    ),
    "",
  ];

  if (isDryRun) {
    clack.log.info(`${c("Dry run preview:", color.bold, color.yellow)}\n${lines.join("\n")}`);

    const filesPreview = [
      `  workspace.json    ${c(`(${blueprint.agents.length} agents, ${blueprint.groups.length} groups)`, color.dim)}`,
      `  tasks.json        ${c(`(${blueprint.tasks.length} tasks)`, color.dim)}`,
      `  source/mission.md`,
      `  agents/           ${c(`(${blueprint.agents.length} agent prompts)`, color.dim)}`,
      `  artifacts/        ${c(`(${blueprint.modules.length} module dirs)`, color.dim)}`,
    ];

    clack.log.info(`Files that ${c("would", color.bold)} be created:\n${filesPreview.join("\n")}`);
    clack.outro(c("Dry run complete. No files written.", color.yellow));
    return false;
  }

  clack.log.info(`Ready to create workspace:\n${lines.join("\n")}`);

  const proceed = await clack.confirm({
    message: "Create workspace?",
    initialValue: true,
  });

  if (clack.isCancel(proceed) || !proceed) {
    clack.cancel("Init cancelled.");
    process.exit(0);
  }

  return true;
}

// ─── Synthesis ───────────────────────────────────────────────────────────────

function buildSynthesisPrompt({ task, agents, teamName, customAgents }) {
  const lines = [
    "Generate a domain-specialized multi-agent squad blueprint.",
    "Requirements:",
    "- Return strict JSON only that matches schema.",
    `- Target mission: ${task}`,
    `- Requested total agents: ${agents}`,
    `- Hard cap total agents: ${MAX_AGENTS}`,
    "- Include exactly one coordinator/lead role.",
    "- Create highly domain-specific agents, modules, and workflow lanes.",
    "- Avoid generic social-media assumptions unless mission requires them.",
    "- Use neutral dashboard labels suitable for Agent Squad.",
    "- Include per-agent roleSummary and executable prompt text.",
    "- Include comms types as update, insight, blocker unless mission strongly suggests extras.",
    `- Team name hint: ${teamName}`,
  ];

  if (Array.isArray(customAgents) && customAgents.length > 0) {
    lines.push("- Use the following custom agent roster as the canonical roles.");
    lines.push("- Keep the same count and order unless you must insert a coordinator/lead.");
    customAgents.forEach((agent, index) => {
      lines.push(
        `  ${index + 1}. ${agent.name}${agent.brief ? ` - ${agent.brief}` : ""}`
      );
    });
  }

  return lines.join("\n");
}

function runClaudeSynthesis(prompt) {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(BLUEPRINT_SCHEMA),
    "--tools",
    "",
    "--permission-mode",
    "plan",
    "--no-session-persistence",
    "--setting-sources",
    "local",
  ];

  const result = spawnSync("claude", args, {
    encoding: "utf-8",
    timeout: CLAUDE_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
    cwd: os.tmpdir(),
  });

  if (result.error) {
    throw result.error;
  }

  const parsedOutput = parseClaudeOutput(result.stdout);

  // Claude can sometimes return a non-zero exit while still emitting valid structured output.
  // Accept the parsed payload and let schema validation decide whether it is usable.
  if (result.status !== 0 && !parsedOutput) {
    const err = new Error(result.stderr || "Claude synthesis failed");
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    err.status = result.status;
    throw err;
  }

  return {
    rawStdout: result.stdout,
    rawStderr: result.stderr,
    status: result.status,
    parsed: parsedOutput,
  };
}

function parseClaudeOutput(stdoutText) {
  const text = String(stdoutText || "").trim();
  if (!text) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === "object") {
    if (parsed.structured_output && typeof parsed.structured_output === "object") {
      return parsed.structured_output;
    }

    if (parsed.result && typeof parsed.result === "string") {
      try {
        return JSON.parse(parsed.result);
      } catch {
        // fall through
      }
    }

    if (parsed.result && typeof parsed.result === "object") {
      if (
        parsed.result.title &&
        parsed.result.groups &&
        parsed.result.agents &&
        parsed.result.modules &&
        parsed.result.workflowLanes
      ) {
        return parsed.result;
      }
    }

    if (parsed.content && typeof parsed.content === "string") {
      try {
        return JSON.parse(parsed.content);
      } catch {
        // fall through
      }
    }

    if (parsed.type === "result" && parsed.result && typeof parsed.result === "object") {
      return parsed.result;
    }

    if (parsed.title && parsed.groups && parsed.agents) {
      return parsed;
    }
  }

  const blockMatch = text.match(/\{[\s\S]*\}/);
  if (blockMatch) {
    try {
      const extracted = JSON.parse(blockMatch[0]);
      if (extracted && typeof extracted === "object") {
        if (extracted.structured_output && typeof extracted.structured_output === "object") {
          return extracted.structured_output;
        }
        if (
          extracted.title &&
          extracted.groups &&
          extracted.agents &&
          extracted.modules &&
          extracted.workflowLanes
        ) {
          return extracted;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Synthesis with retry and interactive recovery ───────────────────────────

async function synthesizeWithRetry({ synthesisPrompt, templates, input, fallbackTemplate }) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_SYNTHESIS_RETRIES; attempt++) {
    try {
      const synthesis = runClaudeSynthesis(synthesisPrompt);
      const rawBlueprint = synthesis.parsed;
      validateBlueprintSchema(rawBlueprint);

      return {
        rawBlueprint,
        rawResponseRecord: {
          source: "claude-cli",
          stdout: synthesis.rawStdout,
          stderr: synthesis.rawStderr,
          parsed: synthesis.parsed,
        },
        fallbackInfo: {
          usedFallback: false,
          templateId: null,
          reason: null,
          requestedAgents: input.agents,
          model: "claude-cli",
        },
      };
    } catch (err) {
      lastError = err;

      if (attempt < MAX_SYNTHESIS_RETRIES) {
        // Check if we have interactive access for retry prompt
        if (process.stdin.isTTY) {
          const clack = await import("@clack/prompts");

          const retryChoice = await clack.select({
            message: `AI synthesis failed (attempt ${attempt}/${MAX_SYNTHESIS_RETRIES}): ${err.message.slice(0, 80)}`,
            options: [
              { value: "retry", label: "Retry synthesis", hint: "try again" },
              {
                value: "fallback",
                label: `Use "${fallbackTemplate.label || fallbackTemplate.id}" template`,
                hint: "best match for your topic",
              },
              { value: "pick", label: "Pick a different template", hint: "choose manually" },
            ],
          });

          if (clack.isCancel(retryChoice)) {
            clack.cancel("Init cancelled.");
            process.exit(0);
          }

          if (retryChoice === "retry") {
            continue;
          }

          if (retryChoice === "pick") {
            const templateDescriptions = getTemplateDescriptions(templates);
            const templateChoice = await clack.select({
              message: "Pick a template:",
              options: templateDescriptions.map((t) => ({
                value: t.id,
                label: t.label,
                hint: t.description,
              })),
            });

            if (clack.isCancel(templateChoice)) {
              clack.cancel("Init cancelled.");
              process.exit(0);
            }

            const chosenTemplate = templates.get(templateChoice);
            return useFallback(chosenTemplate, input, lastError);
          }

          // fallback
          return useFallback(fallbackTemplate, input, lastError);
        }
      }
    }
  }

  // All retries exhausted — use fallback
  return useFallback(fallbackTemplate, input, lastError);
}

function useFallback(template, input, error) {
  const rawBlueprint = createFallbackBlueprint({
    template,
    task: input.task,
    requestedAgents: input.agents,
  });

  return {
    rawBlueprint,
    rawResponseRecord: {
      source: "template-fallback",
      error: error ? error.message : "fallback selected",
      parsed: rawBlueprint,
    },
    fallbackInfo: {
      usedFallback: true,
      templateId: template.id,
      reason: error ? error.message : "user selected template",
      requestedAgents: input.agents,
      model: "template-fallback",
    },
  };
}

// ─── Template scoring and selection ──────────────────────────────────────────

function scoreTemplate(template, topic, templateHint) {
  const topicLower = topic.toLowerCase();
  let score = 0;

  if (templateHint && template.id === templateHint) {
    score += 100;
  }

  for (const keyword of template.keywords || []) {
    if (topicLower.includes(String(keyword).toLowerCase())) {
      score += 10;
    }
  }

  return score;
}

function selectFallbackTemplate(templates, topic, templateHint) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const template of templates.values()) {
    const score = scoreTemplate(template, topic, templateHint);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }

  return best || templates.values().next().value;
}

function pickRoles(template, requestedAgents) {
  const roleById = new Map(template.roles.map((role) => [role.id, role]));
  const selected = [];

  for (const required of template.requiredRoles || []) {
    const role = roleById.get(required);
    if (role) selected.push(role);
  }

  for (const optional of template.optionalRolePriority || []) {
    if (selected.length >= requestedAgents) break;
    const role = roleById.get(optional);
    if (role) selected.push(role);
  }

  if (selected.length > MAX_AGENTS) {
    return selected.slice(0, MAX_AGENTS);
  }

  return selected;
}

function createFallbackBlueprint({ template, task, requestedAgents }) {
  const selectedRoles = pickRoles(template, requestedAgents);

  return {
    templateId: template.id,
    title: task,
    dashboard: {
      title: "Agent Squad",
      subtitle: "Mission-driven multi-agent dashboard",
      nav: DEFAULT_NAV,
    },
    groups: template.groups,
    agents: selectedRoles.map((role) => ({ ...role })),
    modules: template.modules,
    workflowLanes: template.workflowLanes,
    comms: {
      types: ["update", "insight", "blocker"],
    },
  };
}

// ─── Blueprint normalization ─────────────────────────────────────────────────

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDashboardNav(navInput) {
  const routeAliases = {
    mission: "mission",
    home: "mission",
    overview: "summary",
    dashboard: "mission",
    pipeline: "mission",
    properties: "artifacts",
    tasks: "tasks",
    todo: "tasks",
    todos: "tasks",
    comms: "comms",
    communication: "comms",
    communications: "comms",
    coffee: "comms",
    "coffee-room": "comms",
    artifacts: "artifacts",
    artifact: "artifacts",
    content: "artifacts",
    files: "artifacts",
    documents: "artifacts",
    analytics: "analytics",
    insights: "analytics",
    reports: "analytics",
    financials: "analytics",
    closings: "tasks",
    diligence: "tasks",
    summary: "summary",
    final: "summary",
    handoff: "summary",
    report: "summary",
    help: "help",
    support: "help",
    guide: "help",
    docs: "help",
    documentation: "help",
    onboarding: "help",
  };

  const input = Array.isArray(navInput) ? navInput : [];
  const normalized = [];
  const seen = new Set();

  for (const item of input) {
    const key = slugify(String(item || "")).replace(/-/g, "");
    if (!key) continue;

    let routeId = null;
    for (const [alias, mapped] of Object.entries(routeAliases)) {
      if (key === alias.replace(/-/g, "")) {
        routeId = mapped;
        break;
      }
    }

    if (!routeId) continue;
    if (seen.has(routeId)) continue;
    seen.add(routeId);
    normalized.push(routeId);
  }

  if (normalized.length === 0) {
    return DEFAULT_NAV;
  }

  return normalized;
}

function sanitizeEntityId(input, fallback) {
  const normalized = slugify(input);
  return normalized || fallback;
}

function ensureCoordinator(blueprint) {
  const hasCoordinator = blueprint.agents.some((agent) => {
    const id = String(agent.id || "").toLowerCase();
    const display = String(agent.displayName || "").toLowerCase();
    return (
      id.includes("coordinator") ||
      id.includes("lead") ||
      display.includes("coordinator") ||
      display.includes("lead")
    );
  });

  if (hasCoordinator) return;

  const groupId = blueprint.groups[0]?.id || "lead";
  if (!blueprint.groups.find((group) => group.id === groupId)) {
    blueprint.groups.unshift({
      id: "lead",
      label: "Lead",
      description: "Coordination and strategy",
      color: "#60a5fa",
    });
  }

  blueprint.agents.unshift({
    id: "lead-coordinator",
    displayName: "Lead Coordinator",
    emoji: "🎯",
    groupId,
    roleSummary: "Coordinates execution and handles final quality checks.",
    prompt:
      "You are the Lead Coordinator. Coordinate teammates, unblock execution, and package final outputs.",
  });
}

function normalizeCustomAgentRoster(customAgents, fallbackGroupId) {
  return (customAgents || [])
    .slice(0, MAX_AGENTS)
    .map((agent, index) => {
      const fallbackName = `specialist-${index + 1}`;
      const safeName = sanitizeEntityId(agent.name, fallbackName);
      const displayName = String(agent.name || "")
        .trim()
        .replace(/\s+/g, " ");
      const brief = String(agent.brief || "").trim();

      return {
        id: safeName,
        displayName: displayName || `Specialist ${index + 1}`,
        emoji: "🤖",
        groupId: fallbackGroupId,
        roleSummary: brief || "Specialized custom agent role",
        prompt: [
          `You are ${displayName || `Specialist ${index + 1}`}.`,
          brief
            ? `Primary responsibility: ${brief}.`
            : "Primary responsibility: execute assigned mission tasks for your role.",
          "Coordinate with teammates, post updates/insights/blockers, and produce module-ready outputs.",
        ].join(" "),
        color: stringToColor(safeName),
      };
    });
}

function normalizeBlueprint(rawBlueprint, { task, requestedAgents, teamName, fallbackTemplate, customAgents }) {
  const blueprint = JSON.parse(JSON.stringify(rawBlueprint));

  blueprint.title = blueprint.title || task;

  blueprint.groups = dedupeById(
    (blueprint.groups || []).map((group, index) => ({
      ...group,
      id: sanitizeEntityId(group.id, `group-${index + 1}`),
      label: group.label || `Group ${index + 1}`,
      description: group.description || "Team grouping",
      color: group.color || "#64748b",
    }))
  );

  if (blueprint.groups.length === 0) {
    blueprint.groups = [
      {
        id: "lead",
        label: "Lead",
        description: "Coordination and strategy",
        color: "#60a5fa",
      },
    ];
  }

  const hasCustomAgents = Array.isArray(customAgents) && customAgents.length > 0;
  if (hasCustomAgents) {
    const customGroupId = "custom-specialists";
    if (!blueprint.groups.find((group) => group.id === customGroupId)) {
      blueprint.groups.push({
        id: customGroupId,
        label: "Custom Specialists",
        description: "User-defined agent roster",
        color: "#8b5cf6",
      });
    }
    blueprint.agents = normalizeCustomAgentRoster(customAgents, customGroupId);
  } else {
    blueprint.agents = dedupeById(
      (blueprint.agents || []).map((agent, index) => ({
        ...agent,
        id: sanitizeEntityId(agent.id, `agent-${index + 1}`),
        displayName: agent.displayName || `Agent ${index + 1}`,
        emoji: agent.emoji || "🤖",
        groupId: sanitizeEntityId(agent.groupId, blueprint.groups[0].id),
        roleSummary: agent.roleSummary || "Specialized agent role",
        prompt:
          agent.prompt ||
          `You are ${agent.displayName || `Agent ${index + 1}`}. Complete assigned tasks and coordinate with teammates.`,
        color: agent.color || stringToColor(agent.id || `agent-${index + 1}`),
      }))
    );
  }

  ensureCoordinator(blueprint);

  const targetCount = Math.min(MAX_AGENTS, Math.max(1, requestedAgents));
  if (blueprint.agents.length > targetCount) {
    const sorted = [...blueprint.agents].sort((a, b) => rolePriority(a) - rolePriority(b));
    blueprint.agents = sorted.slice(0, targetCount);
  }

  blueprint.modules = dedupeById(
    (blueprint.modules || []).map((module, index) => ({
      ...module,
      id: sanitizeEntityId(module.id, `module-${index + 1}`),
      label: module.label || `Module ${index + 1}`,
      emoji: module.emoji || "📦",
      description: module.description || "Module outputs",
    }))
  );

  if (blueprint.modules.length === 0) {
    blueprint.modules = [
      { id: "output", label: "Output", emoji: "📦", description: "Primary mission outputs" },
    ];
  }

  blueprint.workflowLanes = dedupeById(
    (blueprint.workflowLanes || []).map((lane, index) => ({
      ...lane,
      id: sanitizeEntityId(lane.id, `lane-${index + 1}`),
      label: lane.label || `Lane ${index + 1}`,
      description: lane.description || "Workflow stage",
    }))
  );

  if (blueprint.workflowLanes.length === 0) {
    blueprint.workflowLanes = [
      { id: "execute", label: "Execute", description: "Run mission tasks" },
    ];
  }

  blueprint.dashboard = {
    title: blueprint.dashboard?.title || "Agent Squad",
    subtitle: blueprint.dashboard?.subtitle || "Mission-driven multi-agent dashboard",
    nav: normalizeDashboardNav(blueprint.dashboard?.nav),
    summaryFile: blueprint.dashboard?.summaryFile || "artifacts/summary/summary.md",
  };

  blueprint.comms = {
    file: blueprint.comms?.file || "~/.claude/teams/{teamName}/team-feed.jsonl",
    types:
      Array.isArray(blueprint.comms?.types) && blueprint.comms.types.length > 0
        ? blueprint.comms.types
        : ["update", "insight", "blocker"],
  };

  blueprint.templateId = blueprint.templateId || fallbackTemplate?.id || "ai-generated";
  blueprint.teamName = teamName;

  if (!Array.isArray(blueprint.tasks) || blueprint.tasks.length === 0) {
    blueprint.tasks = buildDefaultTasks(blueprint);
  }

  return blueprint;
}

function rolePriority(agent) {
  const id = String(agent.id || "").toLowerCase();
  const display = String(agent.displayName || "").toLowerCase();
  if (id.includes("lead") || id.includes("coordinator") || display.includes("lead")) return 0;
  if (id.includes("architect") || id.includes("strateg") || id.includes("review")) return 1;
  return 2;
}

// ─── Task generation ─────────────────────────────────────────────────────────

function buildDefaultTasks(blueprint) {
  const lanes = blueprint.workflowLanes;
  const firstLane = lanes[0]?.id || "execute";
  const reviewLane = lanes[Math.min(2, lanes.length - 1)]?.id || firstLane;
  const coordinator =
    blueprint.agents.find((agent) => rolePriority(agent) === 0) || blueprint.agents[0];

  const tasks = [];
  tasks.push({
    id: "task-001",
    subject: `Mission intake: ${blueprint.title}`,
    description: "Clarify scope, outcomes, and dependencies.",
    status: "pending",
    assignee: coordinator.id,
    blockedBy: [],
    blocks: [],
    lane: firstLane,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });

  let counter = 2;
  for (const agent of blueprint.agents) {
    if (agent.id === coordinator.id) continue;
    const taskId = `task-${String(counter).padStart(3, "0")}`;
    tasks.push({
      id: taskId,
      subject: `${agent.displayName}: Produce assigned deliverables`,
      description: agent.roleSummary,
      status: "pending",
      assignee: agent.id,
      blockedBy: ["task-001"],
      blocks: [],
      lane: firstLane,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    counter += 1;
  }

  tasks.push({
    id: `task-${String(counter).padStart(3, "0")}`,
    subject: "Final review and package handoff",
    description: "Consolidate module outputs and validate readiness.",
    status: "pending",
    assignee: coordinator.id,
    blockedBy: tasks.slice(1).map((task) => task.id),
    blocks: [],
    lane: reviewLane,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });

  return tasks;
}

// ─── Workspace writing ───────────────────────────────────────────────────────

function buildWorkspaceManifest({ blueprint, workspaceId, title, teamName }) {
  return {
    schemaVersion: "1.0",
    workspace: {
      id: workspaceId,
      title,
      slug: workspaceId.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
      createdAt: new Date().toISOString(),
      templateId: blueprint.templateId,
    },
    team: {
      name: teamName,
      maxAgents: MAX_AGENTS,
    },
    dashboard: {
      ...blueprint.dashboard,
      workflowLanes: blueprint.workflowLanes,
      summaryFile: blueprint.dashboard?.summaryFile || "artifacts/summary/summary.md",
    },
    groups: blueprint.groups,
    agents: blueprint.agents.map((agent) => ({
      id: agent.id,
      displayName: agent.displayName,
      emoji: agent.emoji,
      color: agent.color || stringToColor(agent.id),
      groupId: agent.groupId,
      roleSummary: agent.roleSummary,
      promptFile: `agents/${agent.id}.md`,
      active: true,
    })),
    modules: blueprint.modules.map((module) => ({
      ...module,
      path: `artifacts/${module.id}`,
    })),
    workflowLanes: blueprint.workflowLanes,
    comms: {
      file: "~/.claude/teams/{teamName}/team-feed.jsonl",
      types: blueprint.comms.types,
    },
  };
}

function buildWorkspaceFolderName(title) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title) || "mission";
  return `${date}-${slug}`;
}

function ensureUniqueWorkspacePath(baseDir, folderName) {
  let candidate = path.join(baseDir, folderName);
  if (!fs.existsSync(candidate)) return candidate;

  const suffix = new Date().toISOString().replace(/[:.]/g, "").slice(11, 17);
  candidate = path.join(baseDir, `${folderName}-${suffix}`);
  return candidate;
}

function resolveCommsFile(manifest) {
  const teamName = manifest.team.name;
  let file = manifest.comms.file || "~/.claude/teams/{teamName}/team-feed.jsonl";
  file = file.replaceAll("{teamName}", teamName);

  if (file.startsWith("~/")) {
    file = path.join(os.homedir(), file.slice(2));
  }

  return file;
}

function writeWorkspace({ manifest, blueprint, title, fallbackInfo, audit }) {
  ensureDir(WORKSPACES_ROOT);

  const folderName = buildWorkspaceFolderName(title);
  const workspacePath = ensureUniqueWorkspacePath(WORKSPACES_ROOT, folderName);
  const workspaceId = path.basename(workspacePath);

  ensureDir(workspacePath);
  ensureDir(path.join(workspacePath, "source"));
  ensureDir(path.join(workspacePath, "agents"));
  ensureDir(path.join(workspacePath, "artifacts"));
  ensureDir(path.join(workspacePath, ".agentsquad"));

  const nextManifest = {
    ...manifest,
    workspace: {
      ...manifest.workspace,
      id: workspaceId,
      slug: workspaceId.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
    },
  };

  // Write mission source
  fs.writeFileSync(
    path.join(workspacePath, "source", "mission.md"),
    `# ${title}\n\nCreated: ${new Date().toISOString()}\n\n## Mission\n\n${title}\n`,
    "utf-8"
  );

  // Write tasks
  fs.writeFileSync(
    path.join(workspacePath, "tasks.json"),
    `${JSON.stringify(blueprint.tasks, null, 2)}\n`,
    "utf-8"
  );

  // Write prompts
  for (const agent of blueprint.agents) {
    const promptText = String(agent.prompt || "").trim();
    const hasRoleSummarySection = /^##\s+Role Summary\b/im.test(promptText);
    const promptParts = [];

    if (promptText) {
      promptParts.push(promptText);
    } else {
      promptParts.push(`# ${agent.displayName}`);
    }

    if (!hasRoleSummarySection) {
      promptParts.push(`## Role Summary\n${agent.roleSummary}`);
    }

    const promptBody = `${promptParts.join("\n\n").trim()}\n`;
    fs.writeFileSync(
      path.join(workspacePath, "agents", `${agent.id}.md`),
      promptBody,
      "utf-8"
    );
  }

  // Create module directories
  for (const module of nextManifest.modules) {
    ensureDir(path.join(workspacePath, module.path));
  }

  // Ensure summary file path exists for quick access
  const summaryPath = path.join(
    workspacePath,
    (nextManifest.dashboard?.summaryFile || "artifacts/summary/summary.md").replace(/^\/+/, "")
  );
  ensureDir(path.dirname(summaryPath));
  if (!fs.existsSync(summaryPath)) {
    fs.writeFileSync(summaryPath, `# Final Summary\n\n(Write the final summary here.)\n`, "utf-8");
  }

  // Write manifest
  fs.writeFileSync(
    path.join(workspacePath, "workspace.json"),
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    "utf-8"
  );

  // Write audit files
  fs.writeFileSync(
    path.join(workspacePath, ".agentsquad", "blueprint.request.json"),
    `${JSON.stringify(audit.request, null, 2)}\n`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(workspacePath, ".agentsquad", "blueprint.response.json"),
    `${JSON.stringify(audit.response, null, 2)}\n`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(workspacePath, ".agentsquad", "blueprint.validated.json"),
    `${JSON.stringify(blueprint, null, 2)}\n`,
    "utf-8"
  );

  const meta = {
    createdAt: new Date().toISOString(),
    synthesisMode: fallbackInfo.usedFallback ? "template-fallback" : "ai-synthesis",
    fallbackUsed: fallbackInfo.usedFallback,
    fallbackTemplate: fallbackInfo.templateId || null,
    fallbackReason: fallbackInfo.reason || null,
    requestedAgents: fallbackInfo.requestedAgents,
    appliedAgents: blueprint.agents.length,
    model: fallbackInfo.model || "claude-cli",
  };

  fs.writeFileSync(
    path.join(workspacePath, ".agentsquad", "synthesis.meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf-8"
  );

  // Write kickoff prompt to file
  const kickoffPrompt = buildKickoffPrompt(nextManifest, workspacePath);
  fs.writeFileSync(
    path.join(workspacePath, ".agentsquad", "kickoff-prompt.txt"),
    kickoffPrompt,
    "utf-8"
  );

  // Ensure comms file exists
  const commsFile = resolveCommsFile(nextManifest);
  ensureDir(path.dirname(commsFile));
  if (!fs.existsSync(commsFile)) {
    fs.writeFileSync(
      commsFile,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        workspaceId,
        agent: "system",
        type: "update",
        message: `Team initialized for mission: ${title}`,
      })}\n`,
      "utf-8"
    );
  }

  return { workspacePath, workspaceId, manifest: nextManifest, meta };
}

function stringToColor(value) {
  const source = String(value || "");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}

// ─── Kickoff prompt builder ──────────────────────────────────────────────────

function buildKickoffPrompt(manifest, workspacePath) {
  const workspaceRelative = path.relative(PROJECT_ROOT, workspacePath);
  return [
    "Start Agent Squad workflow for workspace:",
    workspaceRelative,
    "",
    "Load:",
    "- workspace.json",
    "- tasks.json",
    "- source/mission.md",
    "- agents/*.md",
    "",
    "Then:",
    "1) Assign each pending task to the correct agent role.",
    "2) Begin execution in workflow-lane order.",
    `3) Post all progress updates to ~/.claude/teams/${manifest.team.name}/team-feed.jsonl as JSONL events with fields: timestamp, workspaceId (${manifest.workspace.id}), agent, type (update/insight/blocker), message.`,
    "4) Write outputs into the corresponding artifacts/{module-id}/ folders.",
    "5) Mark tasks complete in tasks.json as work finishes.",
  ].join("\n");
}

// ─── Post-init summary (polished output) ─────────────────────────────────────

async function printSummary({ workspacePath, manifest, meta }) {
  const clack = await import("@clack/prompts");
  const workspaceRelative = path.relative(PROJECT_ROOT, workspacePath);
  const kickoffPromptPath = path.join(workspacePath, ".agentsquad", "kickoff-prompt.txt");
  const kickoffRelative = path.relative(PROJECT_ROOT, kickoffPromptPath);

  if (meta.fallbackUsed) {
    clack.log.warn(
      `Used template fallback: ${c(meta.fallbackTemplate, color.yellow)}\n` +
        `  Reason: ${c(meta.fallbackReason, color.dim)}`
    );
  }

  // Agents list
  const agentLines = manifest.agents
    .map((a) => `  ${a.emoji || "🤖"} ${c(a.displayName, color.bold)} ${c(`(${a.id})`, color.dim)}`)
    .join("\n");

  // Modules list
  const moduleLines = manifest.modules
    .map((m) => `  ${m.emoji || "📦"} ${c(m.label, color.bold)} ${c(`(${m.id})`, color.dim)}`)
    .join("\n");

  clack.log.success(
    `${c("Workspace created!", color.bold, color.green)}\n\n` +
      `  ${c("Location:", color.dim)}   ${c(workspaceRelative, color.cyan)}\n` +
      `  ${c("Team:", color.dim)}       ${c(manifest.team.name, color.cyan)}\n` +
      `  ${c("Synthesis:", color.dim)}   ${c(meta.synthesisMode, color.cyan)}\n\n` +
      `  ${c("Agents:", color.dim)}\n${agentLines}\n\n` +
      `  ${c("Modules:", color.dim)}\n${moduleLines}`
  );

  // Next steps as a numbered checklist
  clack.log.info(
    `${c("What to do next:", color.bold)}\n\n` +
      `  ${c("1.", color.cyan)} Start the dashboard:     ${c("npm run start", color.green)}\n` +
      `  ${c("2.", color.cyan)} Open in browser:         ${c("http://localhost:5173", color.green)}\n` +
      `  ${c("3.", color.cyan)} Kick off (safe mode):    ${c("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process", color.green)}\n` +
      `  ${c("4.", color.cyan)} Autonomous (${c("dangerous", color.yellow)}): ${c("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process --dangerously-skip-permissions", color.green)}\n\n` +
      `  Kickoff prompt saved to:\n` +
      `  ${c(kickoffRelative, color.cyan)}`
  );

  clack.outro(c("Ready to go!", color.bold, color.green));
}

// ─── Schema validation ───────────────────────────────────────────────────────

function validateBlueprintSchema(blueprint) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(BLUEPRINT_SCHEMA);
  const valid = validate(blueprint);

  if (!valid) {
    const detail = (validate.errors || [])
      .map((err) => `${err.instancePath || "/"}: ${err.message}`)
      .join("; ");
    throw new Error(`Blueprint schema validation failed: ${detail}`);
  }
}

function assertAgentCap(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_AGENTS) {
    throw new Error(`Agent count must be an integer between 1 and ${MAX_AGENTS}.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Help flag
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    const templates = loadTemplates();
    const config = loadConfig();

    // Determine input mode
    let input;
    const isInteractive = process.stdin.isTTY && !args.quick;
    const hasAllFlags = args.task;

    if (isInteractive && (!hasAllFlags || args.wizard)) {
      // Interactive wizard
      input = await gatherInput(args, templates, config);
    } else if (args.quick || hasAllFlags) {
      // Non-interactive: use flags + smart defaults
      input = gatherFromFlags(args, templates, config);

      // Show what was auto-configured in quick mode
      if (args.quick) {
        const clack = await import("@clack/prompts");
        clack.intro(c(" Agent Squad Init ", color.bold, color.bgBlue, color.white));
      }
    } else {
      // Fallback: try interactive if TTY, else error
      if (process.stdin.isTTY) {
        input = await gatherInput(args, templates, config);
      } else {
        throw new Error(
          'Missing mission topic. Use: npm run init -- -t "your topic"\nOr run interactively: npm run init'
        );
      }
    }

    assertAgentCap(input.agents);

    const requestPayload = {
      topic: input.task,
      requestedAgents: input.agents,
      templateHint: input.templateId || null,
      teamName: input.teamName,
      customAgents: Array.isArray(input.customAgents) ? input.customAgents : [],
      maxAgents: MAX_AGENTS,
      schemaVersion: "1.0",
    };

    const synthesisPrompt = buildSynthesisPrompt({
      task: input.task,
      agents: input.agents,
      teamName: input.teamName,
      customAgents: input.customAgents,
    });

    const fallbackTemplate = selectFallbackTemplate(templates, input.task, input.templateId);

    // Run synthesis with spinner
    let synthesisResult;
    if (process.stdin.isTTY) {
      const clack = await import("@clack/prompts");
      const s = clack.spinner();
      s.start("Generating your agent team...");

      synthesisResult = await synthesizeWithRetry({
        synthesisPrompt,
        templates,
        input,
        fallbackTemplate,
      });

      s.stop(
        synthesisResult.fallbackInfo.usedFallback
          ? `Using ${c(synthesisResult.fallbackInfo.templateId, color.yellow)} template`
          : c("AI synthesis complete", color.green)
      );
    } else {
      synthesisResult = await synthesizeWithRetry({
        synthesisPrompt,
        templates,
        input,
        fallbackTemplate,
      });
    }

    const { rawBlueprint, rawResponseRecord, fallbackInfo } = synthesisResult;

    const normalizedBlueprint = normalizeBlueprint(rawBlueprint, {
      task: input.task,
      requestedAgents: input.agents,
      teamName: input.teamName,
      fallbackTemplate,
      customAgents: input.customAgents,
    });

    if (normalizedBlueprint.agents.length > MAX_AGENTS) {
      normalizedBlueprint.agents = normalizedBlueprint.agents.slice(0, MAX_AGENTS);
    }

    const tentativeWorkspaceId = buildWorkspaceFolderName(input.task);
    const manifest = buildWorkspaceManifest({
      blueprint: normalizedBlueprint,
      workspaceId: tentativeWorkspaceId,
      title: input.task,
      teamName: input.teamName,
    });

    // Compute workspace path for confirmation
    ensureDir(WORKSPACES_ROOT);
    const folderName = buildWorkspaceFolderName(input.task);
    const workspacePath = ensureUniqueWorkspacePath(WORKSPACES_ROOT, folderName);

    // Confirmation before write (or dry-run preview)
    if (process.stdin.isTTY) {
      const shouldWrite = await confirmBeforeWrite(
        input,
        normalizedBlueprint,
        workspacePath,
        args.dryRun
      );
      if (!shouldWrite) {
        process.exit(0);
      }
    } else if (args.dryRun) {
      // Non-interactive dry run
      console.log("\nDry run — no files written\n");
      console.log(`Would create: ${path.relative(PROJECT_ROOT, workspacePath)}/`);
      console.log(`  workspace.json    (${normalizedBlueprint.agents.length} agents, ${normalizedBlueprint.groups.length} groups)`);
      console.log(`  tasks.json        (${normalizedBlueprint.tasks.length} tasks)`);
      console.log(`  source/mission.md`);
      console.log(`  agents/           (${normalizedBlueprint.agents.length} agent prompts)`);
      console.log(`  artifacts/        (${normalizedBlueprint.modules.length} module dirs)`);
      process.exit(0);
    }

    const result = writeWorkspace({
      manifest,
      blueprint: normalizedBlueprint,
      title: input.task,
      fallbackInfo,
      audit: {
        request: {
          ...requestPayload,
          prompt: synthesisPrompt,
          schema: BLUEPRINT_SCHEMA,
        },
        response: rawResponseRecord,
      },
    });

    await printSummary(result);
  } catch (err) {
    try {
      const clack = await import("@clack/prompts");
      clack.log.error(err.message);
      clack.outro(c("Initialization failed.", color.red));
    } catch {
      console.error(`\nInitialization failed: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
