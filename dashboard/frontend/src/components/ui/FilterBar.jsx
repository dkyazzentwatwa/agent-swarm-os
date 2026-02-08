import { cn } from "@/lib/utils";

export function FilterBar({ className, sticky = false, children }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        sticky && "sticky top-2 z-20",
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">{children}</div>
    </div>
  );
}
