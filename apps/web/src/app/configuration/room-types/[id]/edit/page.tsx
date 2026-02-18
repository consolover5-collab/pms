import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
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
      <BackButton fallbackHref="/configuration/room-types" label="Back to Room Types" />
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
