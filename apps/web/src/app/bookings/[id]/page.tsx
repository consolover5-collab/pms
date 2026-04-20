import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { BookingActions } from "./booking-actions";
import { BookingTabs } from "./booking-tabs";
import { getLocale, getDict, t } from "@/lib/i18n";

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

function statusClass(status: string, checkInDate: string, checkOutDate: string, bizDate: string): string {
  if (status === "confirmed" && checkInDate === bizDate) return "no-show";
  if (status === "checked_in" && checkOutDate === bizDate) return "no-show";
  return status.replace("_", "-");
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDict(locale);

  const booking = await apiFetch<Booking>(`/api/bookings/${id}`);
  const bizDate = await apiFetch<{ date: string }>(`/api/business-date?propertyId=${booking.propertyId}`)
    .then((r) => r.date)
    .catch(() => "");

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkOutDate).getTime() -
        new Date(booking.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  const initials = `${booking.guest.firstName[0] ?? ""}${booking.guest.lastName[0] ?? ""}`.toUpperCase();
  const sCls = statusClass(booking.status, booking.checkInDate, booking.checkOutDate, bizDate);
  const statusLabel = (() => {
    if (booking.status === "confirmed" && booking.checkInDate === bizDate) return t(dict, "bookings.dueIn");
    if (booking.status === "checked_in" && booking.checkOutDate === bizDate) return t(dict, "bookings.dueOut");
    const map: Record<string, string> = {
      confirmed: t(dict, "bookings.status.confirmed"),
      checked_in: t(dict, "bookings.status.checkedIn"),
      checked_out: t(dict, "bookings.status.checkedOut"),
      cancelled: t(dict, "bookings.status.cancelled"),
      no_show: t(dict, "bookings.status.noShow"),
    };
    return map[booking.status] ?? booking.status;
  })();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
        <Link href="/bookings" style={{ color: "var(--muted)" }}>
          ← {t(dict, "common.backToBookings")}
        </Link>
        <span>·</span>
        <span className="tnum">{booking.confirmationNumber}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
        <div
          className="av"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 600,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            flexShrink: 0,
          }}
        >
          {initials || "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>
              {booking.guest.firstName} {booking.guest.lastName}
            </h1>
            <span className={`badge ${sCls}`}>
              <span className="dot" />
              {statusLabel}
            </span>
            {booking.guaranteeCode && (
              <span className="badge outline">{booking.guaranteeCode}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--muted)", marginTop: 6, flexWrap: "wrap" }}>
            <span>
              <span className="tnum" style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {booking.confirmationNumber}
              </span>
            </span>
            <span>
              {t(dict, "common.room")}{" "}
              <strong style={{ color: "var(--fg)" }}>
                {booking.room ? `${booking.room.roomNumber} · ${booking.roomType.code}` : booking.roomType.code}
              </strong>
            </span>
            <span>
              {t(dict, "bookingDetail.checkInAt")} <strong style={{ color: "var(--fg)" }}>{booking.checkInDate}</strong>
            </span>
            <span>
              {t(dict, "bookingDetail.checkOutAt")} <strong style={{ color: "var(--fg)" }}>{booking.checkOutDate}</strong>
            </span>
            <span>
              {t(dict, "bookingDetail.nights", { count: nights })} ·{" "}
              {t(dict, "bookingDetail.adults", { count: booking.adults })}
              {booking.children > 0 ? `, ${t(dict, "bookingDetail.children", { count: booking.children })}` : ""}
            </span>
            {booking.ratePlan && (
              <span>
                {t(dict, "bookingDetail.ratePlan")} <strong style={{ color: "var(--fg)" }}>{booking.ratePlan.name}</strong>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignSelf: "flex-start", flexShrink: 0 }}>
          <Link href={`/bookings/${booking.id}/edit`} className="btn">
            {t(dict, "common.editBooking")}
          </Link>
        </div>
      </div>

      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        checkInDate={booking.checkInDate}
        hasRoom={!!booking.room}
        propertyId={booking.propertyId}
        roomTypeId={booking.roomType.id}
        currentRoomId={booking.room?.id ?? null}
      />

      <BookingTabs
        bookingId={booking.id}
        nights={nights}
        booking={{
          guest: {
            id: booking.guest.id,
            email: booking.guest.email,
            phone: booking.guest.phone,
          },
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          actualCheckIn: booking.actualCheckIn,
          actualCheckOut: booking.actualCheckOut,
          adults: booking.adults,
          children: booking.children,
          rateAmount: booking.rateAmount,
          paymentMethod: booking.paymentMethod,
          guaranteeCode: booking.guaranteeCode,
          ratePlan: booking.ratePlan,
          room: booking.room,
          roomType: booking.roomType,
          notes: booking.notes,
          createdAt: booking.createdAt,
          estAmount:
            booking.rateAmount != null
              ? formatCurrency(String(parseFloat(booking.rateAmount) * nights))
              : null,
          rateFormatted: booking.rateAmount != null ? formatCurrency(booking.rateAmount) : null,
        }}
      />
    </>
  );
}
