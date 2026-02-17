"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";


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
  notes: string | null;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string; roomNumber: string } | null;
  roomType: { id: string; name: string; code: string };
  ratePlan: { id: string; name: string; code: string } | null;
};

type Guest = { id: string; firstName: string; lastName: string };
type RoomType = { id: string; name: string; code: string };
type Room = { id: string; roomNumber: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string };
type RatePlan = { id: string; name: string; code: string; baseRate: string | null };

const paymentMethods = [
  { value: "", label: "Not specified" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "company", label: "Company Account" },
];

const statusExplanations: Record<string, string> = {
  checked_in: "Guest is checked in. Core booking details (dates, room type, guest) cannot be changed. You can still update the room assignment, rates, and notes.",
  checked_out: "Stay is completed. Only notes can be updated for historical records.",
  cancelled: "Booking is cancelled. Use 'Reinstate' to restore it before making changes.",
  no_show: "Marked as no-show. Use 'Reinstate' to restore it before making changes.",
};

// Field wrapper with visual disabled state
function FormField({
  label,
  required,
  disabled,
  lockedReason,
  children,
}: {
  label: string;
  required?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={disabled ? "opacity-60" : ""}>
      <label className="block text-xs text-gray-500 mb-1">
        {label}
        {required && " *"}
        {disabled && lockedReason && (
          <span className="ml-2 text-xs text-yellow-600" title={lockedReason}>
            🔒
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export function BookingEditForm({ booking, propertyId }: { booking: Booking; propertyId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | ApiErrorDetail | null>(null);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Controlled state — initialized from booking
  const [selectedGuestId, setSelectedGuestId] = useState(booking.guest.id);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(booking.roomType.id);
  const [selectedRoomId, setSelectedRoomId] = useState(booking.room?.id || "");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState(booking.ratePlan?.id || "");
  const [checkInDate, setCheckInDate] = useState(booking.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(booking.checkOutDate);
  const [adultsVal, setAdultsVal] = useState(booking.adults);
  const [childrenVal, setChildrenVal] = useState(booking.children);
  const [rateAmount, setRateAmount] = useState(booking.rateAmount || "");
  const [paymentMethodVal, setPaymentMethodVal] = useState(booking.paymentMethod || "");
  const [notesVal, setNotesVal] = useState(booking.notes || "");

  // Determine what can be edited based on status
  const isConfirmed = booking.status === "confirmed";
  const isCheckedIn = booking.status === "checked_in";
  const isTerminal = ["checked_out", "cancelled", "no_show"].includes(booking.status);

  // Field editability rules
  const canEditCoreFields = isConfirmed;
  const canEditRoom = isConfirmed || isCheckedIn;
  const canEditFinancials = isConfirmed || isCheckedIn;
  const canEditNotes = true;

  // Date validation
  const dateError = useMemo(() => {
    if (canEditCoreFields && checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return "Check-out date must be after check-in date";
    }
    return null;
  }, [checkInDate, checkOutDate, canEditCoreFields]);

  // Calculate nights and total
  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return 0;
    const diff = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  const totalAmount = useMemo(() => {
    if (!rateAmount || nights <= 0) return "";
    return String(Number(rateAmount) * nights);
  }, [rateAmount, nights]);

  useEffect(() => {
    async function loadData() {
      try {
        const [g, rt, rm, rp] = await Promise.all([
          fetch(`/api/guests`).then((r) => r.json()),
          fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rooms?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rate-plans?propertyId=${propertyId}`).then((r) => r.json()).catch(() => []),
        ]);
        setGuests(g);
        setRoomTypes(rt);
        setRooms(rm);
        setRatePlans(rp);
        setDataLoaded(true);
      } catch {
        setError("Could not load data. Check that the API server is running.");
      }
    }
    loadData();
  }, [propertyId]);

  // Filter rooms by selected room type
  const availableRooms = rooms.filter((r) => r.roomTypeId === selectedRoomTypeId);

  // Room option display with status
  function getRoomLabel(room: Room): string {
    const statusParts: string[] = [];
    if (room.occupancyStatus === "occupied" && room.id !== booking.room?.id) {
      statusParts.push("occupied");
    }
    if (room.housekeepingStatus === "dirty") {
      statusParts.push("dirty");
    } else if (room.housekeepingStatus === "out_of_order") {
      statusParts.push("OOO");
    } else if (room.housekeepingStatus === "out_of_service") {
      statusParts.push("OOS");
    }

    if (room.id === booking.room?.id) {
      statusParts.push("current");
    }

    return statusParts.length > 0
      ? `${room.roomNumber} (${statusParts.join(", ")})`
      : room.roomNumber;
  }

  // Handle rate plan selection — auto-fill rateAmount from plan baseRate
  function handleRatePlanChange(ratePlanId: string) {
    setSelectedRatePlanId(ratePlanId);
    if (ratePlanId) {
      const plan = ratePlans.find((rp) => rp.id === ratePlanId);
      if (plan?.baseRate) {
        setRateAmount(plan.baseRate);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (dateError) {
      setError(dateError);
      return;
    }

    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {};

    // Only include fields that can be edited for current status
    if (canEditCoreFields) {
      body.guestId = selectedGuestId;
      body.roomTypeId = selectedRoomTypeId;
      body.checkInDate = checkInDate;
      body.checkOutDate = checkOutDate;
      body.adults = adultsVal;
      body.children = childrenVal;
    }

    if (canEditRoom) {
      body.roomId = selectedRoomId || null;
    }

    if (canEditFinancials) {
      body.rateAmount = rateAmount || null;
      body.totalAmount = totalAmount || null;
      body.paymentMethod = paymentMethodVal || null;
      body.ratePlanId = selectedRatePlanId || null;
    }

    if (canEditNotes) {
      body.notes = notesVal || null;
    }

    const url = `/api/bookings/${booking.id}`;

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError({
          error: data.error || `Server error: ${res.status}`,
          code: data.code,
          status: res.status,
          url,
          timestamp: new Date().toISOString(),
          ...data,
        });
        setSaving(false);
        return;
      }

      router.replace(`/bookings/${booking.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError({
          error: `Connection error: Cannot reach the API server. Check that it is running.`,
          code: "NETWORK_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      } else {
        setError({
          error: err instanceof Error ? err.message : "Failed to save",
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
      setSaving(false);
    }
  }

  const explanation = statusExplanations[booking.status];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {explanation && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
          <strong className="font-medium">Status: {booking.status.replace("_", " ")}</strong>
          <p className="mt-1">{explanation}</p>
        </div>
      )}

      {isTerminal && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-sm">
          This booking cannot be edited in its current state.
          <Link href={`/bookings/${booking.id}`} className="ml-1 underline">
            Go back and use &quot;Reinstate&quot; to restore it first.
          </Link>
        </div>
      )}

      <FormField label="Confirmation Number" disabled>
        <input type="text" value={booking.confirmationNumber} disabled
          className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed" />
      </FormField>

      <FormField
        label="Guest"
        required
        disabled={!canEditCoreFields}
        lockedReason={!canEditCoreFields ? "Cannot change guest after check-in" : undefined}
      >
        <select
          required
          disabled={!canEditCoreFields}
          value={selectedGuestId}
          onChange={(e) => setSelectedGuestId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          {guests.map((g) => <option key={g.id} value={g.id}>{g.lastName}, {g.firstName}</option>)}
          {/* Fallback if data not loaded yet */}
          {!dataLoaded && (
            <option value={booking.guest.id}>{booking.guest.lastName}, {booking.guest.firstName}</option>
          )}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Check-in"
          required
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? "Cannot change dates after check-in" : undefined}
        >
          <input
            type="date"
            required
            disabled={!canEditCoreFields}
            value={checkInDate}
            onChange={(e) => {
              setCheckInDate(e.target.value);
              if (checkOutDate && e.target.value >= checkOutDate) {
                setCheckOutDate("");
              }
            }}
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
        <FormField
          label="Check-out"
          required
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? "Cannot change dates after check-in" : undefined}
        >
          <input
            type="date"
            required
            disabled={!canEditCoreFields}
            value={checkOutDate}
            min={canEditCoreFields && checkInDate ? (() => { const d = new Date(checkInDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() : undefined}
            onChange={(e) => setCheckOutDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : dateError ? "border-red-500" : ""}`}
          />
          {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
          {nights > 0 && <p className="text-xs text-gray-500 mt-1">{nights} night{nights > 1 ? "s" : ""}</p>}
        </FormField>
      </div>

      <FormField
        label="Room Type"
        required
        disabled={!canEditCoreFields}
        lockedReason={!canEditCoreFields ? "Cannot change room type after check-in" : undefined}
      >
        <select
          required
          disabled={!canEditCoreFields}
          value={selectedRoomTypeId}
          onChange={(e) => {
            setSelectedRoomTypeId(e.target.value);
            setSelectedRoomId("");
          }}
          className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>)}
          {/* Fallback */}
          {!dataLoaded && (
            <option value={booking.roomType.id}>{booking.roomType.name} ({booking.roomType.code})</option>
          )}
        </select>
      </FormField>

      <FormField
        label="Room"
        disabled={!canEditRoom}
        lockedReason={!canEditRoom ? "Cannot change room for completed/cancelled bookings" : undefined}
      >
        <select
          disabled={!canEditRoom}
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditRoom ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">Not assigned</option>
          {availableRooms.map((r) => (
            <option key={r.id} value={r.id}>{getRoomLabel(r)}</option>
          ))}
          {/* Fallback: show current room even if rooms not loaded yet */}
          {!dataLoaded && booking.room && (
            <option value={booking.room.id}>{booking.room.roomNumber} (current)</option>
          )}
        </select>
        {isCheckedIn && (
          <p className="mt-1 text-xs text-gray-500">
            Room can be changed for checked-in guests (room move).
          </p>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Adults"
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? "Cannot change occupancy after check-in" : undefined}
        >
          <input
            type="number"
            min="1"
            disabled={!canEditCoreFields}
            value={adultsVal}
            onChange={(e) => setAdultsVal(Number(e.target.value) || 1)}
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
        <FormField
          label="Children"
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? "Cannot change occupancy after check-in" : undefined}
        >
          <input
            type="number"
            min="0"
            disabled={!canEditCoreFields}
            value={childrenVal}
            onChange={(e) => setChildrenVal(Number(e.target.value) || 0)}
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
      </div>

      <hr className="my-6" />

      <FormField
        label="Rate Plan"
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? "Cannot change rates for completed bookings" : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={selectedRatePlanId}
          onChange={(e) => handleRatePlanChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">Not specified</option>
          {ratePlans.map((rp) => <option key={rp.id} value={rp.id}>{rp.name} ({rp.code}){rp.baseRate ? ` — ${Number(rp.baseRate).toLocaleString()} ₽` : ""}</option>)}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Rate/Night"
          disabled={!canEditFinancials}
          lockedReason={!canEditFinancials ? "Cannot change rates for completed bookings" : undefined}
        >
          <input
            type="number"
            step="0.01"
            disabled={!canEditFinancials}
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            placeholder="0.00"
          />
        </FormField>
        <FormField
          label="Total Amount"
          disabled
        >
          <input
            type="text"
            value={totalAmount ? `${Number(totalAmount).toLocaleString()} ₽` : "—"}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-700"
          />
          {nights > 0 && rateAmount && (
            <p className="text-xs text-gray-500 mt-1">
              {Number(rateAmount).toLocaleString()} ₽ × {nights} nights
            </p>
          )}
        </FormField>
      </div>

      <FormField
        label="Payment Method"
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? "Cannot change payment for completed bookings" : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={paymentMethodVal}
          onChange={(e) => setPaymentMethodVal(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          {paymentMethods.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
      </FormField>

      <hr className="my-6" />

      <FormField label="Notes">
        <textarea
          rows={3}
          value={notesVal}
          onChange={(e) => setNotesVal(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <p className="mt-1 text-xs text-gray-500">Notes can always be updated.</p>
      </FormField>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || isTerminal || !!dateError}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <Link
          href={`/bookings/${booking.id}`}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
