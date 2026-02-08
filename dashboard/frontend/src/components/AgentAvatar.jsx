import { cn, stringToColor } from "@/lib/utils";

export function AgentAvatar({ agent, size = "md", emoji, color }) {
  const sizeClasses = {
    sm: "w-7 h-7 text-sm",
    md: "w-9 h-9 text-lg",
    lg: "w-12 h-12 text-2xl",
  };

  const agentId = typeof agent === "string" ? agent : agent?.name || agent?.id || "agent";
  const resolvedEmoji = emoji || (typeof agent === "object" ? agent?.emoji : null) || "🤖";
  const resolvedColor = color || (typeof agent === "object" ? agent?.color : null) || stringToColor(agentId);

  return (
    <div
      className={cn("rounded-full flex items-center justify-center shrink-0", sizeClasses[size])}
      style={{ backgroundColor: resolvedColor }}
      title={agentId}
    >
      <span className="leading-none filter drop-shadow-sm">{resolvedEmoji}</span>
    </div>
  );
}
