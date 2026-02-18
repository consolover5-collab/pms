"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";


type Guest = { id: string; firstName: string; lastName: string };
type RoomType = { id: string; name: string; code: string };
type Room = { id: string; roomNumber: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string };
type RatePlan = { id: string; name: string; code: string; baseRate: string | null; isDefault: boolean };
type RoomRate = { ratePlanId: string; roomTypeId: string; amount: string };

export function BookingForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | ApiErrorDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);

  // Controlled form state
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState("");
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [rateAmount, setRateAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  // New guest form state
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [newGuestData, setNewGuestData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Date validation
  const dateError = useMemo(() => {
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return "Check-out date must be after check-in date";
    }
    return null;
  }, [checkInDate, checkOutDate]);

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
        const [gRaw, rt, rm, rpRaw] = await Promise.all([
          fetch(`/api/guests?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rooms?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rate-plans?propertyId=${propertyId}`).then((r) => r.json()).catch(() => []),
        ]);
        const g = Array.isArray(gRaw) ? gRaw : (gRaw.data ?? []);
        const rp = Array.isArray(rpRaw) ? rpRaw : (rpRaw.data ?? []);
        setGuests(g);
        setRoomTypes(Array.isArray(rt) ? rt : (rt.data ?? []));
        setRooms(Array.isArray(rm) ? rm : (rm.data ?? []));
        setRatePlans(rp);
        // Загружаем матрицу цен для всех тарифных планов
        const allRates = await Promise.all(
          rp.map((plan: RatePlan) =>
            fetch(`/api/rate-plans/${plan.id}/room-rates`)
              .then((r) => r.json())
              .then((rates: { roomTypeId: string; amount: string }[]) =>
                rates.map((rate) => ({ ratePlanId: plan.id, ...rate }))
              )
              .catch(() => [] as RoomRate[])
          )
        );
        setRoomRates(allRates.flat());
        // Автовыбор тарифного плана по умолчанию
        const defaultPlan = rp.find((p: RatePlan) => p.isDefault);
        if (defaultPlan) {
          setSelectedRatePlanId(defaultPlan.id);
          if (defaultPlan.baseRate) setRateAmount(defaultPlan.baseRate);
        }
      } catch {
        setError("Could not load data. Check that the API server is running.");
      }
    }
    loadData();
  }, [propertyId]);

  // Filter rooms by selected room type
  const filteredRooms = selectedRoomTypeId
    ? rooms.filter((r) => r.roomTypeId === selectedRoomTypeId)
    : rooms;

  // Room label with status
  function getRoomLabel(room: Room): string {
    const statusParts: string[] = [];
    if (room.occupancyStatus === "occupied") statusParts.push("occupied");
    if (room.housekeepingStatus === "dirty") statusParts.push("dirty");
    else if (room.housekeepingStatus === "out_of_order") statusParts.push("OOO");
    else if (room.housekeepingStatus === "out_of_service") statusParts.push("OOS");

    return statusParts.length > 0
      ? `${room.roomNumber} (${statusParts.join(", ")})`
      : room.roomNumber;
  }

  // Lookup rate from matrix, fall back to plan baseRate
  function getRateForPlanAndType(ratePlanId: string, roomTypeId: string): string | null {
    const matrixRate = roomRates.find(
      (r) => r.ratePlanId === ratePlanId && r.roomTypeId === roomTypeId
    );
    if (matrixRate) return matrixRate.amount;
    const plan = ratePlans.find((p) => p.id === ratePlanId);
    return plan?.baseRate ?? null;
  }

  // Handle rate plan selection — auto-fill rateAmount from matrix or plan baseRate
  function handleRatePlanChange(ratePlanId: string) {
    setSelectedRatePlanId(ratePlanId);
    if (ratePlanId) {
      const rate = getRateForPlanAndType(ratePlanId, selectedRoomTypeId);
      if (rate) setRateAmount(rate);
    }
  }

  async function handleCreateGuest() {
    if (!newGuestData.firstName || !newGuestData.lastName) {
      setError("First name and last name are required for new guest");
      return;
    }

    setCreatingGuest(true);
    setError(null);

    try {
      const res = await fetch(`/api/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          ...newGuestData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const newGuest = await res.json();

      // Add to guests list AND select via React state
      setGuests((prev) => [...prev, newGuest]);
      setSelectedGuestId(newGuest.id);
      setShowNewGuest(false);
      setNewGuestData({ firstName: "", lastName: "", email: "", phone: "" });
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Connection error: Cannot reach the API server. Check that it is running.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to create guest");
      }
    } finally {
      setCreatingGuest(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (dateError) {
      setError(dateError);
      return;
    }

    if (!selectedRatePlanId || !rateAmount) {
      setError("Rate plan and rate amount are required. Please select a rate plan.");
      return;
    }

    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      propertyId,
      guestId: selectedGuestId,
      roomTypeId: selectedRoomTypeId,
      checkInDate,
      checkOutDate,
      adults,
      children,
    };

    if (selectedRoomId) body.roomId = selectedRoomId;
    if (selectedRatePlanId) body.ratePlanId = selectedRatePlanId;
    if (rateAmount) body.rateAmount = rateAmount;
    if (totalAmount) body.totalAmount = totalAmount;
    if (paymentMethod) body.paymentMethod = paymentMethod;
    if (notes) body.notes = notes;

    const url = `/api/bookings`;

    try {
      const res = await fetch(url, {
        method: "POST",
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

      const booking = await res.json();
      router.replace(`/bookings/${booking.id}`);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {/* Guest Selection */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-xs text-gray-500">Guest *</label>
          <button
            type="button"
            onClick={() => setShowNewGuest(!showNewGuest)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showNewGuest ? "Cancel" : "+ Add new guest"}
          </button>
        </div>

        {!showNewGuest ? (
          <select
            name="guestId"
            required
            value={selectedGuestId}
            onChange={(e) => setSelectedGuestId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Select guest...</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.lastName}, {g.firstName}
              </option>
            ))}
          </select>
        ) : (
          <div className="p-3 border rounded bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                <input
                  type="text"
                  value={newGuestData.firstName}
                  onChange={(e) => setNewGuestData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={newGuestData.lastName}
                  onChange={(e) => setNewGuestData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newGuestData.email}
                  onChange={(e) => setNewGuestData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newGuestData.phone}
                  onChange={(e) => setNewGuestData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="+7 999 123 4567"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateGuest}
              disabled={creatingGuest}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {creatingGuest ? "Creating..." : "Create Guest & Select"}
            </button>
            {/* Selected guest indicator */}
            {selectedGuestId && (
              <p className="text-xs text-green-600">
                Guest selected: {guests.find((g) => g.id === selectedGuestId)?.lastName}, {guests.find((g) => g.id === selectedGuestId)?.firstName}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-in *</label>
          <input
            type="date"
            required
            value={checkInDate}
            onChange={(e) => {
              setCheckInDate(e.target.value);
              // Auto-adjust check-out if it's before new check-in
              if (checkOutDate && e.target.value >= checkOutDate) {
                setCheckOutDate("");
              }
            }}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-out *</label>
          <input
            type="date"
            required
            value={checkOutDate}
            min={checkInDate ? (() => { const d = new Date(checkInDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() : undefined}
            onChange={(e) => setCheckOutDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${dateError ? "border-red-500" : ""}`}
          />
          {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
          {nights > 0 && <p className="text-xs text-gray-500 mt-1">{nights} night{nights > 1 ? "s" : ""}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Room Type *</label>
        <select
          required
          value={selectedRoomTypeId}
          onChange={(e) => {
            setSelectedRoomTypeId(e.target.value);
            setSelectedRoomId("");
            // Auto-fill rate from matrix when room type changes
            if (selectedRatePlanId && e.target.value) {
              const rate = getRateForPlanAndType(selectedRatePlanId, e.target.value);
              if (rate) setRateAmount(rate);
            }
          }}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Select room type...</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name} ({rt.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Room</label>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Assign later...</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {getRoomLabel(r)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {selectedRoomTypeId
            ? `Showing ${filteredRooms.length} rooms of selected type`
            : "Select a room type to filter rooms"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Adults</label>
          <input
            type="number"
            min="1"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value) || 1)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Children</label>
          <input
            type="number"
            min="0"
            value={children}
            onChange={(e) => setChildren(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <hr className="my-4" />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Rate Plan *</label>
        <select
          required
          value={selectedRatePlanId}
          onChange={(e) => handleRatePlanChange(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">— Select rate plan —</option>
          {ratePlans.map((rp) => (
            <option key={rp.id} value={rp.id}>
              {rp.isDefault ? "★ " : ""}{rp.name} ({rp.code}){rp.baseRate ? ` — ${formatCurrency(rp.baseRate)} ₽` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rate/Night</label>
          <input
            type="number"
            step="0.01"
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Total</label>
          <input
            type="text"
            value={totalAmount ? `${formatCurrency(totalAmount)} ₽` : "—"}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-700"
          />
          {nights > 0 && rateAmount && (
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(rateAmount)} ₽ × {nights} nights
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Not specified</option>
          <option value="cash">Cash</option>
          <option value="card">Credit Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="company">Company Account</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !!dateError}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Booking"}
        </button>
        <Link
          href="/bookings"
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
