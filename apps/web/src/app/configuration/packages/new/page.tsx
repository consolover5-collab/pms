import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { PackageForm } from "../package-form";

type TransactionCode = { id: string; code: string; description: string | null };

export default async function NewPackagePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id ?? "";

  const transactionCodes = propertyId
    ? await apiFetch<TransactionCode[]>(`/api/transaction-codes?propertyId=${propertyId}`)
    : [];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/packages" style={{ color: "var(--muted)" }}>
          ← {t(dict, "packages.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "packages.newTitle")}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <PackageForm
            propertyId={propertyId}
            transactionCodes={transactionCodes}
            ratePlans={[]}
          />
        </div>
      </div>
    </>
  );
}
