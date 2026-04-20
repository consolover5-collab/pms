"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type HousekeepingTask } from "./page";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/locales/en";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  skipped: "bg-yellow-100 text-yellow-800",
};

const NO_FLOOR = "no_floor";

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

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [maidFilter, setMaidFilter] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (maidFilter && !(t.assignedTo || "").toLowerCase().includes(maidFilter.toLowerCase())) return false;
    return true;
  });

  const tasksByFloor = filteredTasks.reduce((acc, task) => {
    const floor = task.room.floor?.toString() ?? NO_FLOOR;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(task);
    return acc;
  }, {} as Record<string, HousekeepingTask[]>);

  // Sort floors
  const sortedFloors = Object.keys(tasksByFloor).sort((a, b) => {
    if (a === NO_FLOOR) return 1;
    if (b === NO_FLOOR) return -1;
    return Number(a) - Number(b);
  });

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
      alert(t(dict, "hk.generated", { count: data.created }));
      
      // Refresh tasks list
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

  async function handleUpdateTask(id: string, updates: { status?: string; assignedTo?: string }) {
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
    // We ignore the dynamic key type error or we use type assertion
    return t(dict, key as any) || type;
  };

  const getStatusLabel = (status: string) => {
    const key = `hk.status.${status}` as keyof Dictionary;
    return t(dict, key as any) || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
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
            className="border rounded px-3 py-2 text-sm w-48"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !businessDate}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? t(dict, "hk.generating") : t(dict, "hk.generateBtn")}
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
          {t(dict, "hk.emptyNoTasks")}
        </div>
      ) : sortedFloors.length === 0 ? (
         <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
           {t(dict, "hk.emptyFiltered")}
         </div>
      ) : (
        <div className="space-y-8">
          {sortedFloors.map((floor) => (
            <div key={floor} className="space-y-4">
              <h2 className="text-xl font-bold border-b pb-2">
                {floor === NO_FLOOR ? t(dict, "hk.floorNone") : t(dict, "hk.floor", { floor })} <span className="text-sm font-normal text-gray-500 ml-2">({t(dict, "hk.tasks", { count: tasksByFloor[floor].length })})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tasksByFloor[floor].map((task) => (
                  <div key={task.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{task.room.roomNumber}</span>
                          {task.priority === 1 && (
                            <span className="text-red-600 font-bold" title="Rush / VIP">
                              ❗️
                            </span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[task.status] || "bg-gray-100"}`}>
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {getTaskTypeLabel(task.taskType)}
                      </p>
                      <div className="mt-4">
                        <label className="block text-xs text-gray-500 mb-1">{t(dict, "hk.assignMaid")}</label>
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
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t flex flex-wrap gap-2">
                      {task.status === "pending" && (
                        <button
                          onClick={() => handleUpdateTask(task.id, { status: "in_progress" })}
                          disabled={updating === task.id}
                          className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100"
                        >
                          {t(dict, "hk.actionStart")}
                        </button>
                      )}
                      {(task.status === "pending" || task.status === "in_progress") && (
                        <button
                          onClick={() => handleUpdateTask(task.id, { status: "completed" })}
                          disabled={updating === task.id}
                          className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100"
                        >
                          {t(dict, "hk.actionDone")}
                        </button>
                      )}
                      {task.status !== "skipped" && task.status !== "completed" && (
                        <button
                          onClick={() => handleUpdateTask(task.id, { status: "skipped" })}
                          disabled={updating === task.id}
                          className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded hover:bg-yellow-100"
                        >
                          {t(dict, "hk.actionSkip")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
