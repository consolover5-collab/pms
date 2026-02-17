"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/format";

type Transaction = {
  id: string;
  date: string;
  transactionCode: { code: string; description: string };
  debit: string;
  credit: string;
  description: string | null;
  isSystemGenerated: boolean;
  postedBy: string;
  createdAt: string;
};

type FolioData = {
  balance: number;
  transactions: Transaction[];
  summary: {
    totalCharges: number;
    totalPayments: number;
  };
};

type TransactionCode = {
  id: string;
  code: string;
  description: string;
  transactionType: string;
  isManualPostAllowed: boolean;
};

type PostFormMode = null | "charge" | "payment";

export function FolioSection({ bookingId }: { bookingId: string }) {
  const [folio, setFolio] = useState<FolioData | null>(null);
  const [codes, setCodes] = useState<TransactionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postFormMode, setPostFormMode] = useState<PostFormMode>(null);
  const [posting, setPosting] = useState(false);

  const fetchFolio = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/folio`);
      if (!res.ok) throw new Error("Failed to fetch folio");
      const data = await res.json();
      setFolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading folio");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  async function fetchCodes() {
    try {
      const propRes = await fetch("/api/properties");
      const properties = await propRes.json();
      if (!properties.length) return;
      const res = await fetch(
        `/api/transaction-codes?propertyId=${properties[0].id}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCodes(data.filter((c: TransactionCode) => c.isManualPostAllowed));
      }
    } catch {
      // Codes not critical for viewing
    }
  }

  useEffect(() => {
    fetchFolio();
    fetchCodes();
  }, [bookingId, fetchFolio]);

  const chargeCodes = codes.filter((c) => c.transactionType === "charge");
  const paymentCodes = codes.filter((c) => c.transactionType === "payment");

  async function handlePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPosting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const codeId = form.get("codeId") as string;
    const rawAmount = form.get("amount") as string;
    const amount = parseFloat(rawAmount);
    const description = form.get("description") as string;

    if (!codeId || isNaN(amount) || amount <= 0) {
      setError("Выберите код и укажите сумму больше 0");
      setPosting(false);
      return;
    }

    const isPayment = postFormMode === "payment";
    const url = isPayment
      ? `/api/bookings/${bookingId}/folio/payment`
      : `/api/bookings/${bookingId}/folio/post`;

    // Find the selected transaction code for optimistic display
    const selectedCode = codes.find((c) => c.id === codeId);
    const optimisticId = `optimistic-${Date.now()}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Build optimistic transaction
    const optimisticTxn: Transaction = {
      id: optimisticId,
      date: today,
      transactionCode: {
        code: selectedCode?.code || "...",
        description: selectedCode?.description || "",
      },
      debit: isPayment ? "0" : amount.toFixed(2),
      credit: isPayment ? amount.toFixed(2) : "0",
      description: description || null,
      isSystemGenerated: false,
      postedBy: "You",
      createdAt: now,
    };

    // Snapshot previous folio state for rollback
    const previousFolio = folio;

    // Apply optimistic update
    if (folio) {
      const newBalance = isPayment
        ? folio.balance - amount
        : folio.balance + amount;
      const newCharges = isPayment
        ? folio.summary.totalCharges
        : folio.summary.totalCharges + amount;
      const newPayments = isPayment
        ? folio.summary.totalPayments + amount
        : folio.summary.totalPayments;

      setFolio({
        balance: newBalance,
        transactions: [...folio.transactions, optimisticTxn],
        summary: { totalCharges: newCharges, totalPayments: newPayments },
      });
    }

    setPostFormMode(null);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionCodeId: codeId,
          amount,
          ...(description ? { description } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Rollback optimistic update
        setFolio(previousFolio);
        setError(data.error || "Failed to post");
        return;
      }

      // Refetch to get authoritative server state
      await fetchFolio();
    } catch {
      // Rollback optimistic update
      setFolio(previousFolio);
      setError("Network error");
    } finally {
      setPosting(false);
    }
  }

  function toggleForm(mode: "charge" | "payment") {
    setPostFormMode(postFormMode === mode ? null : mode);
  }

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-400">Loading folio...</p>
      </div>
    );
  }

  if (error && !folio) {
    return (
      <div className="mt-6 p-4 bg-red-50 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!folio) return null;

  const activeCodes =
    postFormMode === "charge" ? chargeCodes : paymentCodes;

  const formTheme =
    postFormMode === "charge"
      ? {
          bg: "bg-blue-50",
          border: "border-blue-200",
          btn: "bg-blue-600 hover:bg-blue-700",
          label: "Post Charge",
          posting: "Posting charge...",
        }
      : {
          bg: "bg-green-50",
          border: "border-green-200",
          btn: "bg-green-600 hover:bg-green-700",
          label: "Accept Payment",
          posting: "Processing payment...",
        };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Folio</h2>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-mono font-bold ${folio.balance > 0 ? "text-red-600" : "text-green-600"}`}
          >
            Balance: {formatCurrency(folio.balance)} &#8381;
          </span>
          <button
            onClick={() => toggleForm("charge")}
            disabled={posting}
            className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
              postFormMode === "charge"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {postFormMode === "charge" ? "Cancel" : "Post Charge"}
          </button>
          <button
            onClick={() => toggleForm("payment")}
            disabled={posting}
            className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
              postFormMode === "payment"
                ? "bg-green-100 text-green-700 border border-green-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {postFormMode === "payment" ? "Cancel" : "Accept Payment"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            x
          </button>
        </div>
      )}

      {/* Post form */}
      {postFormMode && (
        <form
          onSubmit={handlePost}
          className={`mb-4 p-3 ${formTheme.bg} border ${formTheme.border} rounded-lg space-y-2`}
        >
          <div className="grid grid-cols-3 gap-2">
            <select
              name="codeId"
              required
              className="text-sm border rounded px-2 py-1.5"
            >
              <option value="">
                {postFormMode === "charge"
                  ? "Charge code..."
                  : "Payment method..."}
              </option>
              {activeCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.description}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Amount"
              className="text-sm border rounded px-2 py-1.5"
            />
            <input
              name="description"
              type="text"
              placeholder="Description (optional)"
              className="text-sm border rounded px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={posting}
            className={`px-3 py-1.5 text-sm text-white rounded ${formTheme.btn} disabled:opacity-50`}
          >
            {posting ? formTheme.posting : formTheme.label}
          </button>
        </form>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Total Charges:</span>{" "}
          <span className="font-mono">
            {formatCurrency(folio.summary.totalCharges)} &#8381;
          </span>
        </div>
        <div>
          <span className="text-gray-500">Total Payments:</span>{" "}
          <span className="font-mono">
            {formatCurrency(folio.summary.totalPayments)} &#8381;
          </span>
        </div>
      </div>

      {/* Transactions table */}
      {folio.transactions.length === 0 ? (
        <p className="text-gray-400 text-sm">No transactions</p>
      ) : (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">
                  Date
                </th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">
                  Code
                </th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">
                  Description
                </th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">
                  Debit
                </th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">
                  Credit
                </th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">
                  Posted By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {folio.transactions.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 ${t.id.startsWith("optimistic-") ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2 text-gray-600">{t.date}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {t.transactionCode.code}
                  </td>
                  <td className="px-3 py-2">
                    {t.description || t.transactionCode.description}
                    {t.isSystemGenerated && (
                      <span className="ml-1 text-xs text-gray-400">
                        (auto)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {parseFloat(t.debit) > 0 ? formatCurrency(t.debit) : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">
                    {parseFloat(t.credit) > 0 ? formatCurrency(t.credit) : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {t.postedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
