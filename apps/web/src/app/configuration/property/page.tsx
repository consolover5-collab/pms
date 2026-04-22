import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { PropertyForm } from "./property-form";

type Property = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfRooms: number | null;
  numberOfFloors: number | null;
  taxRate: string | null;
};

export default async function PropertySettingsPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "property.title")}</h1>
        <span className="page-sub">{t(dict, "property.subtitle")}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <PropertyForm property={property} />
        </div>
      </div>
    </>
  );
}
