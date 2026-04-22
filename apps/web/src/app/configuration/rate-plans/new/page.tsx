import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { RatePlanForm } from "../rate-plan-form";

export default async function NewRatePlanPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/rate-plans" style={{ color: "var(--muted)" }}>
          ← {t(dict, "ratePlans.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "ratePlans.newTitle")}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <RatePlanForm propertyId={propertyId} />
        </div>
      </div>
    </>
  );
}
