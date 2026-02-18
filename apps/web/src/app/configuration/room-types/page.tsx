import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { RoomTypesList } from "./room-types-list";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  baseRate: string;
  description: string | null;
  sortOrder: number;
};

export default async function RoomTypesPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const roomTypes = propertyId
    ? await apiFetch<RoomType[]>(`/api/room-types?propertyId=${propertyId}`)
    : [];

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration" label="Back to Configuration" />
          <h1 className="text-2xl font-bold mt-2">Room Types</h1>
        </div>
        <Link
          href="/configuration/room-types/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Room Type
        </Link>
      </div>

      <RoomTypesList roomTypes={roomTypes} propertyId={propertyId ?? ""} />
    </main>
  );
}
