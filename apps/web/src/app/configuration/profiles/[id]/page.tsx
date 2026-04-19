import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/back-button";

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

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function ProfileDetailPage({
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

  const typeLabel = profile.type === "travel_agent" ? "Travel Agent" : profile.type.charAt(0).toUpperCase() + profile.type.slice(1);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration/profiles" label="Back to Profiles" />
          <h1 className="text-2xl font-bold mt-2">{profile.name}</h1>
          <span className="text-sm text-gray-500">{typeLabel}</span>
        </div>
        <Link
          href={`/configuration/profiles/${profile.id}/edit`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Edit
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-1">
        <Row label="Name" value={profile.name} />
        <Row label="Email" value={profile.email} />
        <Row label="Phone" value={profile.phone} />
        <Row label="Status" value={profile.isActive ? "Active" : "Inactive"} />

        {profile.type === "individual" && (
          <>
            <Row label="First Name" value={profile.firstName} />
            <Row label="Last Name" value={profile.lastName} />
            <Row label="Date of Birth" value={profile.dateOfBirth} />
            <Row label="Nationality" value={profile.nationality} />
            <Row label="Gender" value={profile.gender} />
            <Row label="Language" value={profile.language} />
            <Row label="Passport Number" value={profile.passportNumber} />
            <Row label="Document Type" value={profile.documentType} />
            <Row label="VIP Status" value={profile.vipStatus} />
          </>
        )}

        {profile.type === "company" && (
          <>
            <Row label="Short Name" value={profile.shortName} />
            <Row label="Tax ID" value={profile.taxId} />
            <Row label="Registration Number" value={profile.registrationNumber} />
            <Row label="Address" value={profile.address} />
            <Row label="Credit Limit" value={profile.creditLimit} />
            <Row label="Payment Terms (days)" value={profile.paymentTermDays?.toString()} />
            <Row label="AR Account" value={profile.arAccountNumber} />
            <Row label="Contact Person" value={profile.contactPerson} />
            <Row label="Contact Title" value={profile.contactTitle} />
          </>
        )}

        {profile.type === "travel_agent" && (
          <>
            <Row label="IATA Code" value={profile.iataCode} />
            <Row label="Commission %" value={profile.commissionPercent} />
            <Row label="Contact Person" value={profile.contactPerson} />
            <Row label="Contact Title" value={profile.contactTitle} />
          </>
        )}

        {profile.type === "source" && (
          <>
            <Row label="Source Code" value={profile.sourceCode} />
            <Row label="Channel Type" value={profile.channelType} />
          </>
        )}

        <Row label="Notes" value={profile.notes} />
      </div>
    </main>
  );
}
