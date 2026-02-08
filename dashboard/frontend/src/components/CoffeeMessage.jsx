import { AgentAvatar } from "./AgentAvatar";
import { timeAgo, titleFromId } from "@/lib/utils";

export function CoffeeMessage({ message, agentsById = {}, showAvatar = true }) {
  const agent = agentsById[message.agent] || null;
  const displayName = agent?.display || titleFromId(message.agent);

  const badgeClass =
    message.type === "insight"
      ? "bg-[color-mix(in_srgb,var(--status-warn)_18%,transparent)] text-[var(--status-warn)]"
      : message.type === "blocker"
      ? "bg-[color-mix(in_srgb,var(--status-error)_18%,transparent)] text-[var(--status-error)]"
      : "bg-[var(--surface-3)] text-[var(--text-secondary)]";

  return (
    <article className="flex items-start gap-3 py-2">
      {showAvatar ? (
        <AgentAvatar agent={message.agent} size="md" emoji={agent?.emoji} color={agent?.color} />
      ) : (
        <div className="w-9 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {showAvatar ? (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{displayName}</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {message.timestamp ? timeAgo(message.timestamp) : ""}
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
              {message.type}
            </span>
          </div>
        ) : null}
        <p className="text-sm leading-relaxed text-[var(--text-primary)]">{message.message}</p>
      </div>
    </article>
  );
}
