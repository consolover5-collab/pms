"use client";

import { useState, useEffect } from "react";

type PreviewData = {
  businessDate: string;
  dueOuts: number;
  pendingNoShows: number;
  roomsToCharge: number;
  estimatedRevenue: number;
  warnings: string[];
};

type RunResult = {
  businessDate: string;
  nextBusinessDate: string;
  noShows: number;
  roomChargesPosted: number;
  taxChargesPosted: number;
  roomsUpdated: number;
  totalRevenue: number;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function NightAuditPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "running" | "done">(
    "idle",
  );

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
      setStep("preview");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function runAudit() {
    if (!propertyId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/night-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
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

      {/* Idle state — show preview button */}
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
              <div>
                <span className="text-gray-500">Pending no-shows:</span>{" "}
                <span className="font-bold">{preview.pendingNoShows}</span>
              </div>
              <div>
                <span className="text-gray-500">Due-outs:</span>{" "}
                <span className="font-bold">{preview.dueOuts}</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                Warnings
              </h3>
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
