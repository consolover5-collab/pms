"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type HousekeepingTask } from "./page";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import type { Dictionary, DictionaryKey } from "@/lib/i18n/locales/en";
import { Icon } from "@/components/icon";

const HK_COLUMNS: { key: string; labelKey: DictionaryKey; cls: string }[] = [
  { key: "dirty", labelKey: "dashboard.dirty", cls: "hk-dirty" },
  { key: "pickup", labelKey: "dashboard.hk.pickup", cls: "hk-pickup" },
  { key: "clean", labelKey: "dashboard.clean", cls: "hk-clean" },
  { key: "inspected", labelKey: "dashboard.inspected", cls: "hk-inspected" },
  { key: "out_of_order", labelKey: "dashboard.hk.ooo", cls: "hk-ooo" },
  { key: "out_of_service", labelKey: "dashboard.hk.oos", cls: "hk-oos" },
];

export function HousekeepingClient({
  initialTasks,
  propertyId,
  businessDate,
}: {
  initialTasks: HousekeepingTask[];
  propertyId: string;
  businessDate: string | null;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [tasks, setTasks] = useState<HousekeepingTask[]>(initialTasks);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [maidFilter, setMaidFilter] = useState("");

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (maidFilter && !(task.assignedTo || "").toLowerCase().includes(maidFilter.toLowerCase())) return false;
    return true;
  });

  const byHk = HK_COLUMNS.map((col) => ({
    ...col,
    tasks: filteredTasks.filter((task) => task.room.housekeepingStatus === col.key),
  }));

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/housekeeping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate tasks");
      const tasksRes = await fetch(`/api/housekeeping/tasks?propertyId=${propertyId}`);
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.data);
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error generating tasks");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateTask(
    id: string,
    updates: { status?: string; assignedTo?: string },
  ) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/housekeeping/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const updatedTask = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updatedTask } : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating task");
    } finally {
      setUpdating(null);
    }
  }

  const getTaskTypeLabel = (type: string) => {
    const key = `hk.taskType.${type}` as keyof Dictionary;
    return (t(dict, key as DictionaryKey) as string) || type;
  };

  const getStatusLabel = (status: string) => {
    const key = `hk.status.${status}` as keyof Dictionary;
    return (t(dict, key as DictionaryKey) as string) || status;
  };

  return (
    <>
      {/* KPI row */}
      <div className="grid g6">
        {HK_COLUMNS.map((c) => {
          const n = tasks.filter((task) => task.room.housekeepingStatus === c.key).length;
          return (
            <div key={c.key} className="kpi" style={{ minHeight: 60 }}>
              <div className="lab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: `var(--${c.cls})`,
                  }}
                />
                {t(dict, c.labelKey)}
              </div>
              <div className="val" data-testid="hk-kpi-value" style={{ fontSize: 20 }}>
                {n}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="card">
        <div className="card-body" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select"
            data-testid="hk-status-select"
            style={{ width: "auto" }}
          >
            <option value="all">{t(dict, "hk.filterAllStatuses")}</option>
            <option value="pending">{getStatusLabel("pending")}</option>
            <option value="in_progress">{getStatusLabel("in_progress")}</option>
            <option value="completed">{getStatusLabel("completed")}</option>
          </select>
          <input
            type="text"
            placeholder={t(dict, "hk.filterByMaid")}
            value={maidFilter}
            onChange={(e) => setMaidFilter(e.target.value)}
            className="input"
            style={{ width: 220 }}
          />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !businessDate}
            className="btn sm primary"
          >
            <Icon name="refresh" size={12} />
            {generating ? t(dict, "hk.generating") : t(dict, "hk.generateBtn")}
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty">{t(dict, "hk.emptyNoTasks")}</div>
          </div>
        </div>
      ) : (
        <div className="kanban">
          {byHk.map((col) => (
            <div key={col.key} className="kcol">
              <h4>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: `var(--${col.cls})`,
                  }}
                />
                {t(dict, col.labelKey)}
                <span className="n">{col.tasks.length}</span>
              </h4>
              {col.tasks.map((task) => (
                <div key={task.id} className="kcard" data-testid="hk-task-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="rno" data-testid="hk-room-no">{task.room.roomNumber}</span>
                    {task.priority === 1 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          color: "var(--no-show)",
                          fontSize: 10.5,
                          fontWeight: 600,
                        }}
                        title={t(dict, "hk.rushTitle")}
                      >
                        {t(dict, "hk.rushBadge")}
                      </span>
                    )}
                  </div>
                  <div className="tp">{getTaskTypeLabel(task.taskType)}</div>
                  <input
                    type="text"
                    defaultValue={task.assignedTo || ""}
                    placeholder={t(dict, "hk.maidPlaceholder")}
                    onBlur={(e) => {
                      if (e.target.value !== (task.assignedTo || "")) {
                        handleUpdateTask(task.id, { assignedTo: e.target.value });
                      }
                    }}
                    disabled={updating === task.id}
                    className="input"
                    data-testid="hk-assign-input"
                    style={{ padding: "3px 8px", fontSize: 11 }}
                  />
                  <div className="tags">
                    <span className={`badge ${col.cls}`} style={{ fontSize: 10 }}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {task.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTask(task.id, { status: "in_progress" })}
                        disabled={updating === task.id}
                        className="btn xs"
                      >
                        {t(dict, "hk.actionStart")}
                      </button>
                    )}
                    {(task.status === "pending" || task.status === "in_progress") && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTask(task.id, { status: "completed" })}
                        disabled={updating === task.id}
                        className="btn xs primary"
                      >
                        <Icon name="check" size={11} />
                        {t(dict, "hk.actionDone")}
                      </button>
                    )}
                    {task.status !== "skipped" && task.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTask(task.id, { status: "skipped" })}
                        disabled={updating === task.id}
                        className="btn xs ghost"
                      >
                        {t(dict, "hk.actionSkip")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {col.tasks.length === 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-2)",
                    textAlign: "center",
                    padding: 10,
                  }}
                >
                  —
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
