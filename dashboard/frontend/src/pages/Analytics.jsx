import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { useContent } from "@/hooks/useContent";
import { useCoffeeRoom } from "@/hooks/useCoffeeRoom";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { AgentAvatar } from "@/components/AgentAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { titleFromId } from "@/lib/utils";

/**
 * Accessible chart wrapper for distribution/categorical data
 * Provides screen reader support with data table alternative
 */
function AccessibleDataChart({ title, data, chart, columns = ["Category", "Value"], dataKeys = ["name", "value"] }) {
  const [showTable, setShowTable] = useState(false);

  const summaryText = useMemo(() => {
    if (!data || data.length === 0) return "No data available";
    return data.map((d) => `${d[dataKeys[0]]}: ${d[dataKeys[1]]}`).join(", ");
  }, [data, dataKeys]);

  if (!data || data.length === 0) return null;

  return (
    <figure role="img" aria-label={`${title}: ${summaryText}`}>
      <figcaption className="sr-only">
        {title}. {summaryText}
      </figcaption>

      <div aria-hidden="true">{chart}</div>

      <details className="mt-4 rounded-md border border-border bg-[var(--surface-2)] p-3">
        <summary
          className="cursor-pointer text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? "Hide" : "View"} data table
        </summary>
        {showTable && (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{title} data</caption>
            <thead>
              <tr className="border-b border-border">
                {columns.map((col, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {dataKeys.map((key, j) => (
                    <td key={j} className="px-2 py-1.5 text-[var(--text-primary)]">
                      {row[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </figure>
  );
}

/**
 * Accessible chart wrapper for time-series data
 * Provides screen reader support with chronological data table
 */
function AccessibleTimeSeriesChart({ title, data, chart, valueLabel = "Value", dateKey = "date", valueKey = "tasks" }) {
  const [showTable, setShowTable] = useState(false);

  const summaryText = useMemo(() => {
    if (!data || data.length === 0) return "No data available";
    const total = data.reduce((sum, d) => sum + d[valueKey], 0);
    const avg = Math.round(total / data.length);
    return `${data.length} data points, average ${avg} ${valueLabel.toLowerCase()} per period`;
  }, [data, valueKey, valueLabel]);

  if (!data || data.length === 0) return null;

  return (
    <figure role="img" aria-label={`${title}: ${summaryText}`}>
      <figcaption className="sr-only">
        {title}. {summaryText}
      </figcaption>

      <div aria-hidden="true">{chart}</div>

      <details className="mt-4 rounded-md border border-border bg-[var(--surface-2)] p-3">
        <summary
          className="cursor-pointer text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? "Hide" : "View"} data table
        </summary>
        {showTable && (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{title} time series data</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)]">Date</th>
                <th className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)]">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-[var(--text-primary)]">{row[dateKey]}</td>
                  <td className="px-2 py-1.5 text-[var(--text-primary)]">{row[valueKey]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </figure>
  );
}

function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export default function Analytics() {
  const { workspaceId, workspaceData } = useOutletContext();
  const { data: taskData } = useTasks(workspaceId);
  const { data: artifacts } = useContent(workspaceId);
  const { data: commsData } = useCoffeeRoom(workspaceId);

  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const summary = taskData?.summary || { total: 0, completed: 0, inProgress: 0, pending: 0, blocked: 0 };
  const artifactSummaries = useMemo(() => artifacts ?? [], [artifacts]);
  const messages = useMemo(() => commsData?.messages ?? [], [commsData?.messages]);
  const workspace = workspaceData?.manifest;

  const chartColors = {
    axis: cssVar("--chart-axis", "#8b949e"),
    grid: cssVar("--chart-grid", "#30363d"),
    s1: cssVar("--chart-series-1", "#58a6ff"),
    s2: cssVar("--chart-series-2", "#3fb950"),
    s3: cssVar("--chart-series-3", "#d29922"),
    s4: cssVar("--chart-series-4", "#bc8cff"),
    warn: cssVar("--status-warn", "#f59e0b"),
    success: cssVar("--status-success", "#22c55e"),
    error: cssVar("--status-error", "#ef4444"),
    info: cssVar("--status-info", "#3b82f6"),
  };

  const moduleMap = useMemo(
    () => Object.fromEntries((workspace?.modules || []).map((module) => [module.id, module])),
    [workspace?.modules]
  );

  const moduleData = useMemo(() => {
    const moduleCounts = {};
    artifactSummaries.forEach((summaryItem) => {
      Object.entries(summaryItem.modules || {}).forEach(([moduleId, files]) => {
        moduleCounts[moduleId] = (moduleCounts[moduleId] || 0) + files.length;
      });
    });

    const palette = [chartColors.s1, chartColors.s2, chartColors.s3, chartColors.s4, chartColors.info];
    return Object.entries(moduleCounts).map(([id, value], index) => ({
      id,
      name: moduleMap[id]?.label || titleFromId(id),
      value,
      fill: palette[index % palette.length],
    }));
  }, [artifactSummaries, chartColors.info, chartColors.s1, chartColors.s2, chartColors.s3, chartColors.s4, moduleMap]);

  const statusData = useMemo(
    () => [
      { name: "Completed", value: summary.completed, fill: chartColors.success },
      { name: "In Progress", value: summary.inProgress, fill: chartColors.info },
      { name: "Pending", value: summary.pending, fill: chartColors.s4 },
      { name: "Blocked", value: summary.blocked, fill: chartColors.error },
    ].filter((item) => item.value > 0),
    [chartColors.error, chartColors.info, chartColors.s4, chartColors.success, summary.blocked, summary.completed, summary.inProgress, summary.pending]
  );

  const agentData = useMemo(() => {
    const byAgent = {};
    tasks.forEach((task) => {
      if (task.assignee && task.status === "completed") {
        byAgent[task.assignee] = (byAgent[task.assignee] || 0) + 1;
      }
    });

    return Object.entries(byAgent).map(([name, count]) => ({
      name,
      label: workspace?.agents?.find((agent) => agent.id === name)?.displayName || titleFromId(name),
      tasks: count,
    }));
  }, [tasks, workspace?.agents]);

  const timelineChartData = useMemo(() => {
    const timelineData = {};
    tasks
      .filter((task) => task.status === "completed" && task.completedAt)
      .forEach((task) => {
        const date = new Date(task.completedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        timelineData[date] = (timelineData[date] || 0) + 1;
      });

    return Object.entries(timelineData)
      .map(([date, count]) => ({ date, tasks: count }))
      .slice(-7);
  }, [tasks]);

  const leaderboardData = useMemo(() => {
    const byAgent = {};
    tasks.forEach((task) => {
      if (task.assignee && task.status === "completed") {
        byAgent[task.assignee] = (byAgent[task.assignee] || 0) + 1;
      }
    });

    return Object.entries(byAgent)
      .map(([name, count]) => ({
        name,
        displayName: workspace?.agents?.find((agent) => agent.id === name)?.displayName || titleFromId(name),
        emoji: workspace?.agents?.find((agent) => agent.id === name)?.emoji || "🤖",
        color: workspace?.agents?.find((agent) => agent.id === name)?.color || "#64748b",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tasks, workspace?.agents]);

  const insightCount = messages.filter((message) => message.type === "insight").length;
  const blockerCount = messages.filter((message) => message.type === "blocker").length;
  const totalArtifacts = moduleData.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Mission health, module output, and team performance" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Artifacts" value={totalArtifacts} status="info" />
        <StatTile label="Modules Active" value={moduleData.length} status="success" />
        <StatTile label="Tasks Completed" value={summary.completed} status="success" />
        <StatTile label="Comms Messages" value={messages.length} status="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Module Distribution" description="Where output is concentrated">
          {moduleData.length > 0 ? (
            <AccessibleDataChart
              title="Module Distribution"
              data={moduleData}
              columns={["Module", "Files"]}
              dataKeys={["name", "value"]}
              chart={
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={moduleData} cx="50%" cy="50%" innerRadius={52} outerRadius={92} paddingAngle={3} dataKey="value">
                      {moduleData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              }
            />
          ) : (
            <EmptyState preset="content" />
          )}
        </Panel>

        <Panel title="Task Status Overview" description="Current execution health">
          {statusData.length > 0 ? (
            <AccessibleDataChart
              title="Task Status Overview"
              data={statusData}
              columns={["Status", "Tasks"]}
              dataKeys={["name", "value"]}
              chart={
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={statusData} layout="vertical" margin={{ left: 12, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            />
          ) : (
            <EmptyState preset="tasks" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Agent Throughput" description="Completed tasks per agent">
          {agentData.length > 0 ? (
            <AccessibleDataChart
              title="Agent Throughput"
              data={agentData}
              columns={["Agent", "Completed Tasks"]}
              dataKeys={["label", "tasks"]}
              chart={
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={agentData} margin={{ left: 10, right: 8, top: 8, bottom: 38 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartColors.axis }} angle={-26} textAnchor="end" interval={0} height={72} />
                    <YAxis tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <Tooltip />
                    <Bar dataKey="tasks" fill={chartColors.s1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              }
            />
          ) : (
            <EmptyState preset="agents" />
          )}
        </Panel>

        <Panel title="Comms Signal" description="Insight and blocker tracking">
          <div className="grid h-[260px] place-content-center">
            <div className="grid grid-cols-2 gap-8 text-center">
              <div>
                <p className="text-4xl font-semibold text-[var(--text-primary)]">{insightCount}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Insights</p>
              </div>
              <div>
                <p className="text-4xl font-semibold text-[var(--text-primary)]">{blockerCount}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Blockers</p>
              </div>
              <div className="col-span-2">
                <p className="text-4xl font-semibold text-[var(--text-primary)]">{messages.length}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Total Messages</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Task Completion Timeline" description="Last 7 completion windows">
          {timelineChartData.length > 0 ? (
            <AccessibleTimeSeriesChart
              title="Task Completion Timeline"
              data={timelineChartData}
              valueLabel="Tasks Completed"
              dateKey="date"
              valueKey="tasks"
              chart={
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timelineChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.s2} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={chartColors.s2} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="tasks" stroke={chartColors.s2} strokeWidth={2} fill="url(#colorTasks)" />
                  </AreaChart>
                </ResponsiveContainer>
              }
            />
          ) : (
            <EmptyState title="No completed tasks yet" description="Timeline will appear as work closes out." />
          )}
        </Panel>

        <Panel title="Agent Leaderboard" description="Top contributors by completed tasks">
          {leaderboardData.length > 0 ? (
            <div className="space-y-3">
              {leaderboardData.map((agent, index) => (
                <div key={agent.name} className="flex items-center gap-3 rounded-md p-2 hover:bg-[var(--interactive-hover)]">
                  <span className="w-6 text-lg font-semibold text-[var(--text-secondary)]">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </span>
                  <AgentAvatar agent={agent.name} size="sm" emoji={agent.emoji} color={agent.color} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{agent.displayName}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {agent.count} task{agent.count !== 1 ? "s" : ""} completed
                    </p>
                  </div>
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(agent.count / (leaderboardData[0]?.count || 1)) * 100}%`,
                        background: chartColors.s2,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState preset="agents" />
          )}
        </Panel>
      </div>
    </div>
  );
}
