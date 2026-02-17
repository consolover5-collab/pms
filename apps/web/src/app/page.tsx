import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Property = { id: string; name: string };

type DashboardBooking = {
  id: string;
  confirmationNumber: string;
  checkOutDate: string;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string | null; roomNumber: string | null };
  roomType: { id: string; name: string; code: string };
};

type DashboardArrival = DashboardBooking & {
  checkInDate: string;
  status: string;
  adults: number;
  children: number;
};

type DashboardSummary = {
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  outOfOrderRooms: number;
  outOfServiceRooms: number;
  dirtyRooms: number;
  cleanRooms: number;
  pickupRooms: number;
  inspectedRooms: number;
  arrivalsCount: number;
  departuresCount: number;
  inHouseCount: number;
  currentBusinessDate: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Home() {
  // Get property (single-property MVP)
  let properties: Property[];
  try {
    properties = await apiFetch<Property[]>("/api/properties");
  } catch (err) {
    return (
      <main className="p-8">
        <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-800">
            Failed to load dashboard
          </h2>
          <p className="text-red-700 text-sm mt-1">
            {err instanceof Error ? err.message : "Could not connect to API"}
          </p>
          <Link
            href="/"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Retry
          </Link>
        </div>
      </main>
    );
  }

  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">No property configured</h1>
        <p className="text-gray-600 mt-2">
          Run database seed to initialize the system.
        </p>
      </main>
    );
  }

  const qs = `propertyId=${property.id}`;

  // Fetch all dashboard data in parallel
  let arrivals: DashboardArrival[];
  let departures: DashboardBooking[];
  let inHouse: DashboardBooking[];
  let summary: DashboardSummary;
  try {
    [arrivals, departures, inHouse, summary] = await Promise.all([
      apiFetch<DashboardArrival[]>(`/api/dashboard/arrivals?${qs}`),
      apiFetch<DashboardBooking[]>(`/api/dashboard/departures?${qs}`),
      apiFetch<DashboardBooking[]>(`/api/dashboard/in-house?${qs}`),
      apiFetch<DashboardSummary>(`/api/dashboard/summary?${qs}`),
    ]);
  } catch (err) {
    return (
      <main className="p-8">
        <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-800">
            Failed to load dashboard data
          </h2>
          <p className="text-red-700 text-sm mt-1">
            {err instanceof Error ? err.message : "Could not connect to API"}
          </p>
          <Link
            href="/"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Retry
          </Link>
        </div>
      </main>
    );
  }

  const occupancyPct =
    summary.totalRooms > 0
      ? Math.round((summary.occupiedRooms / summary.totalRooms) * 100)
      : 0;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      {/* Business Date */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-lg text-gray-600">
          {formatDate(summary.currentBusinessDate)}
        </p>
      </div>

      {/* Room Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {summary.occupiedRooms}
            <span className="text-gray-400 text-lg">
              /{summary.totalRooms}
            </span>
          </div>
          <div className="text-xs text-gray-500 uppercase mt-1">
            Occupied ({occupancyPct}%)
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {summary.vacantRooms}
          </div>
          <div className="text-xs text-gray-500 uppercase mt-1">Vacant</div>
        </div>
        {(summary.outOfOrderRooms > 0 || summary.outOfServiceRooms > 0) && (
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {summary.outOfOrderRooms + summary.outOfServiceRooms}
            </div>
            <div className="text-xs text-gray-500 uppercase mt-1">OOO/OOS</div>
          </div>
        )}
        <Link
          href="/rooms?hk=dirty"
          className="bg-white border rounded-lg p-4 text-center hover:bg-gray-50"
        >
          <div className="text-2xl font-bold text-orange-600">
            {summary.dirtyRooms}
          </div>
          <div className="text-xs text-gray-500 uppercase mt-1">Dirty</div>
        </Link>
        <Link
          href="/rooms?hk=clean"
          className="bg-white border rounded-lg p-4 text-center hover:bg-gray-50"
        >
          <div className="text-2xl font-bold text-green-600">
            {summary.cleanRooms}
          </div>
          <div className="text-xs text-gray-500 uppercase mt-1">Clean</div>
        </Link>
        <Link
          href="/rooms?hk=inspected"
          className="bg-white border rounded-lg p-4 text-center hover:bg-gray-50"
        >
          <div className="text-2xl font-bold text-emerald-600">
            {summary.inspectedRooms}
          </div>
          <div className="text-xs text-gray-500 uppercase mt-1">Inspected</div>
        </Link>
      </div>

      {/* Arrivals + Departures */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Arrivals */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Arrivals
              <span className="text-gray-400 font-normal ml-2 text-sm">
                {arrivals.length}
              </span>
            </h2>
            <Link
              href="/bookings?view=arrivals"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {arrivals.length === 0 ? (
            <p className="text-gray-400 text-sm">No arrivals today</p>
          ) : (
            <div className="divide-y">
              {arrivals.slice(0, 8).map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded"
                >
                  <div>
                    <span className="font-medium">
                      {b.guest.firstName} {b.guest.lastName}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      #{b.confirmationNumber}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {b.roomType.code}
                    {b.room?.roomNumber && (
                      <span className="ml-1 text-blue-600">
                        &rarr; {b.room.roomNumber}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {arrivals.length > 8 && (
                <Link
                  href="/bookings?view=arrivals"
                  className="block text-center py-2 text-blue-600 hover:underline text-sm"
                >
                  +{arrivals.length - 8} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Departures
              <span className="text-gray-400 font-normal ml-2 text-sm">
                {departures.length}
              </span>
            </h2>
            <Link
              href="/bookings?view=departures"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {departures.length === 0 ? (
            <p className="text-gray-400 text-sm">No departures today</p>
          ) : (
            <div className="divide-y">
              {departures.slice(0, 8).map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded"
                >
                  <div>
                    <span className="font-medium">
                      {b.guest.firstName} {b.guest.lastName}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      #{b.confirmationNumber}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {b.room?.roomNumber
                      ? `Room ${b.room.roomNumber}`
                      : b.roomType.code}
                  </span>
                </Link>
              ))}
              {departures.length > 8 && (
                <Link
                  href="/bookings?view=departures"
                  className="block text-center py-2 text-blue-600 hover:underline text-sm"
                >
                  +{departures.length - 8} more
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-House */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            In-House
            <span className="text-gray-400 font-normal ml-2 text-sm">
              {inHouse.length} guests
            </span>
          </h2>
          <Link
            href="/bookings?view=inhouse"
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {inHouse.length === 0 ? (
          <p className="text-gray-400 text-sm">No in-house guests</p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y">
            {inHouse.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded"
              >
                <div>
                  <span className="font-medium">
                    {b.guest.firstName} {b.guest.lastName}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">
                    #{b.confirmationNumber}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {b.room?.roomNumber && (
                    <span className="mr-3">Room {b.room.roomNumber}</span>
                  )}
                  <span>
                    CO{" "}
                    {new Date(
                      b.checkOutDate + "T00:00:00",
                    ).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
