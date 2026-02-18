import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { RoomTypesList } from "./room-types-list";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
};

type Room = { id: string; roomTypeId: string };

export default async function RoomTypesPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const [roomTypes, roomsData] = propertyId
    ? await Promise.all([
        apiFetch<RoomType[]>(`/api/room-types?propertyId=${propertyId}`),
        apiFetch<Room[] | { data: Room[] }>(`/api/rooms?propertyId=${propertyId}&limit=500`),
      ])
    : [[], { data: [] }];

  const allRooms: Room[] = Array.isArray(roomsData) ? roomsData : (roomsData as { data: Room[] }).data ?? [];
  const roomCountByType: Record<string, number> = {};
  for (const r of allRooms) {
    roomCountByType[r.roomTypeId] = (roomCountByType[r.roomTypeId] ?? 0) + 1;
  }

  const roomTypesWithCount = (roomTypes as RoomType[]).map((rt) => ({
    ...rt,
    roomCount: roomCountByType[rt.id] ?? 0,
  }));

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

      <RoomTypesList roomTypes={roomTypesWithCount} propertyId={propertyId ?? ""} />
    </main>
  );
}
