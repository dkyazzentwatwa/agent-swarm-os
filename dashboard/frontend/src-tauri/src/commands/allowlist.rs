use std::path::{Path, PathBuf};
use std::process::Output;
use thiserror::Error;
use tokio::process::Command;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Command not allowed: {0}")]
    NotAllowed(String),

    #[error("Invalid command format: {0}")]
    InvalidFormat(String),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum GitSubcommand {
    Status,
    Log { max_count: Option<u32> },
    Diff { file: Option<String> },
    Branch { list: bool },
    Show { commit: Option<String> },
}

#[derive(Debug, Clone, PartialEq)]
pub enum AllowedCommand {
    Claude {
        args: Vec<String>,
    },
    Git {
        subcommand: GitSubcommand,
        args: Vec<String>,
    },
    Ls {
        path: PathBuf,
        args: Vec<String>,
    },
    Cat {
        file: PathBuf,
    },
    Pwd,
}

impl AllowedCommand {
    /// Validate and parse a raw command string into an AllowedCommand
    pub fn validate(raw: &str) -> Result<Self, CommandError> {
        let raw = raw.trim();
        if raw.is_empty() {
            return Err(CommandError::InvalidFormat("Command cannot be empty".to_string()));
        }

        // Split command into parts, respecting quotes
        let parts = Self::parse_command_parts(raw)?;
        if parts.is_empty() {
            return Err(CommandError::InvalidFormat("No command found".to_string()));
        }

        let cmd = &parts[0];
        let args = &parts[1..];

        match cmd.as_str() {
            "claude" => Self::validate_claude(args),
            "git" => Self::validate_git(args),
            "ls" => Self::validate_ls(args),
            "cat" => Self::validate_cat(args),
            "pwd" => {
                if !args.is_empty() {
                    return Err(CommandError::InvalidFormat("pwd takes no arguments".to_string()));
                }
                Ok(AllowedCommand::Pwd)
            }
            _ => Err(CommandError::NotAllowed(format!("Command '{}' is not in the allowlist", cmd))),
        }
    }

    /// Execute the validated command
    pub async fn execute(&self, cwd: &Path) -> Result<Output, CommandError> {
        match self {
            AllowedCommand::Claude { args } => {
                let mut cmd = Command::new("claude");
                cmd.args(args);
                cmd.current_dir(cwd);
                cmd.output()
                    .await
                    .map_err(|e| CommandError::ExecutionFailed(e.to_string()))
            }
            AllowedCommand::Git { subcommand, args } => {
                let mut cmd = Command::new("git");

                match subcommand {
                    GitSubcommand::Status => {
                        cmd.arg("status");
                    }
                    GitSubcommand::Log { max_count } => {
                        cmd.arg("log");
                        if let Some(count) = max_count {
                            cmd.arg(format!("--max-count={}", count));
                        }
                    }
                    GitSubcommand::Diff { file } => {
                        cmd.arg("diff");
                        if let Some(f) = file {
                            cmd.arg(f);
                        }
                    }
                    GitSubcommand::Branch { list } => {
                        cmd.arg("branch");
                        if *list {
                            cmd.arg("--list");
                        }
                    }
                    GitSubcommand::Show { commit } => {
                        cmd.arg("show");
                        if let Some(c) = commit {
                            cmd.arg(c);
                        }
                    }
                }

                cmd.args(args);
                cmd.current_dir(cwd);
                cmd.output()
                    .await
                    .map_err(|e| CommandError::ExecutionFailed(e.to_string()))
            }
            AllowedCommand::Ls { path, args } => {
                let mut cmd = Command::new("ls");
                cmd.args(args);
                cmd.arg(path);
                cmd.current_dir(cwd);
                cmd.output()
                    .await
                    .map_err(|e| CommandError::ExecutionFailed(e.to_string()))
            }
            AllowedCommand::Cat { file } => {
                let mut cmd = Command::new("cat");
                cmd.arg(file);
                cmd.current_dir(cwd);
                cmd.output()
                    .await
                    .map_err(|e| CommandError::ExecutionFailed(e.to_string()))
            }
            AllowedCommand::Pwd => {
                let mut cmd = Command::new("pwd");
                cmd.current_dir(cwd);
                cmd.output()
                    .await
                    .map_err(|e| CommandError::ExecutionFailed(e.to_string()))
            }
        }
    }

    /// Parse command string into parts, respecting quotes
    fn parse_command_parts(raw: &str) -> Result<Vec<String>, CommandError> {
        let mut parts = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut chars = raw.chars().peekable();

        while let Some(c) = chars.next() {
            match c {
                '"' | '\'' => {
                    in_quotes = !in_quotes;
                }
                ' ' | '\t' if !in_quotes => {
                    if !current.is_empty() {
                        parts.push(current.clone());
                        current.clear();
                    }
                }
                '\\' if in_quotes => {
                    // Handle escape sequences
                    if let Some(next) = chars.next() {
                        current.push(next);
                    }
                }
                // Detect command injection patterns
                ';' | '|' | '&' | '$' | '`' | '>' | '<' if !in_quotes => {
                    return Err(CommandError::InvalidFormat(
                        format!("Shell metacharacter '{}' not allowed", c)
                    ));
                }
                _ => {
                    current.push(c);
                }
            }
        }

        if in_quotes {
            return Err(CommandError::InvalidFormat("Unclosed quote".to_string()));
        }

        if !current.is_empty() {
            parts.push(current);
        }

        Ok(parts)
    }

