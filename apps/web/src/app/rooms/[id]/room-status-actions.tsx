"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

export function RoomStatusActions({
  roomId,
  housekeepingStatus,
  occupancyStatus,
  oooFromDate,
  oooToDate,
  returnStatus,
}: {
  roomId: string;
  housekeepingStatus: string;
  occupancyStatus: string;
  oooFromDate?: string | null;
  oooToDate?: string | null;
  returnStatus?: string | null;
}) {
  const { dict } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  // OOO date form state
  const [showOooForm, setShowOooForm] = useState(false);
  const [oooFrom, setOooFrom] = useState(oooFromDate || "");
  const [oooTo, setOooTo] = useState(oooToDate || "");
  const [oooReturn, setOooReturn] = useState<"dirty" | "clean">(
    (returnStatus as "dirty" | "clean") || "dirty"
  );

  async function updateStatus(newStatus: string, extra?: Record<string, string>) {
    setLoading(true);
    setError(null);

    const url = `/api/rooms/${roomId}/status`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ housekeepingStatus: newStatus, ...extra }),
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

      setShowOooForm(false);
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

  function handleOooSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oooFrom || !oooTo) return;
    updateStatus("out_of_order", {
      oooFromDate: oooFrom,
      oooToDate: oooTo,
      returnStatus: oooReturn,
    });
  }

  const isOoo = housekeepingStatus === "out_of_order" || housekeepingStatus === "out_of_service";

  const actions: { label: string; status: string; color: string }[] = [];

  if (housekeepingStatus === "dirty") {
    actions.push({ label: "Clean", status: "clean", color: "bg-green-600 hover:bg-green-700" });
    actions.push({ label: "Pickup", status: "pickup", color: "bg-yellow-600 hover:bg-yellow-700" });
  } else if (housekeepingStatus === "pickup") {
    actions.push({ label: "Clean", status: "clean", color: "bg-green-600 hover:bg-green-700" });
  } else if (housekeepingStatus === "clean") {
    actions.push({ label: "Inspected", status: "inspected", color: "bg-blue-600 hover:bg-blue-700" });
    actions.push({ label: "Dirty", status: "dirty", color: "bg-red-600 hover:bg-red-700" });
  } else if (housekeepingStatus === "inspected") {
    actions.push({ label: "Dirty", status: "dirty", color: "bg-red-600 hover:bg-red-700" });
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold mb-3">{t(dict, "rooms.hkStatus")}</h2>
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

      {/* Regular HK status actions */}
      {!isOoo && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => updateStatus(action.status)}
              disabled={loading}
              className={`px-4 py-2 text-white text-sm rounded ${action.color} disabled:opacity-50`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* OOO section */}
      <div className="mt-4">
        {isOoo ? (
          // Room is OOO/OOS — show current period + return button
          <div className="p-3 bg-gray-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-1">Out of Order / Out of Service</p>
            {oooFromDate && oooToDate && (
              <p className="text-xs text-gray-500 mb-2">
                {t(dict, "rooms.oooPeriod", { from: oooFromDate, to: oooToDate })}
                {returnStatus && <span className="ml-2">{t(dict, "rooms.oooAfter", { status: returnStatus })}</span>}
              </p>
            )}
            <button
              onClick={() => updateStatus("dirty")}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {t(dict, "rooms.returnToDirty")}
            </button>
          </div>
        ) : (
          // Show OOO button or inline form
          <>
            {!showOooForm ? (
              <button
                onClick={() => setShowOooForm(true)}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {t(dict, "rooms.setOoo")}
              </button>
            ) : (
              <form
                onSubmit={handleOooSubmit}
                className="p-4 border border-gray-300 rounded-lg bg-gray-50 space-y-3 max-w-sm"
              >
                <p className="text-sm font-medium text-gray-700">{t(dict, "rooms.setOoo")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t(dict, "rooms.oooFrom")}</label>
                    <input
                      type="date"
                      required
                      value={oooFrom}
                      onChange={(e) => setOooFrom(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t(dict, "rooms.oooTo")}</label>
                    <input
                      type="date"
                      required
                      value={oooTo}
                      onChange={(e) => setOooTo(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t(dict, "rooms.oooReturnStatus")}</label>
                  <select
                    value={oooReturn}
                    onChange={(e) => setOooReturn(e.target.value as "dirty" | "clean")}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="dirty">{t(dict, "rooms.dirtyOption")}</option>
                    <option value="clean">{t(dict, "rooms.cleanOption")}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading || !oooFrom || !oooTo}
                    className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
                  >
                    {loading ? "..." : t(dict, "rooms.confirmOoo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOooForm(false)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                  >
                    {t(dict, "common.cancel")}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {occupancyStatus === "occupied" && (
        <p className="mt-3 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
          {t(dict, "rooms.oooBlocked")}
        </p>
      )}
      </div>
      );
      }
