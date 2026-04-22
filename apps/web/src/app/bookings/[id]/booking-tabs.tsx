"use client";

import { useState } from "react";
import Link from "next/link";
import { FolioSection } from "./folio-section";
import { useLocale } from "@/components/locale-provider";
import { t, plural } from "@/lib/i18n";
import type { DictionaryKey, Dictionary } from "@/lib/i18n/locales/en";
import type { Locale } from "@/lib/i18n";

function formatCount(
  dict: Dictionary,
  locale: Locale,
  keyPrefix: "bookingDetail.adultsCount" | "bookingDetail.childrenCount",
  count: number,
): string {
  const form =
    locale === "ru"
      ? plural(count, "one", "few", "many")
      : count === 1
        ? "one"
        : "few";
  return t(dict, `${keyPrefix}.${form}` as DictionaryKey, { count: String(count) });
}

type BookingInfo = {
  guest: { id: string; email: string | null; phone: string | null };
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  adults: number;
  children: number;
  rateAmount: string | null;
  paymentMethod: string | null;
  guaranteeCode: string | null;
  ratePlan: { id: string; name: string; code: string } | null;
  room: { id: string; roomNumber: string } | null;
  roomType: { id: string; name: string; code: string };
  notes: string | null;
  createdAt: string;
  estAmount: string | null;
  rateFormatted: string | null;
};

type Tab = "folio" | "stay" | "services" | "history" | "notes";

function LabVal({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fg)" }}>{value || "—"}</div>
    </div>
  );
}

export function BookingTabs({
  bookingId,
  booking,
  nights,
}: {
  bookingId: string;
  booking: BookingInfo;
  nights: number;
}) {
  const { dict, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("folio");

  const adultsStr = formatCount(dict, locale, "bookingDetail.adultsCount", booking.adults);
  const childrenStr = booking.children
    ? formatCount(dict, locale, "bookingDetail.childrenCount", booking.children)
    : "";
  const guestsSummary = childrenStr ? `${adultsStr}, ${childrenStr}` : adultsStr;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "folio", label: t(dict, "bookingDetail.tab.folio") },
    { id: "stay", label: t(dict, "bookingDetail.tab.stay") },
    { id: "services", label: t(dict, "bookingDetail.tab.services") },
    { id: "history", label: t(dict, "bookingDetail.tab.history") },
    { id: "notes", label: t(dict, "bookingDetail.tab.notes"), count: booking.notes ? 1 : 0 },
  ];

  return (
    <div>
      <div className="tabs-bar">
        {tabs.map((tb) => (
          <div key={tb.id} className={`tb ${tab === tb.id ? "on" : ""}`} onClick={() => setTab(tb.id)}>
            {tb.label}
            {typeof tb.count === "number" && tb.count > 0 && <span className="count">{tb.count}</span>}
          </div>
        ))}
      </div>

      {tab === "folio" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
          <div>
            <FolioSection bookingId={bookingId} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-head">
                <div className="card-title">{t(dict, "bookingDetail.guest")}</div>
                <Link href={`/guests/${booking.guest.id}`} className="btn xs ghost">
                  {t(dict, "bookingDetail.profileLink")}
                </Link>
              </div>
              <div className="card-body" style={{ fontSize: 12 }}>
                <LabVal label={t(dict, "bookingDetail.emailLabel")} value={booking.guest.email} />
                <div style={{ height: 8 }} />
                <LabVal label={t(dict, "bookingDetail.phoneLabel")} value={booking.guest.phone} />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">{t(dict, "bookingDetail.preferences")}</div>
              </div>
              <div className="card-body" style={{ fontSize: 12, color: "var(--muted)" }}>
                {t(dict, "bookingDetail.preferencesEmpty")}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">{t(dict, "bookingDetail.activity")}</div>
              </div>
              <div className="card-body" style={{ fontSize: 11.5 }}>
                <div style={{ color: "var(--muted)" }}>
                  {t(dict, "bookingDetail.createdAt")}: {new Date(booking.createdAt).toLocaleString()}
                </div>
                {booking.actualCheckIn && (
                  <div style={{ color: "var(--muted)", marginTop: 6 }}>
                    {t(dict, "bookingDetail.actualCheckIn")}: {new Date(booking.actualCheckIn).toLocaleString()}
                  </div>
                )}
                {booking.actualCheckOut && (
                  <div style={{ color: "var(--muted)", marginTop: 6 }}>
                    {t(dict, "bookingDetail.actualCheckOut")}: {new Date(booking.actualCheckOut).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "stay" && (
        <div className="card">
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <LabVal label={t(dict, "bookingDetail.checkInAt")} value={booking.checkInDate} />
            <LabVal label={t(dict, "bookingDetail.checkOutAt")} value={booking.checkOutDate} />
            <LabVal label={t(dict, "bookingDetail.nightsLabel")} value={String(nights)} />
            <LabVal label={t(dict, "bookingDetail.guestsLabel")} value={guestsSummary} />
            <LabVal
              label={t(dict, "common.room")}
              value={booking.room ? `#${booking.room.roomNumber}` : t(dict, "bookingDetail.roomNotAssigned")}
            />
            <LabVal
              label={t(dict, "bookingDetail.roomTypeLabel")}
              value={`${booking.roomType.name} (${booking.roomType.code})`}
            />
            <LabVal label={t(dict, "bookingDetail.ratePlan")} value={booking.ratePlan?.name || null} />
            <LabVal label={t(dict, "bookingDetail.rateNight")} value={booking.rateFormatted} />
            <LabVal label={t(dict, "booking.estAmount")} value={booking.estAmount} />
            <LabVal label={t(dict, "bookingDetail.payment")} value={booking.paymentMethod} />
            <LabVal label={t(dict, "booking.guarantee")} value={booking.guaranteeCode} />
            <LabVal
              label={t(dict, "bookingDetail.actualCheckIn")}
              value={booking.actualCheckIn ? new Date(booking.actualCheckIn).toLocaleString() : null}
            />
            <LabVal
              label={t(dict, "bookingDetail.actualCheckOut")}
              value={booking.actualCheckOut ? new Date(booking.actualCheckOut).toLocaleString() : null}
            />
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="card">
          <div className="card-body" style={{ fontSize: 13 }}>
            {booking.notes ? (
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{booking.notes}</p>
            ) : (
              <p style={{ color: "var(--muted)", margin: 0 }}>{t(dict, "bookingDetail.noNotes")}</p>
            )}
          </div>
        </div>
      )}

      {(tab === "services" || tab === "history") && (
        <div className="stub">
          <div className="wip">{t(dict, "bookingDetail.designInProgress")}</div>
          <h3>{tabs.find((t) => t.id === tab)?.label}</h3>
        </div>
      )}
    </div>
  );
}
