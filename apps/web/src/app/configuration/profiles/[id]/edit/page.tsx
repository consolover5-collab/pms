import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { ProfileForm } from "../../profile-form";

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

export default async function EditProfilePage({
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

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href={`/configuration/profiles/${id}`} style={{ color: "var(--muted)" }}>
          ← {profile.name}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "profiles.editTitle")}</h1>
        <span className="page-sub">{profile.name}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <ProfileForm profile={profile} />
        </div>
      </div>
    </>
  );
}
