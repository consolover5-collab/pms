"use client";

import { useState } from "react";
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
      <p className="text-sm text-gray-500">
        {t(dict, "roomRates.noTypes")}{" "}
        <a href="/configuration/room-types" className="text-blue-600 hover:underline">
          Room Types
        </a>
        .
      </p>
    );
  }

  return (
    <div className="border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">{t(dict, "roomRates.colRoomType")}</th>
            <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">{t(dict, "roomRates.colPrice")}</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {roomTypes.map((rt) => {
            const isSaving = saving === rt.id;
            const isSaved = saved === rt.id;
            const hasRate = rt.id in rates;
            return (
              <tr key={rt.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="font-medium">{rt.name}</span>
                  <span className="ml-1 text-xs text-gray-400 font-mono">({rt.code})</span>
                </td>
                <td className="px-4 py-2">
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
                    className="w-32 border rounded px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                  {isSaved ? (
                    <span className="text-xs text-green-600">✓ {t(dict, "roomRates.saved")}</span>
                  ) : (
                    <button
                      onClick={() => handleSave(rt.id)}
                      disabled={isSaving || !rates[rt.id]}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                    >
                      {isSaving ? "..." : t(dict, "roomRates.save")}
                    </button>
                  )}
                  {hasRate && !isSaved && (
                    <button
                      onClick={() => handleClear(rt.id)}
                      disabled={isSaving}
                      className="text-xs text-red-500 hover:underline disabled:opacity-40"
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
      <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
        {t(dict, "roomRates.hint")}
      </p>
    </div>
  );
}
