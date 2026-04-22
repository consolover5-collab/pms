"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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
  const { dict } = useLocale();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "running" | "done">("idle");
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

  const stepIndex = step === "idle" ? 0 : step === "preview" ? 1 : step === "running" ? 2 : 3;
  const wizardSteps = [
    { key: "prep", label: t(dict, "nightAudit.preview") },
    { key: "review", label: t(dict, "nightAudit.previewTitle") },
    { key: "run", label: t(dict, "nightAudit.run") },
    { key: "done", label: t(dict, "nightAudit.complete") },
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t(dict, "nightAudit.title")}</h1>
        <span className="page-sub">
          {preview?.businessDate ? preview.businessDate : t(dict, "nightAudit.description")}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "var(--cancelled-bg)",
            border: "1px solid var(--cancelled)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--cancelled-fg)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn xs ghost">
            {t(dict, "nightAudit.dismiss")}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="wz-steps">
            {wizardSteps.map((s, i) => (
              <div key={s.key} className={`s ${i < stepIndex ? "done" : ""} ${i === stepIndex ? "active" : ""}`}>
                <div className="n">{i < stepIndex ? <Icon name="check" size={12} /> : i + 1}</div>
                <div>{s.label}</div>
              </div>
            ))}
          </div>

          {step === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                {t(dict, "nightAudit.description")}
              </p>
              <div>
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={loading || !propertyId}
                  className="btn primary"
                >
                  <Icon name="sparkles" size={13} />
                  {loading ? t(dict, "nightAudit.loading") : t(dict, "nightAudit.preview")}
                </button>
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid g4">
                  <div className="kpi">
                    <div className="lab">{t(dict, "nightAudit.roomsToCharge")}</div>
                    <div className="val">{preview.roomsToCharge}</div>
                  </div>
                  <div className="kpi">
                    <div className="lab">{t(dict, "nightAudit.estimatedRevenue")}</div>
                    <div className="val tnum">{formatCurrency(preview.estimatedRevenue)} ₽</div>
                  </div>
                  <div className="kpi">
                    <div className="lab">{t(dict, "nightAudit.dueToday")}</div>
                    <div className="val">{preview.dueToday}</div>
                  </div>
                  <div className="kpi">
                    <div className="lab">{t(dict, "nightAudit.overdueDueOut")}</div>
                    <div className="val" style={{ color: preview.overdueDueOuts > 0 ? "var(--cancelled)" : undefined }}>
                      {preview.overdueDueOuts}
                    </div>
                  </div>
                </div>

                {preview.overdueDueOuts > 0 && (
                  <div
                    style={{
                      padding: 12,
                      background: "var(--cancelled-bg)",
                      border: "1px solid var(--cancelled)",
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: "var(--cancelled-fg)",
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon name="alert" size={14} />
                    <div>
                      <strong>{t(dict, "nightAudit.overdueDueOut")}</strong> {preview.overdueDueOuts}
                      {" — "}
                      {t(dict, "nightAudit.blockingAudit")}
                    </div>
                  </div>
                )}

                {preview.pendingNoShowDetails && preview.pendingNoShowDetails.length > 0 && (
                  <div className="card">
                    <div className="card-head">
                      <div className="card-title">
                        {t(dict, "nightAudit.pendingNoShows", { count: preview.pendingNoShowDetails.length })}
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <p style={{ padding: "10px 14px", margin: 0, fontSize: 12, color: "var(--muted)" }}>
                        {t(dict, "nightAudit.noShowExplanation")}
                      </p>
                      <table className="t">
                        <thead>
                          <tr>
                            <th>{t(dict, "nightAudit.colBooking")}</th>
                            <th>{t(dict, "nightAudit.colGuest")}</th>
                            <th>{t(dict, "nightAudit.colCheckIn")}</th>
                            <th>{t(dict, "nightAudit.colGuarantee")}</th>
                            <th>{t(dict, "nightAudit.colAction")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.pendingNoShowDetails.map((b) => (
                            <tr key={b.id}>
                              <td className="tnum">{b.confirmationNumber}</td>
                              <td>{b.guestName}</td>
                              <td className="tnum">{b.checkInDate}</td>
                              <td style={{ color: "var(--muted)" }}>{b.guaranteeCode || "—"}</td>
                              <td>
                                <select
                                  value={noShowDecisions[b.id] ?? "no_show"}
                                  onChange={(e) =>
                                    setNoShowDecisions((prev) => ({
                                      ...prev,
                                      [b.id]: e.target.value as "no_show" | "cancel",
                                    }))
                                  }
                                  className="select"
                                  style={{ width: "auto", fontSize: 12, padding: "3px 8px" }}
                                >
                                  <option value="no_show">No Show</option>
                                  <option value="cancel">{t(dict, "nightAudit.cancel")}</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {preview.roomDetails && preview.roomDetails.length > 0 && (
                  <div className="card">
                    <div className="card-head">
                      <div className="card-title">{t(dict, "nightAudit.chargesBreakdown")}</div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <table className="t">
                        <thead>
                          <tr>
                            <th>{t(dict, "nightAudit.colRoom")}</th>
                            <th>{t(dict, "nightAudit.colGuest")}</th>
                            <th className="r">{t(dict, "nightAudit.colRate")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.roomDetails.map((rd, i) => (
                            <tr key={i}>
                              <td className="tnum">{rd.roomNumber}</td>
                              <td>{rd.guestName}</td>
                              <td className="r tnum">{formatCurrency(rd.rateAmount)} ₽</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="card">
                    <div className="card-head">
                      <div className="card-title">{t(dict, "nightAudit.warnings")}</div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      {preview.warnings.map((w, i) => (
                        <div key={i} className="alert med">
                          <div className="indic" />
                          <div className="tx">
                            <div>{w}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={runAudit} disabled={loading} className="btn primary">
                    {loading ? t(dict, "nightAudit.running") : t(dict, "nightAudit.run")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("idle");
                      setPreview(null);
                    }}
                    disabled={loading}
                    className="btn"
                  >
                    {t(dict, "nightAudit.cancel")}
                  </button>
                </div>
              </div>

              <div>
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">{t(dict, "nightAudit.previewTitle")}</div>
                  </div>
                  <div className="card-body" style={{ fontSize: 12 }}>
                    <div className="leg">
                      <span className="lab">{t(dict, "nightAudit.roomCharges")}</span>
                      <strong>{preview.roomsToCharge}</strong>
                    </div>
                    <div className="leg">
                      <span className="lab">{t(dict, "nightAudit.estimatedRevenue")}</span>
                      <strong>{formatCurrency(preview.estimatedRevenue)} ₽</strong>
                    </div>
                    <div className="leg">
                      <span className="lab">{t(dict, "nightAudit.dueToday")}</span>
                      <strong>{preview.dueToday}</strong>
                    </div>
                    <div className="leg">
                      <span className="lab">{t(dict, "nightAudit.noShows")}</span>
                      <strong>{preview.pendingNoShows}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  padding: 14,
                  background: "var(--checked-in-bg)",
                  border: "1px solid var(--checked-in)",
                  borderRadius: 8,
                  color: "var(--checked-in-fg)",
                  fontWeight: 500,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Icon name="check" size={14} />
                {t(dict, "nightAudit.complete")}
              </div>

              <div className="grid g4">
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.closedDate")}</div>
                  <div className="val tnum" style={{ fontSize: 16 }}>
                    {result.businessDate}
                  </div>
                </div>
                <div className="kpi accent">
                  <div className="lab">{t(dict, "nightAudit.newDate")}</div>
                  <div className="val tnum" style={{ fontSize: 16 }}>
                    {result.nextBusinessDate}
                  </div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.totalRevenue")}</div>
                  <div className="val tnum" style={{ fontSize: 18 }}>
                    {formatCurrency(result.totalRevenue)} ₽
                  </div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.roomCharges")}</div>
                  <div className="val">{result.roomChargesPosted}</div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.taxCharges")}</div>
                  <div className="val">{result.taxChargesPosted}</div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.noShows")}</div>
                  <div className="val">{result.noShows}</div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.cancelled")}</div>
                  <div className="val">{result.cancelled}</div>
                </div>
                <div className="kpi">
                  <div className="lab">{t(dict, "nightAudit.roomsDirty")}</div>
                  <div className="val">{result.roomsUpdated}</div>
                </div>
              </div>

              {result.oooRoomsRestored > 0 && (
                <div className="card">
                  <div className="card-body">
                    <div className="leg">
                      <span className="lab">{t(dict, "nightAudit.oooRestored")}</span>
                      <strong style={{ color: "var(--checked-in)" }}>{result.oooRoomsRestored}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("idle");
                    setPreview(null);
                    setResult(null);
                  }}
                  className="btn primary"
                >
                  {t(dict, "nightAudit.done")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