    fn validate_claude(args: &[String]) -> Result<Self, CommandError> {
        // Validate allowed claude flags
        let allowed_flags = [
            "--help", "-h",
            "--version", "-v",
            "--teammate-mode",
            "--project",
            "--config",
            "--dangerously-skip-permissions",
            "-p", "--prompt",
            "--cwd",
            "-m", "--model",
        ];

        for arg in args {
            if arg.starts_with('-') && !allowed_flags.contains(&arg.as_str()) {
                return Err(CommandError::NotAllowed(
                    format!("Claude flag '{}' not allowed", arg)
                ));
            }
        }

        Ok(AllowedCommand::Claude { args: args.to_vec() })
    }

    fn validate_git(args: &[String]) -> Result<Self, CommandError> {
        if args.is_empty() {
            return Err(CommandError::InvalidFormat("Git subcommand required".to_string()));
        }

        let subcommand = match args[0].as_str() {
            "status" => GitSubcommand::Status,
            "log" => {
                let max_count = args.iter()
                    .find(|a| a.starts_with("--max-count="))
                    .and_then(|a| a.strip_prefix("--max-count="))
                    .and_then(|n| n.parse().ok());
                GitSubcommand::Log { max_count }
            }
            "diff" => {
                let file = args.get(1).map(|s| s.to_string());
                GitSubcommand::Diff { file }
            }
            "branch" => {
                let list = args.contains(&"--list".to_string());
                GitSubcommand::Branch { list }
            }
            "show" => {
                let commit = args.get(1).map(|s| s.to_string());
                GitSubcommand::Show { commit }
            }
            other => return Err(CommandError::NotAllowed(
                format!("Git subcommand '{}' not allowed", other)
            )),
        };

        Ok(AllowedCommand::Git {
            subcommand,
            args: args[1..].to_vec(),
        })
    }

    fn validate_ls(args: &[String]) -> Result<Self, CommandError> {
        // Extract path (last non-flag argument or current directory)
        let path = args.iter()
            .filter(|a| !a.starts_with('-'))
            .last()
            .map(|p| PathBuf::from(p))
            .unwrap_or_else(|| PathBuf::from("."));

        // Validate path doesn't try to escape
        if let Some(path_str) = path.to_str() {
            if path_str.contains("..") {
                return Err(CommandError::InvalidPath(
                    "Path traversal not allowed".to_string()
                ));
            }
        }

        // Only allow safe flags
        let safe_flags = ["-l", "-a", "-h", "-la", "-lh", "-lah"];
        let flags: Vec<String> = args.iter()
            .filter(|a| a.starts_with('-'))
            .cloned()
            .collect();

        for flag in &flags {
            if !safe_flags.contains(&flag.as_str()) {
                return Err(CommandError::NotAllowed(
                    format!("ls flag '{}' not allowed", flag)
                ));
            }
        }

        Ok(AllowedCommand::Ls { path, args: flags })
    }

    fn validate_cat(args: &[String]) -> Result<Self, CommandError> {
        if args.len() != 1 {
            return Err(CommandError::InvalidFormat(
                "cat requires exactly one file argument".to_string()
            ));
        }

        let file = PathBuf::from(&args[0]);

        // Validate path doesn't try to escape
        if let Some(path_str) = file.to_str() {
            if path_str.contains("..") {
                return Err(CommandError::InvalidPath(
                    "Path traversal not allowed".to_string()
                ));
            }
        }

        Ok(AllowedCommand::Cat { file })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejects_command_injection() {
        let malicious = [
            "ls; rm -rf /",
            "cat file && cat /etc/passwd",
            "git status | grep secret",
            "claude --version && whoami",
            "ls $(whoami)",
            "cat `id`",
            "ls > /tmp/out",
            "git status < /dev/null",
        ];

        for cmd in malicious {
            assert!(
                AllowedCommand::validate(cmd).is_err(),
                "Should reject: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_allows_safe_commands() {
        let safe = [
            "claude --help",
            "git status",
            "git log --max-count=10",
            "ls -la",
            "cat workspace.json",
            "pwd",
        ];

        for cmd in safe {
            assert!(
                AllowedCommand::validate(cmd).is_ok(),
                "Should allow: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_rejects_disallowed_commands() {
        let disallowed = [
            "rm -rf /",
            "curl http://evil.com",
            "wget http://malware.com",
            "python -c 'import os; os.system(\"ls\")'",
            "node -e 'require(\"child_process\").exec(\"ls\")'",
        ];

        for cmd in disallowed {
            assert!(
                AllowedCommand::validate(cmd).is_err(),
                "Should reject: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_path_traversal_prevention() {
        assert!(AllowedCommand::validate("ls ../../../etc").is_err());
        assert!(AllowedCommand::validate("cat ../../passwd").is_err());
    }

    #[test]
    fn test_quote_handling() {
        let result = AllowedCommand::validate("git diff \"my file.txt\"");
        assert!(result.is_ok());
    }
}
