import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Property = { id: string; name: string };

type Booking = {
  id: string;
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { firstName: string; lastName: string };
  room: { roomNumber: string } | null;
};

type Room = {
  id: string;
  roomNumber: string;
  housekeepingStatus: string;
  occupancyStatus: string;
};

export default async function Home() {
  const today = new Date().toISOString().split("T")[0];

  // Get property (single-property MVP)
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">No property configured</h1>
        <p className="text-gray-600 mt-2">Run database seed to initialize the system.</p>
      </main>
    );
  }

  // Fetch all data in parallel
  const [bookings, rooms] = await Promise.all([
    apiFetch<Booking[]>(`/api/bookings?propertyId=${property.id}`),
    apiFetch<Room[]>(`/api/rooms?propertyId=${property.id}`),
  ]);

  // Calculate statistics
  const stats = {
    totalRooms: rooms.length,
    occupied: rooms.filter((r) => r.occupancyStatus === "occupied").length,
    vacant: rooms.filter((r) => r.occupancyStatus === "vacant").length,
    clean: rooms.filter((r) => r.housekeepingStatus === "clean").length,
    dirty: rooms.filter((r) => r.housekeepingStatus === "dirty").length,
    inspected: rooms.filter((r) => r.housekeepingStatus === "inspected").length,
    outOfOrder: rooms.filter((r) => r.housekeepingStatus === "out_of_order" || r.housekeepingStatus === "out_of_service").length,
  };

  // Today's activity
  const arrivalsToday = bookings.filter(
    (b) => b.checkInDate === today && (b.status === "confirmed" || b.status === "checked_in")
  );
  const pendingArrivals = arrivalsToday.filter((b) => b.status === "confirmed");
  const checkedInToday = arrivalsToday.filter((b) => b.status === "checked_in");

  const departuresToday = bookings.filter(
    (b) => b.checkOutDate === today && (b.status === "checked_in" || b.status === "checked_out")
  );
  const pendingDepartures = departuresToday.filter((b) => b.status === "checked_in");

  const inHouse = bookings.filter((b) => b.status === "checked_in");

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">PMS Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Open Source Property Management System | {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Link href="/bookings" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Bookings
        </Link>
        <Link href="/rooms" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Rooms
        </Link>
        <Link href="/guests" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Guests
        </Link>
        <Link href="/configuration" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
          Configuration
        </Link>
        <Link href="/help" className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">
          Help
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Room Summary */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Room Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Rooms</span>
              <span className="font-mono">{stats.totalRooms}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Occupied</span>
              <span className="font-mono text-blue-600">{stats.occupied}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vacant</span>
              <span className="font-mono text-green-600">{stats.vacant}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-sm">
                <span>Occupancy</span>
                <span className="font-semibold">
                  {stats.totalRooms > 0 ? Math.round((stats.occupied / stats.totalRooms) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Today&apos;s Activity</h2>
          <div className="space-y-2">
            <Link href="/bookings?view=arrivals" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-gray-600">Arrivals</span>
              <span className="font-mono">
                {pendingArrivals.length} <span className="text-gray-400">/ {arrivalsToday.length}</span>
              </span>
            </Link>
            <Link href="/bookings?view=departures" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-gray-600">Departures</span>
              <span className="font-mono">
                {pendingDepartures.length} <span className="text-gray-400">/ {departuresToday.length}</span>
              </span>
            </Link>
            <Link href="/bookings?view=inhouse" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-gray-600">In-House</span>
              <span className="font-mono">{inHouse.length}</span>
            </Link>
          </div>
        </div>

        {/* Housekeeping Status */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Housekeeping</h2>
          <div className="space-y-2">
            <Link href="/rooms?hk=clean" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-green-600">Clean</span>
              <span className="font-mono">{stats.clean}</span>
            </Link>
            <Link href="/rooms?hk=dirty" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-red-600">Dirty</span>
              <span className="font-mono">{stats.dirty}</span>
            </Link>
            <Link href="/rooms?hk=inspected" className="flex justify-between hover:bg-gray-50 p-1 rounded">
              <span className="text-blue-600">Inspected</span>
              <span className="font-mono">{stats.inspected}</span>
            </Link>
            {stats.outOfOrder > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Out of Order/Service</span>
                <span className="font-mono">{stats.outOfOrder}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Arrivals List */}
      {pendingArrivals.length > 0 && (
        <div className="mt-8 bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Pending Arrivals Today</h2>
          <div className="divide-y">
            {pendingArrivals.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex justify-between py-2 hover:bg-gray-50 px-2 rounded"
              >
                <span>
                  <span className="text-gray-400 font-mono text-xs mr-2">#{b.confirmationNumber}</span>
                  {b.guest.firstName} {b.guest.lastName}
                </span>
                <span className="text-gray-500">
                  {b.room ? `Room ${b.room.roomNumber}` : "No room assigned"}
                </span>
              </Link>
            ))}
            {pendingArrivals.length > 5 && (
              <Link href="/bookings?view=arrivals" className="block text-center py-2 text-blue-600 hover:underline">
                View all {pendingArrivals.length} arrivals
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
