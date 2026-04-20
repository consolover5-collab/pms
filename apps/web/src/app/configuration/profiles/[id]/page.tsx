import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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

function LabVal({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fg)" }}>{value ?? "—"}</div>
    </div>
  );
}

const typeBadgeClass: Record<string, string> = {
  individual: "checked-in",
  company: "confirmed",
  travel_agent: "checked-out",
  source: "no-show",
  contact: "cancelled",
};

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;

  let profile: Profile;
  try {
    profile = await apiFetch<Profile>(`/api/profiles/${id}`);
  } catch {
    notFound();
  }

  const typeLabels: Record<string, string> = {
    individual: t(dict, "profiles.typeIndividual"),
    company: t(dict, "profiles.typeCompany"),
    travel_agent: t(dict, "profiles.typeAgent"),
    source: t(dict, "profiles.typeSource"),
    contact: t(dict, "profiles.typeContact"),
  };

  const initials = (profile.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/profiles" style={{ color: "var(--muted)" }}>
          ← {t(dict, "profiles.backToList")}
        </Link>
      </div>

      <div className="page-head" style={{ alignItems: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 600,
            flexShrink: 0,
            marginRight: 8,
          }}
        >
          {initials}
        </div>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {profile.name}
            <span className={`badge ${typeBadgeClass[profile.type] || ""}`}>
              <span className="dot" />
              {typeLabels[profile.type] || profile.type}
            </span>
            <span className={`badge ${profile.isActive ? "checked-in" : "cancelled"}`}>
              <span className="dot" />
              {profile.isActive ? t(dict, "profiles.active") : t(dict, "profiles.inactive")}
            </span>
          </h1>
          <span className="page-sub">
            {profile.email || "—"} · {profile.phone || "—"}
          </span>
        </div>
        <div className="actions">
          <Link href={`/configuration/profiles/${profile.id}/edit`} className="btn sm primary">
            <Icon name="settings" size={12} />
            {t(dict, "profiles.editBtn")}
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t(dict, "profiles.section.general")}</div>
          </div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <LabVal label={t(dict, "profiles.fld.name")} value={profile.name} />
            <LabVal label={t(dict, "profiles.fld.email")} value={profile.email} />
            <LabVal label={t(dict, "profiles.fld.phone")} value={profile.phone} />
            <LabVal
              label={t(dict, "profiles.fld.status")}
              value={profile.isActive ? t(dict, "profiles.active") : t(dict, "profiles.inactive")}
            />
          </div>
        </div>

        {profile.type === "individual" && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t(dict, "profiles.section.personal")}</div>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LabVal label={t(dict, "profiles.fld.firstName")} value={profile.firstName} />
              <LabVal label={t(dict, "profiles.fld.lastName")} value={profile.lastName} />
              <LabVal label={t(dict, "profiles.fld.dob")} value={profile.dateOfBirth} />
              <LabVal label={t(dict, "profiles.fld.nationality")} value={profile.nationality} />
              <LabVal label={t(dict, "profiles.fld.gender")} value={profile.gender} />
              <LabVal label={t(dict, "profiles.fld.language")} value={profile.language} />
              <LabVal label={t(dict, "profiles.fld.passport")} value={profile.passportNumber} />
              <LabVal label={t(dict, "profiles.fld.docType")} value={profile.documentType} />
              <LabVal label={t(dict, "profiles.fld.vip")} value={profile.vipStatus} />
            </div>
          </div>
        )}

        {profile.type === "company" && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t(dict, "profiles.section.company")}</div>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LabVal label={t(dict, "profiles.fld.shortName")} value={profile.shortName} />
              <LabVal label={t(dict, "profiles.fld.taxId")} value={profile.taxId} />
              <LabVal label={t(dict, "profiles.fld.regNumber")} value={profile.registrationNumber} />
              <LabVal label={t(dict, "profiles.fld.address")} value={profile.address} />
              <LabVal label={t(dict, "profiles.fld.creditLimit")} value={profile.creditLimit} />
              <LabVal
                label={t(dict, "profiles.fld.paymentTerms")}
                value={profile.paymentTermDays ?? null}
              />
              <LabVal label={t(dict, "profiles.fld.arAccount")} value={profile.arAccountNumber} />
              <LabVal label={t(dict, "profiles.fld.contactPerson")} value={profile.contactPerson} />
              <LabVal label={t(dict, "profiles.fld.contactTitle")} value={profile.contactTitle} />
            </div>
          </div>
        )}

        {profile.type === "travel_agent" && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t(dict, "profiles.section.agent")}</div>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LabVal label={t(dict, "profiles.fld.iataCode")} value={profile.iataCode} />
              <LabVal label={t(dict, "profiles.fld.commission")} value={profile.commissionPercent} />
              <LabVal label={t(dict, "profiles.fld.contactPerson")} value={profile.contactPerson} />
              <LabVal label={t(dict, "profiles.fld.contactTitle")} value={profile.contactTitle} />
            </div>
          </div>
        )}

        {profile.type === "source" && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t(dict, "profiles.section.source")}</div>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LabVal label={t(dict, "profiles.fld.sourceCode")} value={profile.sourceCode} />
              <LabVal label={t(dict, "profiles.fld.channelType")} value={profile.channelType} />
            </div>
          </div>
        )}

        {profile.notes && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-head">
              <div className="card-title">{t(dict, "profiles.section.notes")}</div>
            </div>
            <div className="card-body" style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
              {profile.notes}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
