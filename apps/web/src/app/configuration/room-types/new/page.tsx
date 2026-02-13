import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RoomTypeForm } from "../room-type-form";

export default async function NewRoomTypePage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href="/configuration/room-types"
        className="text-blue-600 hover:underline text-sm"
      >
        &larr; Back to Room Types
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">New Room Type</h1>

      <RoomTypeForm propertyId={propertyId} />
    </main>
  );
}
