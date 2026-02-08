import { cn } from "@/lib/utils";

export function CoffeeFilters({ typeFilter, onTypeFilterChange, types = [] }) {
  const filters = [
    { value: "all", label: "All" },
    ...types.map((type) => ({ value: type, label: type[0].toUpperCase() + type.slice(1) })),
  ];

  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Comms message type filter">
      {filters.map((filterOption) => (
        <button
          key={filterOption.value}
          onClick={() => onTypeFilterChange(filterOption.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            typeFilter === filterOption.value
              ? "bg-[var(--interactive-active)] text-[var(--text-primary)]"
              : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
          )}
          role="tab"
          aria-selected={typeFilter === filterOption.value}
        >
          {filterOption.label}
        </button>
      ))}
    </div>
  );
}
