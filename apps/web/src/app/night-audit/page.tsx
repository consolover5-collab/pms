"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/format";

type RoomDetail = {
  roomNumber: string;
  guestName: string;
  rateAmount: number;
};

type NoShowBooking = {
  id: string;
  confirmationNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  guaranteeCode: string | null;
};

type PreviewData = {
  businessDate: string;
  overdueDueOuts: number;
  dueToday: number;
  pendingNoShows: number;
  pendingNoShowDetails: NoShowBooking[];
  roomsToCharge: number;
  estimatedRevenue: number;
  roomDetails: RoomDetail[];
  warnings: string[];
};

type RunResult = {
  businessDate: string;
  nextBusinessDate: string;
  noShows: number;
  cancelled: number;
  roomChargesPosted: number;
  taxChargesPosted: number;
  roomsUpdated: number;
  oooRoomsRestored: number;
  totalRevenue: number;
};

export default function NightAuditPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "running" | "done">("idle");

  // Решения по no-show броням: bookingId → "no_show" | "cancel"
  const [noShowDecisions, setNoShowDecisions] = useState<Record<string, "no_show" | "cancel">>({});

  useEffect(() => {
    async function fetchProperty() {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const props = await res.json();
        if (props.length) setPropertyId(props[0].id);
      }
    }
    fetchProperty();
  }, []);

  async function runPreview() {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setNoShowDecisions({});

    try {
      const res = await fetch("/api/night-audit/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Preview failed");
        return;
      }

      const data = await res.json();
      setPreview(data);
      // По умолчанию — all no_show
      const defaults: Record<string, "no_show" | "cancel"> = {};
      for (const b of data.pendingNoShowDetails ?? []) {
        defaults[b.id] = "no_show";
      }
      setNoShowDecisions(defaults);
      setStep("preview");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const auditRunningRef = useRef(false);

  async function runAudit() {
    if (!propertyId || auditRunningRef.current) return;
    auditRunningRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const decisions = Object.entries(noShowDecisions).map(([bookingId, action]) => ({
        bookingId,
        action,
      }));

      const res = await fetch("/api/night-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, noShowDecisions: decisions }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Night Audit failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      setStep("done");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      auditRunningRef.current = false;
    }
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Night Audit</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Idle state */}
      {step === "idle" && (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Night Audit closes the current business date, posts room charges and
            taxes, marks no-shows, and opens the next business date.
          </p>
          <button
            onClick={runPreview}
            disabled={loading || !propertyId}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Preview Night Audit"}
          </button>
        </div>
      )}

      {/* Preview results */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h2 className="text-sm font-semibold mb-3">
              Night Audit Preview — {preview.businessDate}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Rooms to charge:</span>{" "}
                <span className="font-bold">{preview.roomsToCharge}</span>
              </div>
              <div>
                <span className="text-gray-500">Estimated revenue:</span>{" "}
                <span className="font-bold font-mono">
                  {formatCurrency(preview.estimatedRevenue)} ₽
                </span>
              </div>
              {preview.overdueDueOuts > 0 && (
                <div>
                  <span className="text-red-600 font-medium">Просрочен выезд:</span>{" "}
                  <span className="font-bold text-red-600">{preview.overdueDueOuts}</span>
                  <span className="text-xs text-red-500 ml-1">(блокируют аудит)</span>
                </div>
              )}
              {preview.dueToday > 0 && (
                <div>
                  <span className="text-gray-500">Выезжают сегодня:</span>{" "}
                  <span className="font-bold">{preview.dueToday}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pending no-shows: выбор действия */}
          {preview.pendingNoShowDetails && preview.pendingNoShowDetails.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                Неприбывшие гости ({preview.pendingNoShowDetails.length}) — выберите действие
              </h3>
              <p className="text-xs text-yellow-700 mb-3">
                Подтверждённые брони с прошедшей датой заезда. No Show — штатный статус. Отмена — гость предупредил, не приедет.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-yellow-200">
                    <th className="pb-1">Бронь</th>
                    <th className="pb-1">Гость</th>
                    <th className="pb-1">Заезд</th>
                    <th className="pb-1">Гарантия</th>
                    <th className="pb-1">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pendingNoShowDetails.map((b) => (
                    <tr key={b.id} className="border-b border-yellow-100">
                      <td className="py-1 font-mono text-xs">{b.confirmationNumber}</td>
                      <td className="py-1">{b.guestName}</td>
                      <td className="py-1 text-xs">{b.checkInDate}</td>
                      <td className="py-1 text-xs text-gray-500">{b.guaranteeCode || "—"}</td>
                      <td className="py-1">
                        <select
                          value={noShowDecisions[b.id] ?? "no_show"}
                          onChange={(e) =>
                            setNoShowDecisions((prev) => ({
                              ...prev,
                              [b.id]: e.target.value as "no_show" | "cancel",
                            }))
                          }
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="no_show">No Show</option>
                          <option value="cancel">Отмена</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-room breakdown */}
          {preview.roomDetails && preview.roomDetails.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Room Charges Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-1">Room</th>
                    <th className="pb-1">Guest</th>
                    <th className="pb-1 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.roomDetails.map((rd, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 font-mono">{rd.roomNumber}</td>
                      <td className="py-1">{rd.guestName}</td>
                      <td className="py-1 text-right font-mono">
                        {formatCurrency(rd.rateAmount)} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">Warnings</h3>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Running..." : "Run Night Audit"}
            </button>
            <button
              onClick={() => {
                setStep("idle");
                setPreview(null);
              }}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Run results */}
      {step === "done" && result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-sm font-semibold text-green-800 mb-3">
              Night Audit Complete
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Closed date:</span>{" "}
                <span className="font-bold">{result.businessDate}</span>
              </div>
              <div>
                <span className="text-gray-500">New business date:</span>{" "}
                <span className="font-bold text-blue-600">
                  {result.nextBusinessDate}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Room charges:</span>{" "}
                <span className="font-bold">{result.roomChargesPosted}</span>
              </div>
              <div>
                <span className="text-gray-500">Tax charges:</span>{" "}
                <span className="font-bold">{result.taxChargesPosted}</span>
              </div>
              <div>
                <span className="text-gray-500">No-shows:</span>{" "}
                <span className="font-bold">{result.noShows}</span>
              </div>
              {result.cancelled > 0 && (
                <div>
                  <span className="text-gray-500">Отменено:</span>{" "}
                  <span className="font-bold">{result.cancelled}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Total revenue:</span>{" "}
                <span className="font-bold font-mono">
                  {formatCurrency(result.totalRevenue)} ₽
                </span>
              </div>
              <div>
                <span className="text-gray-500">Rooms set to dirty:</span>{" "}
                <span className="font-bold">{result.roomsUpdated}</span>
              </div>
              {result.oooRoomsRestored > 0 && (
                <div>
                  <span className="text-gray-500">OOO восстановлено:</span>{" "}
                  <span className="font-bold text-green-700">{result.oooRoomsRestored}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setStep("idle");
              setPreview(null);
              setResult(null);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      )}
    </main>
  );
}
