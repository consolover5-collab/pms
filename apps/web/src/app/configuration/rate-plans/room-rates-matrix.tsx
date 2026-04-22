"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RoomType = { id: string; name: string; code: string };
type RoomRate = {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  amount: string;
};

export function RoomRatesMatrix({
  ratePlanId,
  roomTypes,
  roomRates: initialRates,
}: {
  ratePlanId: string;
  roomTypes: RoomType[];
  roomRates: RoomRate[];
}) {
  const { dict } = useLocale();
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of initialRates) {
      map[r.roomTypeId] = r.amount;
    }
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave(roomTypeId: string) {
    const amount = rates[roomTypeId];
    if (!amount || isNaN(Number(amount))) return;

    setSaving(roomTypeId);
    try {
      const res = await fetch(`/api/rate-plans/${ratePlanId}/room-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomTypeId, amount }),
      });
      if (res.ok) {
        setSaved(roomTypeId);
        setTimeout(() => setSaved(null), 1500);
      }
    } finally {
      setSaving(null);
    }
  }

  async function handleClear(roomTypeId: string) {
    setSaving(roomTypeId);
    try {
      await fetch(`/api/rate-plans/${ratePlanId}/room-rates/${roomTypeId}`, {
        method: "DELETE",
      });
      setRates((prev) => {
        const next = { ...prev };
        delete next[roomTypeId];
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  if (roomTypes.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        {t(dict, "roomRates.noTypes")}{" "}
        <Link
          href="/configuration/room-types"
          style={{ color: "var(--accent)", textDecoration: "underline" }}
        >
          {t(dict, "roomRates.roomTypesLink")}
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <table className="t">
        <thead>
          <tr>
            <th>{t(dict, "roomRates.colRoomType")}</th>
            <th className="r">{t(dict, "roomRates.colPrice")}</th>
            <th className="r" />
          </tr>
        </thead>
        <tbody>
          {roomTypes.map((rt) => {
            const isSaving = saving === rt.id;
            const isSaved = saved === rt.id;
            const hasRate = rt.id in rates;
            return (
              <tr key={rt.id} data-testid="rate-matrix-row">
                <td>
                  <span style={{ fontWeight: 500 }}>{rt.name}</span>
                  <span
                    className="tnum"
                    style={{
                      marginLeft: 6,
                      fontSize: 11.5,
                      color: "var(--muted-2)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ({rt.code})
                  </span>
                </td>
                <td className="r">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={rates[rt.id] ?? ""}
                    onChange={(e) =>
                      setRates((prev) => ({ ...prev, [rt.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleSave(rt.id)}
                    placeholder="—"
                    className="input tnum"
                    style={{ width: 120, textAlign: "right" }}
                  />
                </td>
                <td
                  className="r"
                  style={{
                    whiteSpace: "nowrap",
                    display: "flex",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  {isSaved ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "var(--checked-in-fg)",
                        alignSelf: "center",
                      }}
                    >
                      {t(dict, "roomRates.saved")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSave(rt.id)}
                      disabled={isSaving || !rates[rt.id]}
                      className="btn xs"
                    >
                      {isSaving ? "…" : t(dict, "roomRates.save")}
                    </button>
                  )}
                  {hasRate && !isSaved && (
                    <button
                      type="button"
                      onClick={() => handleClear(rt.id)}
                      disabled={isSaving}
                      className="btn xs danger"
                    >
                      {t(dict, "common.delete")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p
        style={{
          margin: 0,
          padding: "8px 12px",
          fontSize: 11.5,
          color: "var(--muted)",
          background: "var(--bg-subtle)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {t(dict, "roomRates.hint")}
      </p>
    </div>
  );
}
