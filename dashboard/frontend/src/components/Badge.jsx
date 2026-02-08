import { cn } from "@/lib/utils";

const VARIANTS = {
  default: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
  success: "bg-[color-mix(in_srgb,var(--status-success)_16%,transparent)] text-[var(--status-success)]",
  warning: "bg-[color-mix(in_srgb,var(--status-warn)_18%,transparent)] text-[var(--status-warn)]",
  error: "bg-[color-mix(in_srgb,var(--status-error)_18%,transparent)] text-[var(--status-error)]",
  info: "bg-[color-mix(in_srgb,var(--status-info)_16%,transparent)] text-[var(--status-info)]",
  purple: "bg-[color-mix(in_srgb,var(--chart-series-4)_18%,transparent)] text-[var(--chart-series-4)]",
};

const SIZES = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
  lg: "px-2.5 py-1 text-sm",
};

export function Badge({ children, variant = "default", size = "sm", dot, dotColor, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotColor || "bg-current opacity-60")} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const config = {
    pending: { variant: "default", label: "Pending" },
    in_progress: { variant: "info", label: "In Progress", dot: true, dotColor: "bg-[var(--status-info)] animate-pulse" },
    completed: { variant: "success", label: "Completed" },
    blocked: { variant: "error", label: "Blocked" },
    working: { variant: "success", label: "Working", dot: true, dotColor: "bg-[var(--status-success)] animate-pulse" },
    idle: { variant: "default", label: "Idle" },
    waiting: { variant: "warning", label: "Waiting", dot: true, dotColor: "bg-[var(--status-warn)] animate-pulse" },
  };

  const { variant, label, dot, dotColor } = config[status] || config.pending;

  return (
    <Badge variant={variant} dot={dot} dotColor={dotColor}>
      {label}
    </Badge>
  );
}
