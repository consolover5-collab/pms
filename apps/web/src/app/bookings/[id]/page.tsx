import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { BookingActions } from "./booking-actions";
import { FolioSection } from "./folio-section";
import { BackButton } from "@/components/back-button";

type Booking = {
  id: string;
  propertyId: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  adults: number;
  children: number;
  rateAmount: string | null;
  totalAmount: string | null;
  paymentMethod: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  notes: string | null;
  createdAt: string;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
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
  ratePlan: {
    id: string;
    name: string;
    code: string;
  } | null;
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await apiFetch<Booking>(`/api/bookings/${id}`);

  const nights = Math.max(1, Math.round(
    (new Date(booking.checkOutDate).getTime() -
      new Date(booking.checkInDate).getTime()) /
      (1000 * 60 * 60 * 24),
  ));

  return (
    <main className="p-8 max-w-3xl">
      <BackButton fallbackHref="/bookings" label="Back to bookings" />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">
            #{booking.confirmationNumber}
          </h1>
          <span
            className={`text-xs px-2 py-1 rounded ${statusColors[booking.status] || "bg-gray-100"}`}
          >
            {statusLabels[booking.status] || booking.status}
          </span>
        </div>
        <Link
          href={`/bookings/${booking.id}/edit`}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
        >
          Edit Booking
        </Link>
      </div>

      {/* Actions */}
      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        checkInDate={booking.checkInDate}
        hasRoom={!!booking.room}
        propertyId={booking.propertyId}
        roomTypeId={booking.roomType.id}
        currentRoomId={booking.room?.id ?? null}
      />

      {/* Guest info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-sm font-semibold mb-3">Guest</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Name"
            value={`${booking.guest.firstName} ${booking.guest.lastName}`}
          />
          <Field label="Email" value={booking.guest.email} />
          <Field label="Phone" value={booking.guest.phone} />
          <Link
            href={`/guests/${booking.guest.id}`}
            className="text-blue-600 hover:underline text-sm self-end"
          >
            View guest profile →
          </Link>
        </div>
      </div>

      {/* Stay details */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Check-in" value={booking.checkInDate} />
        <Field label="Check-out" value={booking.checkOutDate} />
        <Field label="Nights" value={String(nights)} />
        <Field
          label="Guests"
          value={`${booking.adults} adults${booking.children ? `, ${booking.children} children` : ""}`}
        />
        <Field
          label="Room"
          value={booking.room ? `#${booking.room.roomNumber}` : "Not assigned"}
        />
        <Field
          label="Room Type"
          value={`${booking.roomType.name} (${booking.roomType.code})`}
        />
      </div>

      {/* Financials */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Rate Plan" value={booking.ratePlan?.name || "—"} />
        <Field
          label="Rate/Night"
          value={
            booking.rateAmount
              ? `${formatCurrency(booking.rateAmount)} ₽`
              : null
          }
        />
        <Field
          label="Total"
          value={
            booking.totalAmount
              ? `${formatCurrency(booking.totalAmount)} ₽`
              : null
          }
        />
        <Field label="Payment" value={booking.paymentMethod} />
      </div>

      {/* Actual times */}
      {(booking.actualCheckIn || booking.actualCheckOut) && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field
            label="Actual Check-in"
            value={
              booking.actualCheckIn
                ? new Date(booking.actualCheckIn).toLocaleString()
                : null
            }
          />
          <Field
            label="Actual Check-out"
            value={
              booking.actualCheckOut
                ? new Date(booking.actualCheckOut).toLocaleString()
                : null
            }
          />
        </div>
      )}

      {/* Notes */}
      {booking.notes && (
        <div className="mt-6">
          <h2 className="text-xs text-gray-500 uppercase mb-1">Notes</h2>
          <p className="text-sm bg-gray-50 p-3 rounded">{booking.notes}</p>
        </div>
      )}

      {/* Folio */}
      <FolioSection bookingId={booking.id} />

      <div className="mt-6 text-xs text-gray-400">
        Created: {new Date(booking.createdAt).toLocaleString()}
      </div>
    </main>
  );
}
