export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {subtitle ? <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
