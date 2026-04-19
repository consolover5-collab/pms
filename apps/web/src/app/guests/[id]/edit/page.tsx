import { apiFetch } from "@/lib/api";
import Link from "next/link";
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
  const { id } = await params;
  const guest = await apiFetch<Guest>(`/api/profiles/${id}`);

  return (
    <main className="p-8">
      <Link href={`/guests/${guest.id}`} className="text-blue-600 hover:underline text-sm">
        &larr; Back to guest
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">
        Edit Guest: {guest.firstName} {guest.lastName}
      </h1>
      <GuestEditForm guest={guest} />
    </main>
  );
}
