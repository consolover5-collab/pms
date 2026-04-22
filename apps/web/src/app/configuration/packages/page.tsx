import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import { PackagesList } from "./packages-list";

type Package = {
  id: string;
  code: string;
  name: string;
  amount: string;
  calculationRule: string;
  postingRhythm: string;
  isActive: boolean;
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { q } = await searchParams;
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  let packages: Package[] = [];
  if (propertyId) {
    const url = q
      ? `/api/packages?propertyId=${propertyId}&q=${encodeURIComponent(q)}`
      : `/api/packages?propertyId=${propertyId}`;
    const res = await apiFetch<{ data: Package[] }>(url);
    packages = res.data;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title" data-testid="packages-title">{t(dict, "packages.title")}</h1>
        <div className="actions">
          <Link href="/configuration/packages/new" className="btn sm primary" data-testid="packages-new">
            <Icon name="plus" size={12} />
            {t(dict, "packages.add")}
          </Link>
        </div>
      </div>

      <PackagesList packages={packages} initialSearch={q || ""} />
    </>
  );
}
