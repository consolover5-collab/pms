"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type Guest = { id: string; firstName: string; lastName: string; name: string };
type RoomType = { id: string; name: string; code: string };
type Room = { id: string; roomNumber: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string };
type RatePlan = { id: string; name: string; code: string; baseRate: string | null; isDefault: boolean };
type RoomRate = { ratePlanId: string; roomTypeId: string; amount: string };
type Profile = { id: string; name: string };

const required = (
  <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
);

export function BookingForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { dict } = useLocale();
  const [error, setError] = useState<string | ApiErrorDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);
  const [companies, setCompanies] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [sources, setSources] = useState<Profile[]>([]);

  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [rateAmount, setRateAmount] = useState("");
  const [guaranteeCode, setGuaranteeCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  const [showNewGuest, setShowNewGuest] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [newGuestData, setNewGuestData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const dateError = useMemo(() => {
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return t(dict, "newBooking.dateError");
    }
    return null;
  }, [checkInDate, checkOutDate, dict]);

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
        const [gRaw, rt, rm, rpRaw, compRaw, agentRaw, sourceRaw] = await Promise.all([
          fetch(`/api/profiles?propertyId=${propertyId}&type=individual`).then((r) => r.json()),
          fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rooms?propertyId=${propertyId}`).then((r) => r.json()),
          fetch(`/api/rate-plans?propertyId=${propertyId}`).then((r) => r.json()).catch(() => []),
          fetch(`/api/profiles?propertyId=${propertyId}&type=company`).then((r) => r.json()),
          fetch(`/api/profiles?propertyId=${propertyId}&type=travel_agent`).then((r) => r.json()),
          fetch(`/api/profiles?propertyId=${propertyId}&type=source`).then((r) => r.json()),
        ]);
        const g = gRaw.data ?? [];
        const rp = Array.isArray(rpRaw) ? rpRaw : (rpRaw.data ?? []);
        setGuests(g);
        setRoomTypes(Array.isArray(rt) ? rt : (rt.data ?? []));
        setRooms(Array.isArray(rm) ? rm : (rm.data ?? []));
        setRatePlans(rp);
        setCompanies(compRaw.data ?? []);
        setAgents(agentRaw.data ?? []);
        setSources(sourceRaw.data ?? []);
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
        const defaultPlan = rp.find((p: RatePlan) => p.isDefault);
        if (defaultPlan) {
          setSelectedRatePlanId(defaultPlan.id);
          if (defaultPlan.baseRate) setRateAmount(defaultPlan.baseRate);
        }
      } catch {
        setError(t(dict, "newBooking.loadFailed"));
      }
    }
    loadData();
  }, [propertyId, dict]);

  const filteredRooms = selectedRoomTypeId
    ? rooms.filter((r) => r.roomTypeId === selectedRoomTypeId)
    : rooms;

  function getRoomLabel(room: Room): string {
    const statusParts: string[] = [];
    if (room.occupancyStatus === "occupied") statusParts.push(t(dict, "newBooking.roomStatus.occupied"));
    if (room.housekeepingStatus === "dirty") statusParts.push(t(dict, "newBooking.roomStatus.dirty"));
    else if (room.housekeepingStatus === "out_of_order") statusParts.push(t(dict, "newBooking.roomStatus.ooo"));
    else if (room.housekeepingStatus === "out_of_service") statusParts.push(t(dict, "newBooking.roomStatus.oos"));

    return statusParts.length > 0
      ? `${room.roomNumber} (${statusParts.join(", ")})`
      : room.roomNumber;
  }

  function getRateForPlanAndType(ratePlanId: string, roomTypeId: string): string | null {
    const matrixRate = roomRates.find(
      (r) => r.ratePlanId === ratePlanId && r.roomTypeId === roomTypeId
    );
    if (matrixRate) return matrixRate.amount;
    const plan = ratePlans.find((p) => p.id === ratePlanId);
    return plan?.baseRate ?? null;
  }

  function handleRatePlanChange(ratePlanId: string) {
    setSelectedRatePlanId(ratePlanId);
    if (ratePlanId) {
      const rate = getRateForPlanAndType(ratePlanId, selectedRoomTypeId);
      if (rate) setRateAmount(rate);
    }
  }

  async function handleCreateGuest() {
    if (!newGuestData.firstName || !newGuestData.lastName) {
      setError(t(dict, "newBooking.nameRequired"));
      return;
    }

    setCreatingGuest(true);
    setError(null);

    try {
      const res = await fetch(`/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          type: "individual",
          name: `${newGuestData.firstName} ${newGuestData.lastName}`,
          ...newGuestData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t(dict, "newBooking.serverError", { status: res.status }));
      }

      const newGuest = await res.json();
      setGuests((prev) => [...prev, newGuest]);
      setSelectedGuestId(newGuest.id);
      setShowNewGuest(false);
      setNewGuestData({ firstName: "", lastName: "", email: "", phone: "" });
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(t(dict, "newBooking.connectionError"));
      } else {
        setError(err instanceof Error ? err.message : t(dict, "newBooking.createGuestFailed"));
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
      setError(t(dict, "newBooking.rateRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      propertyId,
      guestProfileId: selectedGuestId,
      roomTypeId: selectedRoomTypeId,
      checkInDate,
      checkOutDate,
      adults,
      children,
    };

    if (selectedRoomId) body.roomId = selectedRoomId;
    if (selectedRatePlanId) body.ratePlanId = selectedRatePlanId;
    if (rateAmount) body.rateAmount = rateAmount;
    if (guaranteeCode) body.guaranteeCode = guaranteeCode;
    if (paymentMethod) body.paymentMethod = paymentMethod;
    if (notes) body.notes = notes;
    if (selectedCompanyId) body.companyProfileId = selectedCompanyId;
    if (selectedAgentId) body.agentProfileId = selectedAgentId;
    if (selectedSourceId) body.sourceProfileId = selectedSourceId;

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
          error: data.error || t(dict, "newBooking.serverError", { status: res.status }),
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
          error: t(dict, "newBooking.connectionError"),
          code: "NETWORK_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      } else {
        setError({
          error: err instanceof Error ? err.message : t(dict, "newBooking.saveFailed"),
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 720,
      }}
    >
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

      {/* Guest Selection */}
      <div className="field">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <label className="lab">
            {t(dict, "newBooking.fld.guest")}
            {required}
          </label>
          <button
            type="button"
            onClick={() => setShowNewGuest(!showNewGuest)}
            className="btn xs ghost"
          >
            {showNewGuest
              ? t(dict, "newBooking.cancelAdd")
              : t(dict, "newBooking.addNewGuest")}
          </button>
        </div>

        {!showNewGuest ? (
          <select
            name="guestId"
            required
            value={selectedGuestId}
            onChange={(e) => setSelectedGuestId(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.selectGuest")}</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.lastName || g.name}, {g.firstName}
              </option>
            ))}
          </select>
        ) : (
          <div
            style={{
              padding: 12,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div className="field">
                <label className="lab">
                  {t(dict, "newBooking.fld.firstName")}
                  {required}
                </label>
                <input
                  type="text"
                  value={newGuestData.firstName}
                  onChange={(e) =>
                    setNewGuestData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  className="input"
                  placeholder={t(dict, "newBooking.ph.firstName")}
                />
              </div>
              <div className="field">
                <label className="lab">
                  {t(dict, "newBooking.fld.lastName")}
                  {required}
                </label>
                <input
                  type="text"
                  value={newGuestData.lastName}
                  onChange={(e) =>
                    setNewGuestData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  className="input"
                  placeholder={t(dict, "newBooking.ph.lastName")}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div className="field">
                <label className="lab">{t(dict, "newBooking.fld.email")}</label>
                <input
                  type="email"
                  value={newGuestData.email}
                  onChange={(e) =>
                    setNewGuestData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="input"
                  placeholder={t(dict, "newBooking.ph.email")}
                />
              </div>
              <div className="field">
                <label className="lab">{t(dict, "newBooking.fld.phone")}</label>
                <input
                  type="tel"
                  value={newGuestData.phone}
                  onChange={(e) =>
                    setNewGuestData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="input"
                  placeholder={t(dict, "newBooking.ph.phone")}
                />
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={handleCreateGuest}
                disabled={creatingGuest}
                className="btn primary sm"
              >
                {creatingGuest
                  ? t(dict, "newBooking.creatingGuest")
                  : t(dict, "newBooking.createGuestSelect")}
              </button>
            </div>
            {selectedGuestId && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--checked-in-fg)",
                }}
              >
                {t(dict, "newBooking.guestSelected", {
                  name: guests.find((g) => g.id === selectedGuestId)?.name ?? "",
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
      >
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.company")}</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.none")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.travelAgent")}</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.none")}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.source")}</label>
          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.none")}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">
            {t(dict, "newBooking.fld.checkIn")}
            {required}
          </label>
          <input
            type="date"
            required
            value={checkInDate}
            onChange={(e) => {
              setCheckInDate(e.target.value);
              if (checkOutDate && e.target.value >= checkOutDate) {
                setCheckOutDate("");
              }
            }}
            className="input"
          />
        </div>
        <div className="field">
          <label className="lab">
            {t(dict, "newBooking.fld.checkOut")}
            {required}
          </label>
          <input
            type="date"
            required
            value={checkOutDate}
            min={
              checkInDate
                ? (() => {
                    const d = new Date(checkInDate);
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().split("T")[0];
                  })()
                : undefined
            }
            onChange={(e) => setCheckOutDate(e.target.value)}
            className="input"
            style={dateError ? { borderColor: "var(--cancelled)" } : undefined}
          />
          {dateError && (
            <span className="hint" style={{ color: "var(--cancelled)" }}>
              {dateError}
            </span>
          )}
          {nights > 0 && !dateError && (
            <span className="hint">
              {t(dict, nights === 1 ? "newBooking.night" : "newBooking.nights", {
                count: nights,
              })}
            </span>
          )}
        </div>
      </div>

      <div className="field">
        <label className="lab">
          {t(dict, "newBooking.fld.roomType")}
          {required}
        </label>
        <select
          required
          value={selectedRoomTypeId}
          onChange={(e) => {
            setSelectedRoomTypeId(e.target.value);
            setSelectedRoomId("");
            if (selectedRatePlanId && e.target.value) {
              const rate = getRateForPlanAndType(selectedRatePlanId, e.target.value);
              if (rate) setRateAmount(rate);
            }
          }}
          className="input"
        >
          <option value="">{t(dict, "newBooking.selectRoomType")}</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name} ({rt.code})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "newBooking.fld.room")}</label>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="input"
        >
          <option value="">{t(dict, "newBooking.assignLater")}</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {getRoomLabel(r)}
            </option>
          ))}
        </select>
        <span className="hint">
          {selectedRoomTypeId
            ? t(dict, "newBooking.roomsShowing", { count: filteredRooms.length })
            : t(dict, "newBooking.selectTypeFirst")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.adults")}</label>
          <input
            type="number"
            min="1"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value) || 1)}
            className="input tnum"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.children")}</label>
          <input
            type="number"
            min="0"
            value={children}
            onChange={(e) => setChildren(Number(e.target.value) || 0)}
            className="input tnum"
          />
        </div>
      </div>

      <div
        style={{
          border: 0,
          borderTop: "1px solid var(--border)",
          margin: "6px 0",
        }}
      />

      <div className="field">
        <label className="lab">
          {t(dict, "newBooking.fld.ratePlan")}
          {required}
        </label>
        <select
          required
          value={selectedRatePlanId}
          onChange={(e) => handleRatePlanChange(e.target.value)}
          className="input"
        >
          <option value="">{t(dict, "newBooking.selectRatePlan")}</option>
          {ratePlans.map((rp) => (
            <option key={rp.id} value={rp.id}>
              {rp.isDefault ? "★ " : ""}
              {rp.name} ({rp.code})
              {rp.baseRate ? ` — ${formatCurrency(rp.baseRate)} ₽` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.rateNight")}</label>
          <input
            type="number"
            step="0.01"
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
            className="input tnum"
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.total")}</label>
          <input
            type="text"
            value={totalAmount ? `${formatCurrency(totalAmount)} ₽` : "—"}
            disabled
            className="input tnum"
            style={{ background: "var(--bg-subtle)" }}
          />
          {nights > 0 && rateAmount && (
            <span className="hint tnum">
              {t(dict, "newBooking.rateTimes", {
                rate: formatCurrency(rateAmount),
                nights,
              })}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.paymentMethod")}</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.notSpecified")}</option>
            <option value="cash">{t(dict, "newBooking.pay.cash")}</option>
            <option value="card">{t(dict, "newBooking.pay.card")}</option>
            <option value="bank_transfer">{t(dict, "newBooking.pay.transfer")}</option>
            <option value="company">{t(dict, "newBooking.pay.company")}</option>
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "newBooking.fld.guarantee")}</label>
          <select
            value={guaranteeCode}
            onChange={(e) => setGuaranteeCode(e.target.value)}
            className="input"
          >
            <option value="">{t(dict, "newBooking.notSpecified")}</option>
            <option value="cc_guaranteed">{t(dict, "newBooking.guar.cc")}</option>
            <option value="deposit_guaranteed">{t(dict, "newBooking.guar.deposit")}</option>
            <option value="company_guaranteed">{t(dict, "newBooking.guar.company")}</option>
            <option value="non_guaranteed">{t(dict, "newBooking.guar.none")}</option>
            <option value="travel_agent_guaranteed">{t(dict, "newBooking.guar.ta")}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "newBooking.fld.notes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input"
          style={{ resize: "vertical", minHeight: 72 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="submit"
          disabled={saving || !!dateError}
          className="btn primary"
        >
          {saving
            ? t(dict, "newBooking.creatingBooking")
            : t(dict, "newBooking.createBtn")}
        </button>
        <Link href="/bookings" className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
