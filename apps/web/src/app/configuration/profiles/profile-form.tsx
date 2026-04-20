"use client";

import { useRouter } from "next/navigation";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { t, type DictionaryKey } from "@/lib/i18n";

type Profile = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  gender: string | null;
  language: string | null;
  passportNumber: string | null;
  documentType: string | null;
  vipStatus: string | null;
  shortName: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  address: string | null;
  creditLimit: string | null;
  paymentTermDays: number | null;
  arAccountNumber: string | null;
  iataCode: string | null;
  commissionPercent: string | null;
  sourceCode: string | null;
  channelType: string | null;
  contactPerson: string | null;
  contactTitle: string | null;
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="lab">
        {label}
        {required && (
          <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}

function TextField({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} required={required}>
      <input {...props} className="input" />
    </Field>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

export function ProfileForm({ profile }: { profile?: Profile }) {
  const router = useRouter();
  const { dict } = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!profile;
  const type =
    profile?.type ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("type")
      : null) ||
    "individual";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};

    if (!isEdit) {
      body.propertyId = "ff1d9135-dfb9-4baa-be46-0e739cd26dad";
      body.type = type;
    }

    for (const [key, val] of form.entries()) {
      if (val === "") continue;
      body[key] = val;
    }

    if (type === "individual" && !body.name && (body.firstName || body.lastName)) {
      body.name = [body.firstName, body.lastName].filter(Boolean).join(" ");
    }

    try {
      const res = await fetch(
        isEdit ? `/api/profiles/${profile.id}` : "/api/profiles",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Server error: ${res.status}`);
        setSaving(false);
        return;
      }

      router.replace("/configuration/profiles");
    } catch {
      setError(t(dict, "profiles.networkError"));
      setSaving(false);
    }
  }

  const typeLabelKey: DictionaryKey =
    type === "company"
      ? "profiles.typeCompany"
      : type === "travel_agent"
        ? "profiles.typeAgent"
        : type === "source"
          ? "profiles.typeSource"
          : "profiles.typeIndividual";

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

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {t(dict, "profiles.typeLabel")}:{" "}
        <strong style={{ color: "var(--fg)", fontWeight: 600 }}>
          {t(dict, typeLabelKey)}
        </strong>
      </div>

      {type === "individual" && (
        <Row>
          <TextField
            label={t(dict, "profiles.fld.firstName")}
            required
            name="firstName"
            defaultValue={profile?.firstName || ""}
          />
          <TextField
            label={t(dict, "profiles.fld.lastName")}
            required
            name="lastName"
            defaultValue={profile?.lastName || ""}
          />
        </Row>
      )}

      <TextField
        label={t(dict, "profiles.fld.name")}
        required
        name="name"
        defaultValue={profile?.name || ""}
      />

      <Row>
        <TextField
          label={t(dict, "profiles.fld.email")}
          name="email"
          type="email"
          defaultValue={profile?.email || ""}
        />
        <TextField
          label={t(dict, "profiles.fld.phone")}
          name="phone"
          defaultValue={profile?.phone || ""}
        />
      </Row>

      {type === "individual" && (
        <>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.dob")}
              name="dateOfBirth"
              type="date"
              defaultValue={profile?.dateOfBirth || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.nationality")}
              name="nationality"
              defaultValue={profile?.nationality || ""}
            />
          </Row>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.gender")}
              name="gender"
              defaultValue={profile?.gender || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.language")}
              name="language"
              defaultValue={profile?.language || ""}
            />
          </Row>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.docType")}
              name="documentType"
              defaultValue={profile?.documentType || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.passport")}
              name="passportNumber"
              defaultValue={profile?.passportNumber || ""}
            />
          </Row>
          <TextField
            label={t(dict, "profiles.fld.vip")}
            name="vipStatus"
            defaultValue={profile?.vipStatus || ""}
          />
        </>
      )}

      {type === "company" && (
        <>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.shortName")}
              name="shortName"
              defaultValue={profile?.shortName || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.taxId")}
              name="taxId"
              defaultValue={profile?.taxId || ""}
            />
          </Row>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.regNumber")}
              name="registrationNumber"
              defaultValue={profile?.registrationNumber || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.arAccount")}
              name="arAccountNumber"
              defaultValue={profile?.arAccountNumber || ""}
            />
          </Row>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.creditLimit")}
              name="creditLimit"
              defaultValue={profile?.creditLimit || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.paymentTerms")}
              name="paymentTermDays"
              defaultValue={profile?.paymentTermDays?.toString() || ""}
            />
          </Row>
          <TextField
            label={t(dict, "profiles.fld.address")}
            name="address"
            defaultValue={profile?.address || ""}
          />
          <Row>
            <TextField
              label={t(dict, "profiles.fld.contactPerson")}
              name="contactPerson"
              defaultValue={profile?.contactPerson || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.contactTitle")}
              name="contactTitle"
              defaultValue={profile?.contactTitle || ""}
            />
          </Row>
        </>
      )}

      {type === "travel_agent" && (
        <>
          <Row>
            <TextField
              label={t(dict, "profiles.fld.iataCode")}
              name="iataCode"
              defaultValue={profile?.iataCode || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.commission")}
              name="commissionPercent"
              defaultValue={profile?.commissionPercent || ""}
              disabled
            />
          </Row>
          <TextField
            label={t(dict, "profiles.fld.address")}
            name="address"
            defaultValue={profile?.address || ""}
          />
          <Row>
            <TextField
              label={t(dict, "profiles.fld.contactPerson")}
              name="contactPerson"
              defaultValue={profile?.contactPerson || ""}
            />
            <TextField
              label={t(dict, "profiles.fld.contactTitle")}
              name="contactTitle"
              defaultValue={profile?.contactTitle || ""}
            />
          </Row>
        </>
      )}

      {type === "source" && (
        <>
          <TextField
            label={t(dict, "profiles.fld.sourceCode")}
            name="sourceCode"
            defaultValue={profile?.sourceCode || ""}
          />
          <Field label={t(dict, "profiles.fld.channelType")}>
            <select
              name="channelType"
              defaultValue={profile?.channelType || ""}
              className="select"
            >
              <option value="">{t(dict, "profiles.channel.none")}</option>
              <option value="direct">{t(dict, "profiles.channel.direct")}</option>
              <option value="ota">{t(dict, "profiles.channel.ota")}</option>
              <option value="gds">{t(dict, "profiles.channel.gds")}</option>
              <option value="corporate">
                {t(dict, "profiles.channel.corporate")}
              </option>
              <option value="walkin">{t(dict, "profiles.channel.walkin")}</option>
              <option value="other">{t(dict, "profiles.channel.other")}</option>
            </select>
          </Field>
        </>
      )}

      <Field label={t(dict, "profiles.fld.notes")}>
        <textarea
          name="notes"
          defaultValue={profile?.notes || ""}
          rows={3}
          className="input"
          style={{ resize: "vertical", minHeight: 72 }}
        />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="submit" disabled={saving} className="btn primary">
          {saving
            ? t(dict, "common.saving")
            : isEdit
              ? t(dict, "profiles.updateBtn")
              : t(dict, "profiles.createBtn")}
        </button>
        <button
          type="button"
          onClick={() => router.replace("/configuration/profiles")}
          className="btn ghost"
        >
          {t(dict, "common.cancel")}
        </button>
      </div>
    </form>
  );
}
