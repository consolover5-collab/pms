import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { TransactionCodeForm } from "../transaction-code-form";

export default async function NewTransactionCodePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id || "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/transaction-codes" style={{ color: "var(--muted)" }}>
          ← {t(dict, "txCodes.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "txCodes.newTitle")}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <TransactionCodeForm propertyId={propertyId} />
        </div>
      </div>
    </>
  );
}
