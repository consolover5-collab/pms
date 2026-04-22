"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { t, type DictionaryKey } from "@/lib/i18n";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  gender: string | null;
  language: string | null;
  dateOfBirth: string | null;
  vipStatus: string | null;
  notes: string | null;
};

const documentTypes: { value: string; labelKey: DictionaryKey }[] = [
  { value: "", labelKey: "guests.opt.notSpecified" },
  { value: "passport", labelKey: "guests.opt.doc.passport" },
  { value: "national_id", labelKey: "guests.opt.doc.nationalId" },
  { value: "drivers_license", labelKey: "guests.opt.doc.driversLicense" },
];

const genders: { value: string; labelKey: DictionaryKey }[] = [
  { value: "", labelKey: "guests.opt.notSpecified" },
  { value: "M", labelKey: "guests.opt.male" },
  { value: "F", labelKey: "guests.opt.female" },
];

const languages: { value: string; labelKey: DictionaryKey }[] = [
  { value: "", labelKey: "guests.opt.notSpecified" },
  { value: "EN", labelKey: "guests.opt.lang.en" },
  { value: "RU", labelKey: "guests.opt.lang.ru" },
  { value: "DE", labelKey: "guests.opt.lang.de" },
  { value: "FR", labelKey: "guests.opt.lang.fr" },
  { value: "ES", labelKey: "guests.opt.lang.es" },
  { value: "ZH", labelKey: "guests.opt.lang.zh" },
  { value: "JA", labelKey: "guests.opt.lang.ja" },
];

const required = (
  <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
);

export function GuestEditForm({ guest }: { guest: Guest }) {
  const router = useRouter();
  const { dict } = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const body: Record<string, unknown> = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
    };

    const optionalFields = [
      "email",
      "phone",
      "documentType",
      "documentNumber",
      "nationality",
      "gender",
      "language",
      "dateOfBirth",
      "notes",
    ];
    for (const field of optionalFields) {
      const value = form.get(field);
      body[field] = value && String(value).trim() ? value : null;
    }

    const vipStatus = form.get("vipStatus");
    body.vipStatus =
      vipStatus && String(vipStatus).trim() ? String(vipStatus).trim() : null;

    try {
      const res = await fetch(`/api/profiles/${guest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error: ${res.status}`);
      }

      router.replace(`/guests/${guest.id}`);
      router.refresh();
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
            type="text"
            required
            defaultValue={guest.firstName}
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
            type="text"
            required
            defaultValue={guest.lastName}
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
            defaultValue={guest.email || ""}
            className="input"
            data-testid="guest-form-email"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.phone")}</label>
          <input
            name="phone"
            type="tel"
            defaultValue={guest.phone || ""}
            className="input"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.gender")}</label>
          <select
            name="gender"
            defaultValue={guest.gender || ""}
            className="select"
          >
            {genders.map((g) => (
              <option key={g.value} value={g.value}>
                {t(dict, g.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.dob")}</label>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={guest.dateOfBirth || ""}
            className="input"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.nationality")}</label>
          <input
            name="nationality"
            type="text"
            maxLength={2}
            placeholder={t(dict, "guests.ph.nationality")}
            defaultValue={guest.nationality || ""}
            className="input"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.language")}</label>
          <select
            name="language"
            defaultValue={guest.language || ""}
            className="select"
          >
            {languages.map((l) => (
              <option key={l.value} value={l.value}>
                {t(dict, l.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.vipStatus")}</label>
          <select
            name="vipStatus"
            defaultValue={guest.vipStatus || ""}
            className="select"
          >
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
          <select
            name="documentType"
            defaultValue={guest.documentType || ""}
            className="select"
          >
            {documentTypes.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {t(dict, dt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "guests.fld.docNumber")}</label>
          <input
            name="documentNumber"
            type="text"
            defaultValue={guest.documentNumber || ""}
            className="input"
          />
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "guests.fld.notes")}</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={guest.notes || ""}
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
          {saving ? t(dict, "common.saving") : t(dict, "guests.updateBtn")}
        </button>
        <Link href={`/guests/${guest.id}`} className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
