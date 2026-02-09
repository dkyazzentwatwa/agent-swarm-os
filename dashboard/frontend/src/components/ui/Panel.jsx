import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";

export function Panel({
  title,
  description,
  headerAction,
  className,
  bodyClassName,
  children,
  collapsible = false,
  defaultCollapsed = false,
  storageKey = null
}) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!collapsible) return false;
    if (storageKey) {
      return storage.get(storageKey, defaultCollapsed);
    }
    return defaultCollapsed;
  });

  useEffect(() => {
    if (collapsible && storageKey) {
      storage.set(storageKey, isCollapsed);
    }
  }, [isCollapsed, collapsible, storageKey]);

  const toggleCollapsed = () => {
    if (collapsible) {
      setIsCollapsed(prev => !prev);
    }
  };

  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || description || headerAction) && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-4 py-3",
            !isCollapsed && "border-b border-border",
            collapsible && "cursor-pointer select-none hover:bg-[var(--surface-3)] transition-colors"
          )}
          onClick={collapsible ? toggleCollapsed : undefined}
        >
          <div className="flex items-start gap-2 flex-1">
            {collapsible && (
              <svg
                className={cn(
                  "w-4 h-4 mt-0.5 text-[var(--text-secondary)] transition-transform flex-shrink-0",
                  isCollapsed && "-rotate-90"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            <div className="flex-1">
              {title ? <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3> : null}
              {description ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p> : null}
            </div>
          </div>
          {headerAction ? <div onClick={(e) => e.stopPropagation()}>{headerAction}</div> : null}
        </div>
      )}
      {!isCollapsed && (
        <div className={cn("p-4", bodyClassName)}>{children}</div>
      )}
    </section>
  );
}
