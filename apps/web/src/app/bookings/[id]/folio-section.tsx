"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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
  folioWindowId: string;
};

type FolioWindow = {
  id: string;
  bookingId: string;
  windowNumber: number;
  label: string;
  payeeType: string | null;
  payeeId: string | null;
  paymentMethod: string | null;
  balance: number;
  totalCharges: number;
  totalPayments: number;
};

type FolioData = {
  balance: number;
  transactions: Transaction[];
  summary: { totalCharges: number; totalPayments: number };
  windows: FolioWindow[];
};

type TransactionCode = {
  id: string;
  code: string;
  description: string;
  transactionType: string;
  isManualPostAllowed: boolean;
};

type PostFormMode = null | "charge" | "payment";

function windowLetter(n: number): string {
  return String.fromCharCode(64 + n);
}

export function FolioSection({ bookingId }: { bookingId: string }) {
  const { dict } = useLocale();
  const [folio, setFolio] = useState<FolioData | null>(null);
  const [codes, setCodes] = useState<TransactionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postFormMode, setPostFormMode] = useState<PostFormMode>(null);
  const [posting, setPosting] = useState(false);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  const fetchFolio = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/folio`);
      if (!res.ok) throw new Error("Failed to fetch folio");
      const data: FolioData = await res.json();
      setFolio(data);
      setActiveWindowId((prev) => prev ?? data.windows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading folio");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const fetchCodes = useCallback(async () => {
    try {
      const propRes = await fetch("/api/properties");
      const properties = await propRes.json();
      if (!properties.length) return;
      const res = await fetch(`/api/transaction-codes?propertyId=${properties[0].id}`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.filter((c: TransactionCode) => c.isManualPostAllowed));
      }
    } catch {
      // Codes not critical for viewing
    }
  }, []);

  useEffect(() => {
    fetchFolio();
    fetchCodes();
  }, [fetchFolio, fetchCodes]);

  const chargeCodes = codes.filter((c) => c.transactionType === "charge");
  const paymentCodes = codes.filter((c) => c.transactionType === "payment");
  const activeCodes = postFormMode === "charge" ? chargeCodes : paymentCodes;

  async function handlePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeWindowId) return;
    setPosting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const codeId = form.get("codeId") as string;
    const rawAmount = form.get("amount") as string;
    const amount = parseFloat(rawAmount);
    const description = form.get("description") as string;

    if (!codeId || isNaN(amount) || amount <= 0) {
      setError(t(dict, "folio.validationError"));
      setPosting(false);
      return;
    }

    const isPayment = postFormMode === "payment";
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
          folioWindowId: activeWindowId,
          ...(description ? { description } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to post");
        return;
      }

      setPostFormMode(null);
      await fetchFolio();
    } catch {
      setError("Network error");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{t(dict, "bookingDetail.loadingFolio")}</div>
        </div>
      </div>
    );
  }

  if (error && !folio) {
    return (
      <div className="card">
        <div className="card-body">
          <div style={{ color: "var(--cancelled)", fontSize: 13 }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!folio) return null;

  const activeWin = folio.windows.find((w) => w.id === activeWindowId) ?? folio.windows[0];

  return (
    <div>
      {folio.windows.map((w) => {
        const winTxns = folio.transactions.filter((tx) => tx.folioWindowId === w.id);
        const isActive = w.id === activeWindowId;
        return (
          <div key={w.id} className="folio-win">
            <div className="fh">
              <div>
                <div className="ti">
                  {t(dict, "bookingDetail.window")} {windowLetter(w.windowNumber)} · {w.label}
                </div>
                <div className="who">
                  {w.payeeType ?? "—"}
                  {w.paymentMethod ? ` · ${w.paymentMethod}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => {
                    setActiveWindowId(w.id);
                    setPostFormMode(postFormMode === "charge" && isActive ? null : "charge");
                  }}
                  disabled={posting}
                >
                  <Icon name="plus" size={11} />
                  {t(dict, "bookingDetail.windowCharge")}
                </button>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => {
                    setActiveWindowId(w.id);
                    setPostFormMode(postFormMode === "payment" && isActive ? null : "payment");
                  }}
                  disabled={posting}
                >
                  <Icon name="cash" size={11} />
                  {t(dict, "bookingDetail.windowPayment")}
                </button>
              </div>
            </div>

            {isActive && postFormMode && (
              <form
                onSubmit={handlePost}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr auto",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <select name="codeId" required className="select" style={{ fontSize: 12 }}>
                  <option value="">
                    {postFormMode === "charge"
                      ? t(dict, "bookingDetail.chargeCode")
                      : t(dict, "bookingDetail.paymentMethod")}
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
                  placeholder={t(dict, "bookingDetail.amountPlaceholder")}
                  className="input tnum"
                  style={{ fontSize: 12 }}
                />
                <input
                  name="description"
                  type="text"
                  placeholder={t(dict, "bookingDetail.descriptionPlaceholder")}
                  className="input"
                  style={{ fontSize: 12 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" disabled={posting} className="btn xs primary">
                    {posting
                      ? postFormMode === "charge"
                        ? t(dict, "bookingDetail.postingCharge")
                        : t(dict, "bookingDetail.processingPayment")
                      : t(dict, "bookingDetail.postCharge")}
                  </button>
                  <button type="button" onClick={() => setPostFormMode(null)} className="btn xs ghost">
                    {t(dict, "bookingDetail.cancelPost")}
                  </button>
                </div>
              </form>
            )}

            {winTxns.length === 0 ? (
              <div
                style={{
                  padding: "18px 14px",
                  color: "var(--muted)",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {t(dict, "bookingDetail.noTransactions")}
              </div>
            ) : (
              <table className="t">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>{t(dict, "bookingDetail.dateCol")}</th>
                    <th style={{ width: 80 }}>{t(dict, "bookingDetail.codeCol")}</th>
                    <th>{t(dict, "bookingDetail.descriptionCol")}</th>
                    <th className="r" style={{ width: 110 }}>
                      {t(dict, "bookingDetail.debit")}
                    </th>
                    <th className="r" style={{ width: 110 }}>
                      {t(dict, "bookingDetail.credit")}
                    </th>
                    <th style={{ width: 100 }}>{t(dict, "bookingDetail.byCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {winTxns.map((tx) => (
                    <tr key={tx.id}>
                      <td className="tnum" style={{ color: "var(--muted)" }}>
                        {tx.date}
                      </td>
                      <td className="tnum" style={{ fontSize: 11 }}>
                        {tx.transactionCode.code}
                      </td>
                      <td>
                        {tx.description || tx.transactionCode.description}
                        {tx.isSystemGenerated && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted-2)" }}>auto</span>
                        )}
                      </td>
                      <td className="r tnum">
                        {parseFloat(tx.debit) > 0 ? formatCurrency(tx.debit) : ""}
                      </td>
                      <td className="r tnum" style={{ color: "var(--checked-in)" }}>
                        {parseFloat(tx.credit) > 0 ? formatCurrency(tx.credit) : ""}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted-2)" }}>{tx.postedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="totals">
              <div className="t">
                <div className="k">{t(dict, "bookingDetail.posted")}</div>
                <div className="v">{formatCurrency(w.totalCharges)} ₽</div>
              </div>
              <div className="t">
                <div className="k">{t(dict, "bookingDetail.paid")}</div>
                <div className="v neg">{formatCurrency(w.totalPayments)} ₽</div>
              </div>
              <div className="t" style={{ marginLeft: "auto" }}>
                <div className="k">{t(dict, "bookingDetail.balance")}</div>
                <div className={`v ${w.balance > 0 ? "pos" : w.balance < 0 ? "neg" : "zero"}`}>
                  {formatCurrency(w.balance)} ₽
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {error && folio && (
        <div
          style={{
            padding: 10,
            background: "var(--cancelled-bg)",
            border: "1px solid var(--cancelled)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--cancelled-fg)",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="btn xs ghost"
            style={{ color: "var(--cancelled-fg)" }}
          >
            ×
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">{t(dict, "bookingDetail.totalBooking")}</div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {folio.windows.map((w) => (
            <div key={w.id} className="leg">
              <span className="lab">
                {t(dict, "bookingDetail.window")} {windowLetter(w.windowNumber)} · {w.label}
              </span>
              <strong className={w.balance > 0 ? "" : "muted"} style={w.balance === 0 ? { color: "var(--muted)" } : undefined}>
                {formatCurrency(w.balance)} ₽
              </strong>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
          <div className="leg">
            <span className="lab" style={{ color: "var(--fg)", fontWeight: 600 }}>
              {t(dict, "bookingDetail.dueOnCheckout")}
            </span>
            <strong style={{ color: folio.balance > 0 ? "var(--cancelled)" : "var(--muted)", fontSize: 15 }}>
              {formatCurrency(folio.balance)} ₽
            </strong>
          </div>
          {activeWin && folio.balance > 0 && (
            <button
              type="button"
              className="btn sm primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
              onClick={() => {
                setActiveWindowId(activeWin.id);
                setPostFormMode("payment");
              }}
            >
              <Icon name="cash" size={12} />
              {t(dict, "bookingDetail.acceptPayment")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
