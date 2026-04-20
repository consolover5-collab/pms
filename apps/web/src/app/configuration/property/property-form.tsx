"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type Property = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfRooms: number | null;
  numberOfFloors: number | null;
  taxRate: string | null;
};

const required = (
  <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
);

export function PropertyForm({ property }: { property: Property }) {
  const { dict } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: property.name,
    code: property.code,
    address: property.address || "",
    city: property.city || "",
    country: property.country || "",
    timezone: property.timezone,
    currency: property.currency,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    numberOfRooms: property.numberOfRooms || 0,
    numberOfFloors: property.numberOfFloors || 0,
    taxRate: property.taxRate || "0",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const url = `/api/properties/${property.id}`;

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError({
          error: data.error || `Server error: ${res.status}`,
          code: data.code,
          status: res.status,
          url,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError({
          error: t(dict, "property.networkError"),
          code: "NETWORK_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      } else {
        setError({
          error: err instanceof Error ? err.message : t(dict, "property.saveFailed"),
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--fg)",
    marginBottom: 4,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 640,
      }}
    >
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
      {success && (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            background: "var(--checked-in-bg)",
            color: "var(--checked-in-fg)",
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          {t(dict, "property.savedOk")}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sectionTitle}>{t(dict, "property.section.general")}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="lab">
              {t(dict, "property.fld.name")}
              {required}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input"
            />
          </div>
          <div className="field">
            <label className="lab">
              {t(dict, "property.fld.code")}
              {required}
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              maxLength={10}
              className="input"
            />
          </div>
        </div>

        <div className="field">
          <label className="lab">{t(dict, "property.fld.address")}</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="input"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.city")}</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
          </div>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.country")}</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              maxLength={2}
              className="input"
              placeholder="RU"
            />
          </div>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sectionTitle}>{t(dict, "property.section.operations")}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.checkInTime")}</label>
            <input
              type="time"
              value={form.checkInTime}
              onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
              className="input tnum"
            />
          </div>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.checkOutTime")}</label>
            <input
              type="time"
              value={form.checkOutTime}
              onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
              className="input tnum"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.timezone")}</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="select"
            >
              <option value="UTC">UTC</option>
              <option value="Europe/Moscow">Europe/Moscow</option>
              <option value="Europe/Kaliningrad">Europe/Kaliningrad</option>
              <option value="Asia/Yekaterinburg">Asia/Yekaterinburg</option>
              <option value="Asia/Novosibirsk">Asia/Novosibirsk</option>
              <option value="Asia/Vladivostok">Asia/Vladivostok</option>
            </select>
          </div>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.currency")}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="select"
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="lab">{t(dict, "property.fld.taxRate")}</label>
          <input
            type="number"
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            min={0}
            max={100}
            step={0.01}
            className="input tnum"
            placeholder="20"
            style={{ maxWidth: 180 }}
          />
          <span className="hint">{t(dict, "property.taxRateHint")}</span>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sectionTitle}>{t(dict, "property.section.capacity")}</div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {t(dict, "property.section.capacityHint")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.numberOfRooms")}</label>
            <input
              type="number"
              value={form.numberOfRooms}
              onChange={(e) =>
                setForm({ ...form, numberOfRooms: parseInt(e.target.value) || 0 })
              }
              min={0}
              className="input tnum"
            />
          </div>
          <div className="field">
            <label className="lab">{t(dict, "property.fld.numberOfFloors")}</label>
            <input
              type="number"
              value={form.numberOfFloors}
              onChange={(e) =>
                setForm({ ...form, numberOfFloors: parseInt(e.target.value) || 0 })
              }
              min={0}
              className="input tnum"
            />
          </div>
        </div>
      </section>

      <div>
        <button type="submit" disabled={loading} className="btn primary">
          {loading ? t(dict, "common.saving") : t(dict, "property.saveBtn")}
        </button>
      </div>
    </form>
  );
}
