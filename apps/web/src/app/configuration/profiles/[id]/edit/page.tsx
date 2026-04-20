import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
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
  const { id } = await params;

  let profile: Profile;
  try {
    profile = await apiFetch<Profile>(`/api/profiles/${id}`);
  } catch {
    notFound();
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <BackButton fallbackHref="/configuration/profiles" label="Back to Profiles" />
        <h1 className="text-2xl font-bold mt-2">Edit Profile: {profile.name}</h1>
      </div>
      <ProfileForm profile={profile} />
    </main>
  );
}
