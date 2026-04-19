import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";

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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase">{label}</dt>
      <dd className="text-sm">{value || "\u2014"}</dd>
    </div>
  );
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guest = await apiFetch<Guest>(`/api/profiles/${id}`);

  const genderLabel: Record<string, string> = { M: "Male", F: "Female" };

  return (
    <main className="p-8 max-w-2xl">
      <BackButton fallbackHref="/guests" label="Back to guests" />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {guest.firstName} {guest.lastName}
          </h1>
          {guest.vipStatus && (
            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
              VIP {guest.vipStatus}
            </span>
          )}
        </div>
        <Link
          href={`/guests/${guest.id}/edit`}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Edit Guest
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Email" value={guest.email} />
        <Field label="Phone" value={guest.phone} />
        <Field label="Nationality" value={guest.nationality} />
        <Field label="Gender" value={guest.gender ? (genderLabel[guest.gender] || guest.gender) : null} />
        <Field label="Language" value={guest.language} />
        <Field label="Date of Birth" value={guest.dateOfBirth} />
        <Field label="Document Type" value={guest.documentType} />
        <Field label="Document Number" value={guest.documentNumber} />
      </div>

      {guest.notes && (
        <div className="mt-6">
          <h2 className="text-xs text-gray-500 uppercase mb-1">Notes</h2>
          <p className="text-sm bg-gray-50 p-3 rounded">{guest.notes}</p>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400">
        Created: {new Date(guest.createdAt).toLocaleDateString()} | Updated: {new Date(guest.updatedAt).toLocaleDateString()}
      </div>
    </main>
  );
}
