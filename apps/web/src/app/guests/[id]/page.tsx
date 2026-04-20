import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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
  vipStatus: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function LabVal({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fg)" }}>{value || "—"}</div>
    </div>
  );
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;
  const guest = await apiFetch<Guest>(`/api/profiles/${id}`);

  const genderLabel: Record<string, string> = {
    M: t(dict, "guests.genderMale"),
    F: t(dict, "guests.genderFemale"),
  };

  const initials =
    (guest.firstName?.[0] || "") + (guest.lastName?.[0] || "") || "?";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/guests" style={{ color: "var(--muted)" }}>
          ← {t(dict, "guests.backToGuests")}
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
          {initials.toUpperCase()}
        </div>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {guest.firstName} {guest.lastName}
            {guest.vipStatus != null && (
              <span className="badge no-show">
                <span className="dot" />
                VIP {guest.vipStatus}
              </span>
            )}
          </h1>
          <span className="page-sub">
            {guest.email || "—"} · {guest.phone || "—"}
          </span>
        </div>
        <div className="actions">
          <Link href={`/guests/${guest.id}/edit`} className="btn sm primary">
            <Icon name="settings" size={12} />
            {t(dict, "guests.editGuest")}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">{t(dict, "profiles.section.personal")}</div>
        </div>
        <div
          className="card-body"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}
        >
          <LabVal label={t(dict, "guests.fld.email")} value={guest.email} />
          <LabVal label={t(dict, "guests.fld.phone")} value={guest.phone} />
          <LabVal label={t(dict, "guests.fld.nationality")} value={guest.nationality} />
          <LabVal
            label={t(dict, "guests.fld.gender")}
            value={guest.gender ? genderLabel[guest.gender] || guest.gender : null}
          />
          <LabVal label={t(dict, "guests.fld.language")} value={guest.language} />
          <LabVal label={t(dict, "guests.fld.dob")} value={guest.dateOfBirth} />
          <LabVal label={t(dict, "guests.fld.docType")} value={guest.documentType} />
          <LabVal label={t(dict, "guests.fld.docNumber")} value={guest.documentNumber} />
        </div>
      </div>

      {guest.notes && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t(dict, "guests.fld.notes")}</div>
          </div>
          <div className="card-body" style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {guest.notes}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        {t(dict, "guests.createdUpdated", {
          created: new Date(guest.createdAt).toLocaleDateString(),
          updated: new Date(guest.updatedAt).toLocaleDateString(),
        })}
      </div>
    </>
  );
}
