import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
};

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
};

const hkLabels: Record<string, string> = {
  clean: "Clean",
  dirty: "Dirty",
  pickup: "Pickup",
  inspected: "Inspected",
  out_of_order: "Out of Order",
  out_of_service: "Out of Service",
};

const hkColors: Record<string, string> = {
  clean: "bg-cyan-100 text-cyan-800",
  dirty: "bg-red-100 text-red-800",
  pickup: "bg-yellow-100 text-yellow-800",
  inspected: "bg-green-100 text-green-800",
  out_of_order: "bg-gray-600 text-white",
  out_of_service: "bg-gray-400 text-white",
};

export default async function RoomTypeDetailPage({
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

  const rooms = propertyId
    ? await apiFetch<Room[]>(`/api/rooms?propertyId=${propertyId}&roomTypeId=${id}`)
    : [];

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration/room-types" label="Back to Room Types" />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="room-type-detail-title">
            {roomType.name}{" "}
            <span className="font-mono text-gray-500 text-lg">({roomType.code})</span>
          </h1>
          <div className="text-sm text-gray-500 mt-1 space-x-4">
            <span>Max occupancy: {roomType.maxOccupancy}</span>
            {roomType.description && <span>{roomType.description}</span>}
          </div>
        </div>
        <Link
          href={`/configuration/room-types/${id}/edit`}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
          data-testid="room-type-detail-edit"
        >
          Edit Type
        </Link>
      </div>

      <div className="mt-8" data-testid="room-type-detail-rooms">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Rooms{" "}
            <span className="text-gray-400 font-normal text-base">({rooms.length})</span>
          </h2>
          <Link
            href={`/rooms`}
            className="text-sm text-blue-600 hover:underline"
          >
            All rooms →
          </Link>
        </div>

        {rooms.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center" data-testid="room-type-detail-empty">
            <p className="text-gray-700 font-medium mb-2">No rooms assigned to this type</p>
            <p className="text-sm text-gray-500 mb-4">
              To assign a room to this type, go to Rooms, open a room, and click &ldquo;Edit Room&rdquo; to change its type.
            </p>
            <Link
              href="/rooms"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Go to Rooms
            </Link>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Room #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Floor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    HK Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Occupancy
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50" data-testid="room-type-detail-room-row" data-room-id={room.id}>
                    <td className="px-4 py-3 font-mono font-medium" data-testid="room-type-detail-room-number">#{room.roomNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {room.floor ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${hkColors[room.housekeepingStatus] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {hkLabels[room.housekeepingStatus] ?? room.housekeepingStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          room.occupancyStatus === "occupied"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {room.occupancyStatus === "occupied" ? "Occupied" : "Vacant"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link
                        href={`/rooms/${room.id}`}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        View
                      </Link>
                      {room.occupancyStatus !== "occupied" && (
                        <Link
                          href={`/rooms/${room.id}/edit`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
