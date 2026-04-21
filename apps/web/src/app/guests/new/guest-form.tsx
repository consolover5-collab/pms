"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

const required = (
  <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
);

export function GuestForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { dict } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const body: Record<string, unknown> = {
      propertyId,
      type: "individual",
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
    };

    for (const key of [
      "email",
      "phone",
      "nationality",
      "gender",
      "language",
      "dateOfBirth",
      "documentType",
      "documentNumber",
      "notes",
    ]) {
      const val = form.get(key);
      if (val && String(val).trim()) body[key] = String(val).trim();
    }
    const vip = form.get("vipStatus");
    if (vip && String(vip).trim()) body.vipStatus = String(vip).trim();

    try {
      const res = await fetch(`/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const guest = await res.json();
      router.replace(`/guests/${guest.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, "guests.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 720,
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
            {t(dict, "guests.fld.firstName")}
            {required}
          </label>
          <input
            name="firstName"
            required
            className="input"
            data-testid="guest-form-first-name"
          />
        </div>
        <div className="field">
          <label className="lab">
            {t(dict, "guests.fld.lastName")}
            {required}
          </label>
          <input
            name="lastName"
            required
            className="input"
            data-testid="guest-form-last-name"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.email")}</label>
          <input
            name="email"
            type="email"
            className="input"
            data-testid="guest-form-email"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.phone")}</label>
          <input name="phone" type="tel" className="input" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.gender")}</label>
          <select name="gender" className="select">
            <option value="">—</option>
            <option value="M">{t(dict, "guests.opt.male")}</option>
            <option value="F">{t(dict, "guests.opt.female")}</option>
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.nationality")}</label>
          <input
            name="nationality"
            maxLength={3}
            placeholder={t(dict, "guests.ph.nationality")}
            className="input"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.language")}</label>
          <input
            name="language"
            maxLength={10}
            placeholder={t(dict, "guests.ph.language")}
            className="input"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.dob")}</label>
          <input name="dateOfBirth" type="date" className="input" />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.vipStatus")}</label>
          <select name="vipStatus" className="select">
            <option value="">{t(dict, "guests.opt.none")}</option>
            <option value="VIP1">VIP 1</option>
            <option value="VIP2">VIP 2</option>
            <option value="VIP3">VIP 3</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.docType")}</label>
          <input
            name="documentType"
            placeholder={t(dict, "guests.ph.documentType")}
            className="input"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.docNumber")}</label>
          <input name="documentNumber" className="input" />
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "guests.fld.notes")}</label>
        <textarea
          name="notes"
          rows={3}
          className="input"
          style={{ resize: "vertical", minHeight: 72 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="submit"
          disabled={saving}
          className="btn primary"
          data-testid="guest-form-submit"
        >
          {saving ? t(dict, "common.saving") : t(dict, "guests.createBtn")}
        </button>
        <Link href="/guests" className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
