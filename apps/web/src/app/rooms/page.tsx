import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
  roomTypeId: string;
  roomType: { id: string; name: string; code: string };
};

type Property = { id: string; name: string };
type RoomType = { id: string; name: string; code: string };

const hkStatusColors: Record<string, string> = {
  clean: "bg-green-100 text-green-800",
  dirty: "bg-red-100 text-red-800",
  pickup: "bg-yellow-100 text-yellow-800",
  inspected: "bg-blue-100 text-blue-800",
  out_of_order: "bg-gray-600 text-white",
  out_of_service: "bg-gray-400 text-white",
};

const hkStatusLabels: Record<string, string> = {
  clean: "Clean",
  dirty: "Dirty",
  pickup: "Pickup",
  inspected: "Inspected",
  out_of_order: "Out of Order",
  out_of_service: "Out of Service",
};

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ hk?: string; occ?: string; type?: string }>;
}) {
  const { hk, occ, type } = await searchParams;

  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return <main className="p-8"><h1 className="text-2xl font-bold">No property configured</h1></main>;
  }

  const queryParams = new URLSearchParams({ propertyId: property.id });
  if (hk) queryParams.set("housekeepingStatus", hk);
  if (occ) queryParams.set("occupancyStatus", occ);
  if (type) queryParams.set("roomTypeId", type);

  const [rooms, roomTypes, allRooms] = await Promise.all([
    apiFetch<Room[]>(`/api/rooms?${queryParams.toString()}`),
    apiFetch<RoomType[]>(`/api/room-types?propertyId=${property.id}`),
    apiFetch<Room[]>(`/api/rooms?propertyId=${property.id}`),
  ]);

  const stats = {
    total: allRooms.length,
    vacant: allRooms.filter((r) => r.occupancyStatus === "vacant").length,
    occupied: allRooms.filter((r) => r.occupancyStatus === "occupied").length,
    clean: allRooms.filter((r) => r.housekeepingStatus === "clean").length,
    dirty: allRooms.filter((r) => r.housekeepingStatus === "dirty").length,
  };

  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = String(room.floor || "0");
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Rooms</h1>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">{stats.vacant}</div>
          <div className="text-xs text-gray-500">Vacant</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.occupied}</div>
          <div className="text-xs text-gray-500">Occupied</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">{stats.clean}</div>
          <div className="text-xs text-gray-500">Clean</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-700">{stats.dirty}</div>
          <div className="text-xs text-gray-500">Dirty</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">HK:</span>
          <div className="flex gap-1">
            <Link href="/rooms" className={`px-3 py-1 rounded text-sm ${!hk ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>All</Link>
            {["clean", "dirty", "inspected", "pickup"].map((key) => (
              <Link key={key} href={`/rooms?hk=${key}${occ ? `&occ=${occ}` : ""}`}
                className={`px-3 py-1 rounded text-sm ${hk === key ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>
                {hkStatusLabels[key]}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Occ:</span>
          <div className="flex gap-1">
            <Link href={`/rooms${hk ? `?hk=${hk}` : ""}`}
              className={`px-3 py-1 rounded text-sm ${!occ ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>All</Link>
            <Link href={`/rooms?occ=vacant${hk ? `&hk=${hk}` : ""}`}
              className={`px-3 py-1 rounded text-sm ${occ === "vacant" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>Vacant</Link>
            <Link href={`/rooms?occ=occupied${hk ? `&hk=${hk}` : ""}`}
              className={`px-3 py-1 rounded text-sm ${occ === "occupied" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>Occupied</Link>
          </div>
        </div>
      </div>

      {/* Room Grid by Floor */}
      {Object.entries(roomsByFloor)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([floor, floorRooms]) => (
          <div key={floor} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Floor {floor}</h2>
            <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
              {floorRooms
                .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
                .map((room) => (
                  <Link key={room.id} href={`/rooms/${room.id}`}
                    className={`relative p-3 rounded-lg border-2 hover:shadow-md transition-shadow ${
                      room.occupancyStatus === "occupied"
                        ? "border-blue-300 bg-blue-50"
                        : room.housekeepingStatus === "clean" || room.housekeepingStatus === "inspected"
                          ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"
                    }`}>
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                      room.occupancyStatus === "occupied" ? "bg-blue-500" : "bg-green-500"
                    }`} />
                    <div className="font-mono font-bold text-sm">{room.roomNumber}</div>
                    <div className="text-xs text-gray-500">{room.roomType.code}</div>
                    <div className="mt-1">
                      <span className={`text-xs px-1 rounded ${hkStatusColors[room.housekeepingStatus]}`}>
                        {hkStatusLabels[room.housekeepingStatus]?.slice(0, 1) || "?"}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))}

      {rooms.length === 0 && (
        <div className="text-center text-gray-500 py-8">No rooms found matching filters</div>
      )}
    </main>
  );
}
