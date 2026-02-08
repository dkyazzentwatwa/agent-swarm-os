import { cn } from "@/lib/utils";

export function Panel({ title, description, headerAction, className, bodyClassName, children }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || description || headerAction) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            {title ? <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p> : null}
          </div>
          {headerAction ? <div>{headerAction}</div> : null}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
