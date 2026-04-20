import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import { RatePlansList } from "./rate-plans-list";

type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export default async function RatePlansPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const ratePlans = propertyId
    ? await apiFetch<RatePlan[]>(`/api/rate-plans?propertyId=${propertyId}`)
    : [];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "ratePlans.title")}</h1>
        <div className="actions">
          <Link href="/configuration/rate-plans/new" className="btn sm primary">
            <Icon name="plus" size={12} />
            {t(dict, "ratePlans.add")}
          </Link>
        </div>
      </div>

      <RatePlansList ratePlans={ratePlans} propertyId={propertyId ?? ""} />
    </>
  );
}
