import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RoomTypeForm } from "../../room-type-form";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
};

export default async function EditRoomTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [roomType, properties] = await Promise.all([
    apiFetch<RoomType>(`/api/room-types/${id}`),
    apiFetch<{ id: string }[]>("/api/properties"),
  ]);
  const propertyId = properties[0]?.id;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href="/configuration/room-types"
        className="text-blue-600 hover:underline text-sm"
      >
        &larr; Back to Room Types
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Room Type: {roomType.name}</h1>

      <RoomTypeForm
        roomType={{
          id: roomType.id,
          code: roomType.code,
          name: roomType.name,
          maxOccupancy: roomType.maxOccupancy,
          description: roomType.description || "",
          sortOrder: roomType.sortOrder,
        }}
        propertyId={propertyId}
        isEdit
      />
    </main>
  );
}
