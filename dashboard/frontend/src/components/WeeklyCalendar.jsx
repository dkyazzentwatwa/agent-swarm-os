import { cn } from "@/lib/utils";

export function WeeklyCalendar({ lanes = [] }) {
  const safeLanes = lanes.length > 0
    ? lanes
    : [{ id: "execute", label: "Execute", description: "Run mission tasks" }];

  const today = new Date().getDay();
  const cycleIndex = safeLanes.length > 0 ? ((today + safeLanes.length - 1) % safeLanes.length) : -1;
  const columns = Math.min(5, Math.max(1, safeLanes.length));

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">Workflow Lanes</h3>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {safeLanes.map((lane, index) => (
          <div
            key={lane.id}
            className={cn(
              "rounded-md p-3 text-center transition-colors",
              index === cycleIndex
                ? "bg-foreground text-background"
                : index < cycleIndex
                ? "bg-muted"
                : "bg-muted/50"
            )}
          >
            <p className="text-xs font-medium opacity-60">{lane.id}</p>
            <p className="mt-1 text-sm font-semibold">{lane.label}</p>
            <p className={cn("mt-0.5 text-[10px]", index === cycleIndex ? "opacity-70" : "text-muted-foreground")}>
              {lane.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
