"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Session = {
  id: string;
  propertyId: string;
  cashierNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
};

type Summary = {
  totalDebit: string;
  totalCredit: string;
  transactionCount: number;
};

export default function CashierPage() {
  const { dict } = useLocale();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (pid: string) => {
    try {
      const [cur, list] = await Promise.all([
        fetch("/api/cashier/current").then((r) => r.json()),
        fetch(`/api/cashier/sessions?propertyId=${pid}&limit=10`).then((r) => r.json()),
      ]);
      setSession(cur.session);
      setSummary(cur.summary ?? null);
      setSessions(list.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((props) => {
        if (props.length) {
          setPropertyId(props[0].id);
          fetchData(props[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [fetchData]);

  async function openSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!propertyId) return;
    setOpening(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/cashier/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          cashierNumber: parseInt(form.get("cashierNumber") as string, 10),
          openingBalance: (form.get("openingBalance") as string) || "0",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t(dict, "cashier.openingError"));
        return;
      }
      await fetchData(propertyId);
    } finally {
      setOpening(false);
    }
  }

  async function closeSession() {
    if (!propertyId) return;
    const closing = prompt(t(dict, "cashier.closingBalance"), "0");
    if (closing === null) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch("/api/cashier/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingBalance: closing }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t(dict, "cashier.closingError"));
        return;
      }
      await fetchData(propertyId);
    } finally {
      setClosing(false);
    }
  }

  const turnover = summary ? parseFloat(summary.totalCredit) - parseFloat(summary.totalDebit) : 0;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title" data-testid="cashier-title">{t(dict, "cashier.title")}</h1>
        <span className="page-sub" data-testid="cashier-subtitle">
          {session
            ? t(dict, "cashier.shiftNumber", { number: session.cashierNumber })
            : t(dict, "cashier.subtitle")}
        </span>
        <div className="actions">
          {session && (
            <button
              type="button"
              onClick={closeSession}
              disabled={closing}
              className="btn sm danger"
              data-testid="cashier-close-session-button"
            >
              <Icon name="logout" size={12} />
              {closing ? t(dict, "common.loading") : t(dict, "cashier.closeSession")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          data-testid="cashier-error-banner"
          style={{
            padding: 12,
            background: "var(--cancelled-bg)",
            border: "1px solid var(--cancelled)",
            borderRadius: 8,
            color: "var(--cancelled-fg)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn xs ghost">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div data-testid="cashier-loading" style={{ color: "var(--muted)" }}>{t(dict, "common.loading")}</div>
      ) : session ? (
        <>
          <div className="grid g4" data-testid="cashier-kpi-grid">
            <div className="kpi accent" data-testid="cashier-kpi-turnover">
              <div className="lab">{t(dict, "cashier.turnover")}</div>
              <div className="val tnum">{formatCurrency(turnover)} ₽</div>
              <div className="foot">
                {summary?.transactionCount ?? 0} {t(dict, "cashier.operations")}
              </div>
            </div>
            <div className="kpi" data-testid="cashier-kpi-credit">
              <div className="lab">{t(dict, "cashier.credit")}</div>
              <div className="val tnum">
                {summary ? formatCurrency(summary.totalCredit) : "0"} ₽
              </div>
            </div>
            <div className="kpi" data-testid="cashier-kpi-debit">
              <div className="lab">{t(dict, "cashier.debit")}</div>
              <div className="val tnum">
                {summary ? formatCurrency(summary.totalDebit) : "0"} ₽
              </div>
            </div>
            <div className="kpi" data-testid="cashier-kpi-shift">
              <div className="lab">{t(dict, "cashier.openedAt", { time: new Date(session.openedAt).toLocaleTimeString() })}</div>
              <div className="val" style={{ fontSize: 16 }}>
                №{session.cashierNumber}
              </div>
              <div className="foot">
                {t(dict, "cashier.openingBalance")}:{" "}
                <span className="tnum">{formatCurrency(session.openingBalance || "0")} ₽</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card" data-testid="cashier-no-session-card">
          <div className="card-head">
            <div className="card-title" data-testid="cashier-no-session-title">{t(dict, "cashier.noSession")}</div>
          </div>
          <div className="card-body">
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
              {t(dict, "cashier.noSessionDesc")}
            </p>
            <form
              onSubmit={openSession}
              data-testid="cashier-open-form"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <label htmlFor="cashierNumber" style={{ fontSize: 12, color: "var(--muted)" }}>
                {t(dict, "cashier.cashierNumber")}
              </label>
              <input
                id="cashierNumber"
                name="cashierNumber"
                type="number"
                min={1}
                defaultValue={1}
                required
                className="input"
                data-testid="cashier-field-number"
                style={{ maxWidth: 120 }}
              />
              <label htmlFor="openingBalance" style={{ fontSize: 12, color: "var(--muted)" }}>
                {t(dict, "cashier.openingBalance")}
              </label>
              <input
                id="openingBalance"
                name="openingBalance"
                type="number"
                step="0.01"
                defaultValue="0"
                className="input tnum"
                data-testid="cashier-field-opening-balance"
                style={{ maxWidth: 180 }}
              />
              <button
                type="submit"
                disabled={opening}
                className="btn primary"
                data-testid="cashier-open-session-button"
              >
                <Icon name="key" size={12} />
                {opening ? t(dict, "common.loading") : t(dict, "cashier.openSession")}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card" data-testid="cashier-recent-sessions-card">
        <div className="card-head">
          <div className="card-title">
            {t(dict, "cashier.recentSessions")} <span className="count">{sessions.length}</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {sessions.length === 0 ? (
            <div
              data-testid="cashier-sessions-empty"
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              {t(dict, "cashier.emptySessions")}
            </div>
          ) : (
            <table className="t" data-testid="cashier-sessions-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>{t(dict, "cashier.colNumber")}</th>
                  <th>{t(dict, "cashier.colOpened")}</th>
                  <th>{t(dict, "cashier.colClosed")}</th>
                  <th className="r">{t(dict, "cashier.colOpening")}</th>
                  <th className="r">{t(dict, "cashier.colClosing")}</th>
                  <th>{t(dict, "cashier.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} data-testid="cashier-session-row" data-session-id={s.id}>
                    <td className="tnum">#{s.cashierNumber}</td>
                    <td className="tnum" style={{ color: "var(--muted)" }}>
                      {new Date(s.openedAt).toLocaleString()}
                    </td>
                    <td className="tnum" style={{ color: "var(--muted)" }}>
                      {s.closedAt ? new Date(s.closedAt).toLocaleString() : "—"}
                    </td>
                    <td className="r tnum">{formatCurrency(s.openingBalance || "0")} ₽</td>
                    <td className="r tnum">
                      {s.closingBalance ? `${formatCurrency(s.closingBalance)} ₽` : "—"}
                    </td>
                    <td>
                      <span className={`badge ${s.status === "open" ? "checked-in" : "checked-out"}`}>
                        <span className="dot" />
                        {s.status === "open" ? t(dict, "cashier.statusOpen") : t(dict, "cashier.statusClosed")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
