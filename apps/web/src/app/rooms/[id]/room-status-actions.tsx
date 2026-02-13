"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";


const hkStatusLabels: Record<string, string> = {
  clean: "Clean",
  dirty: "Dirty",
  pickup: "Pickup",
  inspected: "Inspected",
  out_of_order: "Out of Order",
  out_of_service: "Out of Service",
};

export function RoomStatusActions({
  roomId,
  housekeepingStatus,
  occupancyStatus,
}: {
  roomId: string;
  housekeepingStatus: string;
  occupancyStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError(null);

    const url = `/api/rooms/${roomId}/status`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ housekeepingStatus: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError({
          error: data.error || "Failed to update status",
          code: data.code,
          status: res.status,
          url,
          timestamp: new Date().toISOString(),
          requestedStatus: newStatus,
          currentStatus: housekeepingStatus,
          ...(data.allowedTransitions ? { allowedTransitions: data.allowedTransitions } : {}),
        });
        return;
      }

      router.refresh();
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError({
          error: `Connection error: Cannot reach the API server. Check that it is running.`,
          code: "NETWORK_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      } else {
        setError({
          error: err instanceof Error ? err.message : "Update failed",
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const actions: { label: string; status: string; color: string }[] = [];

  if (housekeepingStatus === "dirty") {
    actions.push({ label: "Mark Clean", status: "clean", color: "bg-green-600 hover:bg-green-700" });
    actions.push({ label: "Mark Pickup", status: "pickup", color: "bg-yellow-600 hover:bg-yellow-700" });
  } else if (housekeepingStatus === "pickup") {
    actions.push({ label: "Mark Clean", status: "clean", color: "bg-green-600 hover:bg-green-700" });
  } else if (housekeepingStatus === "clean") {
    actions.push({ label: "Mark Inspected", status: "inspected", color: "bg-blue-600 hover:bg-blue-700" });
    actions.push({ label: "Mark Dirty", status: "dirty", color: "bg-red-600 hover:bg-red-700" });
  } else if (housekeepingStatus === "inspected") {
    actions.push({ label: "Mark Dirty", status: "dirty", color: "bg-red-600 hover:bg-red-700" });
  }

  if (housekeepingStatus !== "out_of_order" && housekeepingStatus !== "out_of_service") {
    actions.push({ label: "Out of Order", status: "out_of_order", color: "bg-gray-600 hover:bg-gray-700" });
  } else {
    actions.push({ label: "Return to Service", status: "dirty", color: "bg-green-600 hover:bg-green-700" });
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
      <div className="flex flex-wrap gap-2 mt-3">
        {actions.map((action) => (
          <button key={action.status} onClick={() => updateStatus(action.status)} disabled={loading}
            className={`px-4 py-2 text-white rounded ${action.color} disabled:opacity-50`}>
            {action.label}
          </button>
        ))}
      </div>
      {occupancyStatus === "occupied" && (
        <p className="mt-3 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
          Room is currently occupied. Some status changes may not take effect until checkout.
        </p>
      )}
    </div>
  );
}
