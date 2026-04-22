"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";
import { useLocale } from "@/components/locale-provider";
import { t, plural, type Locale } from "@/lib/i18n";
import type { DictionaryKey, Dictionary } from "@/lib/i18n/locales/en";
import { GUARANTEE_CODES } from "@/lib/constants/guarantee-codes";

function formatNights(dict: Dictionary, locale: Locale, count: number): string {
  const form =
    locale === "ru"
      ? plural(count, "one", "few", "many")
      : count === 1
        ? "one"
        : "few";
  return t(dict, `bookings.edit.nightsCount.${form}` as DictionaryKey, {
    count: String(count),
  });
}

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
  guaranteeCode: string | null;
  paymentMethod: string | null;
  notes: string | null;
  companyProfileId: string | null;
  agentProfileId: string | null;
  sourceProfileId: string | null;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string; roomNumber: string } | null;
  roomType: { id: string; name: string; code: string };
  ratePlan: { id: string; name: string; code: string } | null;
};

type Guest = { id: string; firstName: string; lastName: string; name: string };
type RoomType = { id: string; name: string; code: string };
type Room = { id: string; roomNumber: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string };
type RatePlan = { id: string; name: string; code: string; baseRate: string | null };
type Profile = { id: string; name: string };

const paymentMethodOptions: { value: string; labelKey: DictionaryKey }[] = [
  { value: "", labelKey: "bookings.edit.paymentMethod.notSpecified" },
  { value: "cash", labelKey: "bookings.edit.paymentMethod.cash" },
  { value: "card", labelKey: "bookings.edit.paymentMethod.card" },
  { value: "bank_transfer", labelKey: "bookings.edit.paymentMethod.bank_transfer" },
  { value: "company", labelKey: "bookings.edit.paymentMethod.company" },
];

const statusExplanationKeys: Record<string, DictionaryKey> = {
  checked_in: "bookings.edit.statusExplanation.checked_in",
  checked_out: "bookings.edit.statusExplanation.checked_out",
  cancelled: "bookings.edit.statusExplanation.cancelled",
  no_show: "bookings.edit.statusExplanation.no_show",
};

