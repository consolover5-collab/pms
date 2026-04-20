import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { GuestForm } from "./guest-form";

type Property = {
  id: string;
  name: string;
};

export default async function NewGuestPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t(dict, "guests.noProperty")}</h1>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/guests" style={{ color: "var(--muted)" }}>
          ← {t(dict, "guests.backToGuests")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "guests.newTitle")}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <GuestForm propertyId={property.id} />
        </div>
      </div>
    </>
  );
}
