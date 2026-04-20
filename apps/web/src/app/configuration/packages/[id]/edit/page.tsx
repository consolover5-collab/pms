import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { PackageForm } from "../../package-form";

type TransactionCode = { id: string; code: string; description: string | null };
type RatePlan = { id: string; code: string; name: string };
type PackageRatePlanLink = { ratePlanId: string; includedInRate: boolean };
type Package = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  transactionCodeId: string;
  calculationRule: string;
  amount: string;
  postingRhythm: string;
  isActive: boolean;
};

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;

  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id ?? "";

  const [pkg, transactionCodes, ratePlans, linkedRatePlansData] = await Promise.all([
    apiFetch<Package>(`/api/packages/${id}`),
    propertyId
      ? apiFetch<TransactionCode[]>(`/api/transaction-codes?propertyId=${propertyId}`)
      : Promise.resolve([] as TransactionCode[]),
    propertyId
      ? apiFetch<RatePlan[]>(`/api/rate-plans?propertyId=${propertyId}`)
      : Promise.resolve([] as RatePlan[]),
    apiFetch<{ data: PackageRatePlanLink[] }>(`/api/packages/${id}/rate-plans`),
  ]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/packages" style={{ color: "var(--muted)" }}>
          ← {t(dict, "packages.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "packages.editTitle")}</h1>
        <span className="page-sub">{pkg.name}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <PackageForm
            pkg={pkg}
            propertyId={propertyId}
            transactionCodes={transactionCodes}
            ratePlans={ratePlans}
            linkedRatePlans={linkedRatePlansData.data}
            isEdit
          />
        </div>
      </div>
    </>
  );
}
