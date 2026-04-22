import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { GuestEditForm } from "./guest-edit-form";

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

export default async function GuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;
  const guest = await apiFetch<Guest>(`/api/profiles/${id}`);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href={`/guests/${guest.id}`} style={{ color: "var(--muted)" }}>
          ← {t(dict, "guests.backToGuest")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "guests.editTitle")}</h1>
        <span className="page-sub">
          {guest.firstName} {guest.lastName}
        </span>
      </div>

      <div className="card">
        <div className="card-body">
          <GuestEditForm guest={guest} />
        </div>
      </div>
    </>
  );
}
