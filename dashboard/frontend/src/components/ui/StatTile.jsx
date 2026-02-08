import { cn } from "@/lib/utils";

/**
 * StatTile component - displays a statistic with optional interactivity
 * When onClick is provided, renders as an accessible button
 * Otherwise renders as a non-interactive div
 */
export function StatTile({ label, value, helper, icon, status = "neutral", className, onClick }) {
  const statusDotClass = {
    success: "bg-[var(--status-success)]",
    warning: "bg-[var(--status-warn)]",
    error: "bg-[var(--status-error)]",
    info: "bg-[var(--status-info)]",
    neutral: "bg-[var(--text-tertiary)]",
  }[status];

  // Use button for interactive tiles, div for display-only
  const Component = onClick ? 'button' : 'div';

  // Build accessible label for interactive tiles
  const ariaLabel = onClick
    ? `${label}: ${value}${helper ? `. ${helper}` : ''}`
    : undefined;

  return (
    <Component
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-left",
        onClick && "w-full cursor-pointer transition-colors hover:bg-[var(--interactive-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[var(--text-secondary)]" aria-hidden={!!onClick}>
          {icon}
        </span>
        <span className={cn("h-2 w-2 rounded-full", statusDotClass)} aria-hidden="true" />
      </div>
      <p className="text-xl font-semibold leading-tight text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{label}</p>
      {helper ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{helper}</p> : null}
    </Component>
  );
}
