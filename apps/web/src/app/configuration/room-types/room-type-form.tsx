"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RoomType = {
  id?: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string;
  sortOrder: number;
};

export function RoomTypeForm({
  roomType,
  propertyId,
  isEdit = false,
}: {
  roomType?: RoomType;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RoomType>({
    code: roomType?.code || "",
    name: roomType?.name || "",
    maxOccupancy: roomType?.maxOccupancy || 2,
    description: roomType?.description || "",
    sortOrder: roomType?.sortOrder || 0,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/room-types/${roomType?.id}`
        : `/api/room-types`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t(dict, "roomTypes.saveFailed"));
      }

      router.replace("/configuration/room-types");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, "roomTypes.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 640,
      }}
    >
      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            background: "var(--cancelled-bg)",
            color: "var(--cancelled-fg)",
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">
            {t(dict, "roomTypes.fld.code")}
            <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={10}
            className="input"
            placeholder={t(dict, "roomTypes.ph.code")}
          />
        </div>
        <div className="field">
          <label className="lab">
            {t(dict, "roomTypes.fld.name")}
            <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="input"
            placeholder={t(dict, "roomTypes.ph.name")}
          />
        </div>
      </div>

      <div className="field">
        <label className="lab">
          {t(dict, "roomTypes.fld.maxOccupancy")}
          <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
        </label>
        <input
          type="number"
          value={form.maxOccupancy}
          onChange={(e) =>
            setForm({ ...form, maxOccupancy: parseInt(e.target.value) || 2 })
          }
          required
          min={1}
          max={10}
          className="input tnum"
          style={{ maxWidth: 140 }}
        />
      </div>

      <div className="field">
        <label className="lab">{t(dict, "roomTypes.fld.description")}</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="input"
          style={{ resize: "vertical", minHeight: 72 }}
          placeholder={t(dict, "roomTypes.ph.description")}
        />
      </div>

      <div className="field">
        <label className="lab">{t(dict, "roomTypes.fld.sortOrder")}</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) =>
            setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
          }
          min={0}
          className="input tnum"
          style={{ maxWidth: 140 }}
        />
        <span className="hint">{t(dict, "roomTypes.fld.sortOrderHint")}</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="submit" disabled={loading} className="btn primary">
          {loading
            ? t(dict, "common.saving")
            : isEdit
              ? t(dict, "roomTypes.updateBtn")
              : t(dict, "roomTypes.createBtn")}
        </button>
        <Link href="/configuration/room-types" className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
