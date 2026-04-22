"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RatePlan = {
  id?: string;
  code: string;
  name: string;
  description: string;
  baseRate: string;
  isDefault: boolean;
  isActive: boolean;
};

export function RatePlanForm({
  ratePlan,
  propertyId,
  isEdit = false,
}: {
  ratePlan?: RatePlan;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RatePlan>({
    code: ratePlan?.code || "",
    name: ratePlan?.name || "",
    description: ratePlan?.description || "",
    baseRate: ratePlan?.baseRate || "",
    isDefault: ratePlan?.isDefault ?? false,
    isActive: ratePlan?.isActive ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/rate-plans/${ratePlan?.id}`
        : `/api/rate-plans`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
          baseRate: form.baseRate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t(dict, "ratePlans.saveFailed"));
      }

      router.replace("/configuration/rate-plans");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, "ratePlans.saveFailed"));
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
            {t(dict, "ratePlans.fld.code")}
            <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={20}
            className="input"
            placeholder={t(dict, "ratePlans.ph.code")}
          />
        </div>
        <div className="field">
          <label className="lab">
            {t(dict, "ratePlans.fld.name")}
            <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="input"
            placeholder={t(dict, "ratePlans.ph.name")}
          />
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "ratePlans.fld.baseRate")}</label>
        <input
          type="number"
          value={form.baseRate}
          onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
          min={0}
          step={0.01}
          className="input tnum"
          placeholder={t(dict, "ratePlans.ph.baseRate")}
          style={{ maxWidth: 220 }}
        />
        <span className="hint">{t(dict, "ratePlans.fld.baseRateHint")}</span>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "ratePlans.fld.description")}</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="input"
          style={{ resize: "vertical", minHeight: 72 }}
          placeholder={t(dict, "ratePlans.ph.description")}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label
          style={{
            display: "inline-flex",
            gap: 8,
            fontSize: 13,
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          <span style={{ fontWeight: 500 }}>
            {t(dict, "ratePlans.fld.isDefault")}
          </span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            {t(dict, "ratePlan.defaultHint")}
          </span>
        </label>
        <label
          style={{
            display: "inline-flex",
            gap: 8,
            fontSize: 13,
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span style={{ fontWeight: 500 }}>
            {t(dict, "ratePlans.fld.isActive")}
          </span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            {t(dict, "ratePlans.fld.isActiveHint")}
          </span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="submit" disabled={loading} className="btn primary">
          {loading
            ? t(dict, "common.saving")
            : isEdit
              ? t(dict, "ratePlans.updateBtn")
              : t(dict, "ratePlans.createBtn")}
        </button>
        <Link href="/configuration/rate-plans" className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
