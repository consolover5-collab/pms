"use client";

import { useState, useEffect } from "react";

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

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function FolioSection({ bookingId }: { bookingId: string }) {
  const [folio, setFolio] = useState<FolioData | null>(null);
  const [codes, setCodes] = useState<TransactionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [posting, setPosting] = useState(false);

  async function fetchFolio() {
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
  }

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
  }, [bookingId]);

  async function handlePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPosting(true);
    const form = new FormData(e.currentTarget);
    const codeId = form.get("codeId") as string;
    const amount = parseFloat(form.get("amount") as string);
    const description = form.get("description") as string;

    const code = codes.find((c) => c.id === codeId);
    const isPayment = code?.transactionType === "payment";
    const url = isPayment
      ? `/api/bookings/${bookingId}/folio/payment`
      : `/api/bookings/${bookingId}/folio/post`;

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
        setError(data.error || "Failed to post");
        return;
      }

      setShowPostForm(false);
      await fetchFolio();
    } catch {
      setError("Network error");
    } finally {
      setPosting(false);
    }
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

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Folio</h2>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-mono font-bold ${folio.balance > 0 ? "text-red-600" : "text-green-600"}`}
          >
            Balance: {formatCurrency(folio.balance)} ₽
          </span>
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showPostForm ? "Cancel" : "Post Charge"}
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
      {showPostForm && (
        <form
          onSubmit={handlePost}
          className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2"
        >
          <div className="grid grid-cols-3 gap-2">
            <select
              name="codeId"
              required
              className="text-sm border rounded px-2 py-1.5"
            >
              <option value="">Transaction code...</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.description}{" "}
                  {c.transactionType === "payment" ? "(Payment)" : ""}
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
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </form>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Total Charges:</span>{" "}
          <span className="font-mono">
            {formatCurrency(folio.summary.totalCharges)} ₽
          </span>
        </div>
        <div>
          <span className="text-gray-500">Total Payments:</span>{" "}
          <span className="font-mono">
            {formatCurrency(folio.summary.totalPayments)} ₽
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
                <tr key={t.id} className="hover:bg-gray-50">
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
                    {parseFloat(t.debit) > 0 ? formatCurrency(parseFloat(t.debit)) : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">
                    {parseFloat(t.credit) > 0 ? formatCurrency(parseFloat(t.credit)) : ""}
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
