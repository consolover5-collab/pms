import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BookingForm } from "./booking-form";
import { getLocale, getDict, t } from "@/lib/i18n";

type Property = {
  id: string;
  name: string;
};

export default async function NewBookingPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t(dict, "dashboard.noProperty")}</h1>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/bookings" style={{ color: "var(--muted)" }}>
          ← {t(dict, "common.backToBookings")}
        </Link>
      </div>
      <div className="page-head">
        <h1 className="page-title">{t(dict, "nav.newBooking")}</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <BookingForm propertyId={property.id} />
        </div>
      </div>
    </>
  );
}