const statusBadgeKeys: Record<string, DictionaryKey> = {
  confirmed: "bookings.status.confirmed",
  checked_in: "bookings.status.checkedIn",
  checked_out: "bookings.status.checkedOut",
  cancelled: "bookings.status.cancelled",
  no_show: "bookings.status.noShow",
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
  const { dict, locale } = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | ApiErrorDetail | null>(null);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [companies, setCompanies] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [sources, setSources] = useState<Profile[]>([]);

  // Controlled state — initialized from booking
  const [selectedGuestId, setSelectedGuestId] = useState(booking.guest.id);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(booking.roomType.id);
  const [selectedRoomId, setSelectedRoomId] = useState(booking.room?.id || "");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState(booking.ratePlan?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(booking.companyProfileId || "");
  const [selectedAgentId, setSelectedAgentId] = useState(booking.agentProfileId || "");
  const [selectedSourceId, setSelectedSourceId] = useState(booking.sourceProfileId || "");
  const [checkInDate, setCheckInDate] = useState(booking.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(booking.checkOutDate);
  const [adultsVal, setAdultsVal] = useState(booking.adults);
  const [childrenVal, setChildrenVal] = useState(booking.children);
  const [rateAmount, setRateAmount] = useState(booking.rateAmount || "");
  const [guaranteeCodeVal, setGuaranteeCodeVal] = useState(booking.guaranteeCode || "");
  const [paymentMethodVal, setPaymentMethodVal] = useState(booking.paymentMethod || "");
  const [notesVal, setNotesVal] = useState(booking.notes || "");

  // Determine what can be edited based on status
  const isConfirmed = booking.status === "confirmed";
  const isCheckedIn = booking.status === "checked_in";
  const isTerminal = ["checked_out", "cancelled", "no_show"].includes(booking.status);

  // Field editability rules
  const canEditCoreFields = isConfirmed;
  const canExtendStay = isCheckedIn; // checked_in: только дата выезда (продление)
  const canEditRoom = isConfirmed || isCheckedIn;
  const canEditFinancials = isConfirmed || isCheckedIn;
  const canEditNotes = true;

  // Date validation
  const dateError = useMemo(() => {
    if ((canEditCoreFields || canExtendStay) && checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return t(dict, "bookings.edit.dateError");
    }
    return null;
  }, [checkInDate, checkOutDate, canEditCoreFields, canExtendStay, dict]);

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
        const [g, rt, rm, rp, compRaw, agentRaw, sourceRaw] = await Promise.all([
          fetch(`/api/profiles?propertyId=${propertyId}&type=individual`).then((r) => r.json()),
          fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rooms?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rate-plans?propertyId=${propertyId}`).then((r) => r.json()).catch(() => []),
          fetch(`/api/profiles?propertyId=${propertyId}&type=company`).then((r) => r.json()),
          fetch(`/api/profiles?propertyId=${propertyId}&type=travel_agent`).then((r) => r.json()),
          fetch(`/api/profiles?propertyId=${propertyId}&type=source`).then((r) => r.json()),
        ]);
        setGuests(Array.isArray(g) ? g : (g.data ?? []));
        setRoomTypes(Array.isArray(rt) ? rt : (rt.data ?? []));
        setRooms(Array.isArray(rm) ? rm : (rm.data ?? []));
        setRatePlans(Array.isArray(rp) ? rp : (rp.data ?? []));
        setCompanies(compRaw.data ?? []);
        setAgents(agentRaw.data ?? []);
        setSources(sourceRaw.data ?? []);
        setDataLoaded(true);
      } catch {
        setError(t(dict, "bookings.edit.loadFailed"));
      }
    }
    loadData();
  }, [propertyId, dict]);

  // Filter rooms by selected room type
  const availableRooms = rooms.filter((r) => r.roomTypeId === selectedRoomTypeId);

  // Room option display with status
  function getRoomLabel(room: Room): string {
    const statusParts: string[] = [];
    if (room.occupancyStatus === "occupied" && room.id !== booking.room?.id) {
      statusParts.push(t(dict, "bookings.edit.roomTagOccupied"));
    }
    if (room.housekeepingStatus === "dirty") {
      statusParts.push(t(dict, "bookings.edit.roomTagDirty"));
    } else if (room.housekeepingStatus === "out_of_order") {
      statusParts.push(t(dict, "bookings.edit.roomTagOoo"));
    } else if (room.housekeepingStatus === "out_of_service") {
      statusParts.push(t(dict, "bookings.edit.roomTagOos"));
    }

    if (room.id === booking.room?.id) {
      statusParts.push(t(dict, "bookings.edit.roomTagCurrent"));
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
      body.guestProfileId = selectedGuestId;
      body.roomTypeId = selectedRoomTypeId;
      body.checkInDate = checkInDate;
      body.checkOutDate = checkOutDate;
      body.adults = adultsVal;
      body.children = childrenVal;
    }

    // checked_in: разрешено только продление (изменение даты выезда)
    if (canExtendStay && !canEditCoreFields) {
      body.checkOutDate = checkOutDate;
    }

    if (canEditRoom) {
      body.roomId = selectedRoomId || null;
    }

    if (canEditFinancials) {
      body.rateAmount = rateAmount || null;
      body.guaranteeCode = guaranteeCodeVal || null;
      body.paymentMethod = paymentMethodVal || null;
      body.ratePlanId = selectedRatePlanId || null;
      body.companyProfileId = selectedCompanyId || null;
      body.agentProfileId = selectedAgentId || null;
      body.sourceProfileId = selectedSourceId || null;
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
          error: err instanceof Error ? err.message : t(dict, "bookings.edit.loadFailed"),
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
      setSaving(false);
    }
  }

  const explanationKey = statusExplanationKeys[booking.status];
  const explanation = explanationKey ? t(dict, explanationKey) : null;
  const statusBadgeKey = statusBadgeKeys[booking.status];
  const statusBadgeText = statusBadgeKey ? t(dict, statusBadgeKey) : booking.status.replace("_", " ");

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl" data-testid="booking-edit-form">
      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {explanation && (
        <div
          data-testid="booking-edit-status-info"
          className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm"
        >
          <strong className="font-medium">
            {t(dict, "bookings.edit.statusLabel", { status: statusBadgeText })}
          </strong>
          <p className="mt-1">{explanation}</p>
        </div>
      )}

      {isTerminal && (
        <div
          data-testid="booking-edit-terminal-banner"
          className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-sm"
        >
          {t(dict, "bookings.edit.terminalBanner")}
          <Link href={`/bookings/${booking.id}`} className="ml-1 underline">
            {t(dict, "bookings.edit.terminalBannerHint")}
          </Link>
        </div>
      )}

      <FormField label={t(dict, "bookings.edit.confirmationNumber")} disabled>
        <input type="text" value={booking.confirmationNumber} disabled
          data-testid="booking-edit-confirmation"
          className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed" />
      </FormField>

      <FormField
        label={t(dict, "bookings.edit.guest")}
        required
        disabled={!canEditCoreFields}
        lockedReason={!canEditCoreFields ? t(dict, "bookings.edit.locked.guest") : undefined}
      >
        <select
          required
          disabled={!canEditCoreFields}
          value={selectedGuestId}
          onChange={(e) => setSelectedGuestId(e.target.value)}
          data-testid="booking-edit-guest"
          className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          {guests.map((g) => <option key={g.id} value={g.id}>{g.lastName || g.name}, {g.firstName}</option>)}
          {/* Fallback if data not loaded yet */}
          {!dataLoaded && (
            <option value={booking.guest.id}>{booking.guest.lastName}, {booking.guest.firstName}</option>
          )}
        </select>
      </FormField>

      {/* Company */}
      <FormField
        label={t(dict, "bookings.edit.company")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.profile") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.none")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FormField>

      {/* Travel Agent */}
      <FormField
        label={t(dict, "bookings.edit.travelAgent")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.profile") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.none")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      {/* Source */}
      <FormField
        label={t(dict, "bookings.edit.source")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.profile") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={selectedSourceId}
          onChange={(e) => setSelectedSourceId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.none")}</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t(dict, "bookings.edit.checkIn")}
          required
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? t(dict, "bookings.edit.locked.dates") : undefined}
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
            data-testid="booking-edit-checkin"
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
        <FormField
          label={t(dict, "bookings.edit.checkOut")}
          required
          disabled={!canEditCoreFields && !canExtendStay}
          lockedReason={isTerminal ? t(dict, "bookings.edit.locked.terminalDates") : undefined}
        >
          <input
            type="date"
            required
            disabled={!canEditCoreFields && !canExtendStay}
            value={checkOutDate}
            min={checkInDate ? (() => { const d = new Date(checkInDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() : undefined}
            onChange={(e) => setCheckOutDate(e.target.value)}
            data-testid="booking-edit-checkout"
            className={`w-full px-3 py-2 border rounded ${(!canEditCoreFields && !canExtendStay) ? "bg-gray-100 text-gray-500 cursor-not-allowed" : dateError ? "border-red-500" : ""}`}
          />
          {dateError && <p className="text-xs text-red-500 mt-1" data-testid="booking-edit-date-error">{dateError}</p>}
          {nights > 0 && <p className="text-xs text-gray-500 mt-1">{formatNights(dict, locale, nights)}</p>}
          {canExtendStay && !canEditCoreFields && <p className="text-xs text-blue-600 mt-1">{t(dict, "bookings.edit.extendHint")}</p>}
        </FormField>
      </div>

      <FormField
        label={t(dict, "bookings.edit.roomType")}
        required
        disabled={!canEditCoreFields}
        lockedReason={!canEditCoreFields ? t(dict, "bookings.edit.locked.roomType") : undefined}
      >
        <select
          required
          disabled={!canEditCoreFields}
          value={selectedRoomTypeId}
          onChange={(e) => {
            setSelectedRoomTypeId(e.target.value);
            setSelectedRoomId("");
          }}
          data-testid="booking-edit-room-type"
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
        label={t(dict, "bookings.edit.room")}
        disabled={!canEditRoom}
        lockedReason={!canEditRoom ? t(dict, "bookings.edit.locked.room") : undefined}
      >
        <select
          disabled={!canEditRoom}
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditRoom ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.notAssigned")}</option>
          {availableRooms.map((r) => (
            <option key={r.id} value={r.id}>{getRoomLabel(r)}</option>
          ))}
          {/* Fallback: show current room even if rooms not loaded yet */}
          {!dataLoaded && booking.room && (
            <option value={booking.room.id}>
              {booking.room.roomNumber} ({t(dict, "bookings.edit.roomTagCurrent")})
            </option>
          )}
        </select>
        {isCheckedIn && (
          <p className="mt-1 text-xs text-gray-500">
            {t(dict, "bookings.edit.roomMoveHint")}
          </p>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t(dict, "bookings.edit.adults")}
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? t(dict, "bookings.edit.locked.occupancy") : undefined}
        >
          <input
            type="number"
            min="1"
            disabled={!canEditCoreFields}
            value={adultsVal}
            onChange={(e) => setAdultsVal(Number(e.target.value) || 1)}
            data-testid="booking-edit-adults"
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
        <FormField
          label={t(dict, "bookings.edit.children")}
          disabled={!canEditCoreFields}
          lockedReason={!canEditCoreFields ? t(dict, "bookings.edit.locked.occupancy") : undefined}
        >
          <input
            type="number"
            min="0"
            disabled={!canEditCoreFields}
            value={childrenVal}
            onChange={(e) => setChildrenVal(Number(e.target.value) || 0)}
            data-testid="booking-edit-children"
            className={`w-full px-3 py-2 border rounded ${!canEditCoreFields ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
          />
        </FormField>
      </div>

      <hr className="my-6" />

      <FormField
        label={t(dict, "bookings.edit.ratePlan")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.financials") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={selectedRatePlanId}
          onChange={(e) => handleRatePlanChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.notSpecified")}</option>
          {ratePlans.map((rp) => <option key={rp.id} value={rp.id}>{rp.name} ({rp.code}){rp.baseRate ? ` — ${formatCurrency(rp.baseRate)} ₽` : ""}</option>)}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t(dict, "bookings.edit.rateNight")}
          disabled={!canEditFinancials}
          lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.financials") : undefined}
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
          label={t(dict, "bookings.edit.total")}
          disabled
        >
          <input
            type="text"
            value={totalAmount ? `${formatCurrency(totalAmount)} ₽` : "—"}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-700"
          />
          {nights > 0 && rateAmount && (
            <p className="text-xs text-gray-500 mt-1">
              {t(dict, "bookings.edit.totalBreakdown", {
                rate: formatCurrency(rateAmount),
                nights,
              })}
            </p>
          )}
        </FormField>
      </div>

      <FormField
        label={t(dict, "bookings.edit.guarantee")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.guarantee") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={guaranteeCodeVal}
          onChange={(e) => setGuaranteeCodeVal(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          <option value="">{t(dict, "bookings.edit.notSpecified")}</option>
          {GUARANTEE_CODES.map((gc) => (
            <option key={gc.code} value={gc.code}>
              {t(dict, gc.labelKey)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={t(dict, "bookings.edit.paymentMethodLabel")}
        disabled={!canEditFinancials}
        lockedReason={!canEditFinancials ? t(dict, "bookings.edit.locked.payment") : undefined}
      >
        <select
          disabled={!canEditFinancials}
          value={paymentMethodVal}
          onChange={(e) => setPaymentMethodVal(e.target.value)}
          className={`w-full px-3 py-2 border rounded ${!canEditFinancials ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        >
          {paymentMethodOptions.map((pm) => (
            <option key={pm.value} value={pm.value}>
              {t(dict, pm.labelKey)}
            </option>
          ))}
        </select>
      </FormField>

      <hr className="my-6" />

      <FormField label={t(dict, "bookings.edit.notes")}>
        <textarea
          rows={3}
          value={notesVal}
          onChange={(e) => setNotesVal(e.target.value)}
          data-testid="booking-edit-notes"
          className="w-full px-3 py-2 border rounded"
        />
        <p className="mt-1 text-xs text-gray-500">{t(dict, "bookings.edit.notesHint")}</p>
      </FormField>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || isTerminal || !!dateError}
          data-testid="booking-edit-submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t(dict, "bookings.edit.saving") : t(dict, "bookings.edit.save")}
        </button>
        <Link
          href={`/bookings/${booking.id}`}
          data-testid="booking-edit-cancel"
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          {t(dict, "bookings.edit.cancel")}
        </Link>
      </div>
    </form>
  );
}
