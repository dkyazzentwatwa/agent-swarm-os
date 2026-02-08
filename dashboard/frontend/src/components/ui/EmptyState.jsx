import { cn } from "@/lib/utils";

const PRESETS = {
  tasks: { icon: "☑️", title: "No tasks yet", description: "Tasks will appear here when agents start working" },
  agents: { icon: "🤖", title: "No agents", description: "Start an agent team to see them here" },
  content: { icon: "📝", title: "No content yet", description: "Start by providing an idea to the Content Strategist" },
  messages: { icon: "☕", title: "No messages", description: "Coffee room messages will appear here" },
  activity: { icon: "📊", title: "No activity", description: "Start an agent team to see updates here" },
  search: { icon: "🔍", title: "No results", description: "Try adjusting your search or filters" },
};

export function EmptyState({ preset, icon, title, description, action, className }) {
  const presetData = preset ? PRESETS[preset] : {};
  const displayIcon = icon || presetData.icon || "📦";
  const displayTitle = title || presetData.title || "Nothing here";
  const displayDescription = description || presetData.description;

  return (
    <div className={cn("py-10 text-center", className)}>
      <p className="mb-3 text-4xl" aria-hidden="true">{displayIcon}</p>
      <h3 className="mb-1 text-lg font-medium text-[var(--text-primary)]">{displayTitle}</h3>
      {displayDescription ? (
        <p className="mx-auto max-w-sm text-sm text-[var(--text-secondary)]">{displayDescription}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
