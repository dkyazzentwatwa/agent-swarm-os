export const THEME_STORAGE_KEY = "dashboard-theme";

export const THEME_OPTIONS = [
  { id: "vscode-dark-plus", label: "VS Code Dark+" },
  { id: "one-dark-pro", label: "One Dark Pro" },
  { id: "dracula", label: "Dracula" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "monokai", label: "Monokai" },
  { id: "github-dark", label: "GitHub Dark" },
  { id: "vscode-light-plus", label: "VS Code Light+" },
];

export const DEFAULT_THEME_ID = "vscode-dark-plus";

export function getThemeIndexById(themeId) {
  const index = THEME_OPTIONS.findIndex((theme) => theme.id === themeId);
  return index >= 0 ? index : 0;
}
