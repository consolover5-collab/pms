import { apiFetch } from "@/lib/api";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
  roomType: { id: string; name: string; code: string };
};

export default async function RoomsPage() {
  const properties = await apiFetch<{ id: string; name: string }[]>(
    "/api/properties",
  );

  if (properties.length === 0) {
    return <div className="p-8">No properties found. Run the seed script.</div>;
  }

  const property = properties[0];
  const rooms = await apiFetch<Room[]>(
    `/api/rooms?propertyId=${property.id}`,
  );

  const hkColors: Record<string, string> = {
    clean: "bg-green-100 text-green-800",
    dirty: "bg-red-100 text-red-800",
    pickup: "bg-yellow-100 text-yellow-800",
    inspected: "bg-blue-100 text-blue-800",
    out_of_order: "bg-gray-300 text-gray-700",
    out_of_service: "bg-gray-200 text-gray-600",
  };

  const occColors: Record<string, string> = {
    vacant: "bg-green-50 text-green-700",
    occupied: "bg-orange-100 text-orange-800",
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-2">{property.name}</h1>
      <p className="text-gray-500 mb-6">{rooms.length} rooms</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Room</th>
              <th className="p-2">Floor</th>
              <th className="p-2">Type</th>
              <th className="p-2">HK Status</th>
              <th className="p-2">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono font-bold">{room.roomNumber}</td>
                <td className="p-2">{room.floor ?? "\u2014"}</td>
                <td className="p-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {room.roomType.code}
                  </span>{" "}
                  {room.roomType.name}
                </td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${hkColors[room.housekeepingStatus] || ""}`}
                  >
                    {room.housekeepingStatus}
                  </span>
                </td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${occColors[room.occupancyStatus] || ""}`}
                  >
                    {room.occupancyStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
