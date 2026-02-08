export function TaskProgress({ summary }) {
  if (!summary) return null;

  const { total, completed, inProgress, pending, blocked } = summary;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Task Progress</h3>
        <span className="text-sm font-semibold">{percent}%</span>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <Stat label="Completed" value={completed} />
        <Stat label="In Progress" value={inProgress} />
        <Stat label="Pending" value={pending} />
        <Stat label="Blocked" value={blocked} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
