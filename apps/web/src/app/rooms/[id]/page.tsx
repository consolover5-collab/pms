import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RoomStatusActions } from "./room-status-actions";
import { BackButton } from "@/components/back-button";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
  propertyId: string;
  roomType: {
    id: string;
    name: string;
    code: string;
    maxOccupancy: number | null;
    description: string | null;
  };
};

type ActiveBooking = {
  id: string;
  confirmationNumber: string;
  checkOutDate: string;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

const hkStatusColors: Record<string, string> = {
  clean: "bg-cyan-100 text-cyan-800",
  dirty: "bg-red-100 text-red-800",
  pickup: "bg-yellow-100 text-yellow-800",
  inspected: "bg-green-100 text-green-800",
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase">{label}</dt>
      <dd className="text-sm">{value || "\u2014"}</dd>
    </div>
  );
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await apiFetch<Room>(`/api/rooms/${id}`);

  // Fetch active booking if room is occupied
  let activeBooking: ActiveBooking | null = null;
  if (room.occupancyStatus === "occupied" && room.propertyId) {
    try {
      const activeBookings = await apiFetch<ActiveBooking[]>(
        `/api/bookings?propertyId=${room.propertyId}&roomId=${room.id}&status=checked_in`,
      );
      activeBooking = activeBookings[0] || null;
    } catch {
      // Silently fail - the guest info is supplementary
    }
  }

  return (
    <main className="p-8 max-w-2xl">
      <BackButton fallbackHref="/rooms" label="Back to rooms" />

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-bold font-mono">#{room.roomNumber}</h1>
        <span
          className={`text-xs px-2 py-1 rounded ${hkStatusColors[room.housekeepingStatus]}`}
        >
          {hkStatusLabels[room.housekeepingStatus]}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            room.occupancyStatus === "occupied"
              ? "bg-blue-100 text-blue-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {room.occupancyStatus === "occupied" ? "Occupied" : "Vacant"}
        </span>
      </div>

      {/* Current guest info when occupied */}
      {activeBooking && (
        <div className="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            Current Guest
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Guest: </span>
              <Link
                href={`/guests/${activeBooking.guest.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {activeBooking.guest.firstName} {activeBooking.guest.lastName}
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Confirmation: </span>
              <Link
                href={`/bookings/${activeBooking.id}`}
                className="text-blue-600 hover:underline font-mono"
              >
                {activeBooking.confirmationNumber}
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Check-out: </span>
              <span>{activeBooking.checkOutDate}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field
          label="Room Type"
          value={`${room.roomType.name} (${room.roomType.code})`}
        />
        <Field label="Floor" value={room.floor?.toString() || null} />
        <Field
          label="Max Occupancy"
          value={room.roomType.maxOccupancy?.toString() || null}
        />
        <Field label="Description" value={room.roomType.description} />
      </div>

      <RoomStatusActions
        roomId={room.id}
        housekeepingStatus={room.housekeepingStatus}
        occupancyStatus={room.occupancyStatus}
      />
    </main>
  );
}
