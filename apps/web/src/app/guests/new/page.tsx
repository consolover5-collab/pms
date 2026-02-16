import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { GuestForm } from "./guest-form";

type Property = {
  id: string;
  name: string;
};

export default async function NewGuestPage() {
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">No property configured</h1>
      </main>
    );
  }

  return (
    <main className="p-8">
      <Link href="/guests" className="text-blue-600 hover:underline text-sm">
        &larr; Back to guests
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">New Guest</h1>
      <GuestForm propertyId={property.id} />
    </main>
  );
}
