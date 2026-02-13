import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { DateFilter } from "./date-filter";

type Booking = {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  adults: number;
  children: number;
  totalAmount: string | null;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
  };
  room: {
    id: string;
    roomNumber: string;
  } | null;
  roomType: {
    id: string;
    name: string;
    code: string;
  };
};

type Property = {
  id: string;
  name: string;
};

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-green-100 text-green-800",
  checked_out: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-yellow-100 text-yellow-800",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const viewLabels: Record<string, string> = {
  arrivals: "Today's Arrivals",
  departures: "Today's Departures",
  inhouse: "In-House Guests",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const { status, view, dateFrom, dateTo } = await searchParams;
  const today = new Date().toISOString().split("T")[0];

  // Get property (single-property MVP)
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">No property configured</h1>
      </main>
    );
  }

  const queryParams = new URLSearchParams({ propertyId: property.id });
  if (status) queryParams.set("status", status);

  let allBookings = await apiFetch<Booking[]>(
    `/api/bookings?${queryParams.toString()}`,
  );

  // Apply view filters
  let bookings = allBookings;
  let pageTitle = "Bookings";

  if (view === "arrivals") {
    bookings = allBookings.filter(
      (b) => b.checkInDate === today && (b.status === "confirmed" || b.status === "checked_in")
    );
    pageTitle = viewLabels.arrivals;
  } else if (view === "departures") {
    bookings = allBookings.filter(
      (b) => b.checkOutDate === today && (b.status === "checked_in" || b.status === "checked_out")
    );
    pageTitle = viewLabels.departures;
  } else if (view === "inhouse") {
    bookings = allBookings.filter((b) => b.status === "checked_in");
    pageTitle = viewLabels.inhouse;
  }

  // Apply date range filters (with sensible defaults when no view is active)
  const defaultFrom = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();
  const defaultTo = (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();

  // Only apply date filtering when not in a special view (arrivals/departures/inhouse have their own logic)
  if (!view) {
    const effectiveFrom = dateFrom || defaultFrom;
    const effectiveTo = dateTo || defaultTo;
    bookings = bookings.filter((b) => b.checkInDate >= effectiveFrom || b.checkOutDate >= effectiveFrom);
    bookings = bookings.filter((b) => b.checkInDate <= effectiveTo);
  }

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
        </div>
        <Link
          href="/bookings/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + New Booking
        </Link>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-4 border-b pb-2">
        <Link
          href="/bookings"
          className={`px-3 py-1 rounded text-sm ${!view ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
        >
          All
        </Link>
        <Link
          href="/bookings?view=arrivals"
          className={`px-3 py-1 rounded text-sm ${view === "arrivals" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
        >
          Arrivals Today
        </Link>
        <Link
          href="/bookings?view=departures"
          className={`px-3 py-1 rounded text-sm ${view === "departures" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
        >
          Departures Today
        </Link>
        <Link
          href="/bookings?view=inhouse"
          className={`px-3 py-1 rounded text-sm ${view === "inhouse" ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
        >
          In-House
        </Link>
      </div>

      {/* Status filters (only show when not in special view) */}
      {!view && (
        <div className="flex gap-2 mb-4">
          <Link
            href="/bookings"
            className={`px-3 py-1 rounded text-sm ${!status ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            All
          </Link>
          {Object.entries(statusLabels).map(([key, label]) => (
            <Link
              key={key}
              href={`/bookings?status=${key}`}
              className={`px-3 py-1 rounded text-sm ${status === key ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Date filters */}
      {!view && <DateFilter />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Confirmation</th>
              <th className="p-2">Guest</th>
              <th className="p-2">Room</th>
              <th className="p-2">Check-in</th>
              <th className="p-2">Check-out</th>
              <th className="p-2">Status</th>
              <th className="p-2">Total</th>
              {(view === "arrivals" || view === "departures") && (
                <th className="p-2">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="text-blue-600 hover:underline font-mono"
                  >
                    {booking.confirmationNumber}
                  </Link>
                </td>
                <td className="p-2">
                  {booking.guest.lastName}, {booking.guest.firstName}
                </td>
                <td className="p-2">
                  {booking.room ? (
                    <span className="font-mono">{booking.room.roomNumber}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                  <span className="text-gray-500 text-xs ml-1">
                    ({booking.roomType.code})
                  </span>
                </td>
                <td className="p-2">{booking.checkInDate}</td>
                <td className="p-2">{booking.checkOutDate}</td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${statusColors[booking.status] || "bg-gray-100"}`}
                  >
                    {statusLabels[booking.status] || booking.status}
                  </span>
                </td>
                <td className="p-2 text-right">
                  {booking.totalAmount
                    ? `${Number(booking.totalAmount).toLocaleString()} ₽`
                    : "—"}
                </td>
                {view === "arrivals" && booking.status === "confirmed" && (
                  <td className="p-2">
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Check In
                    </Link>
                  </td>
                )}
                {view === "departures" && booking.status === "checked_in" && (
                  <td className="p-2">
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Check Out
                    </Link>
                  </td>
                )}
                {(view === "arrivals" || view === "departures") &&
                  booking.status !== "confirmed" &&
                  booking.status !== "checked_in" && <td className="p-2">—</td>}
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={view ? 8 : 7} className="p-4 text-center text-gray-500">
                  No bookings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
