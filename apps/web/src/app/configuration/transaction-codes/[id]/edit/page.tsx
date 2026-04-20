import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { TransactionCodeForm } from "../../transaction-code-form";
import { notFound } from "next/navigation";
import { getLocale, getDict, t } from "@/lib/i18n";

type TC = {
  id: string;
  code: string;
  description: string;
  groupCode: string;
  transactionType: string;
  isManualPostAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
  propertyId: string;
};

export default async function EditTransactionCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id || "";

  const allCodes = propertyId
    ? await apiFetch<TC[]>(`/api/transaction-codes?propertyId=${propertyId}`)
    : [];

  const tc = allCodes.find((c) => c.id === id);
  if (!tc) notFound();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/transaction-codes" style={{ color: "var(--muted)" }}>
          ← {t(dict, "txCodes.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "txCodes.editTitle")}</h1>
        <span className="page-sub">{tc.code}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <TransactionCodeForm code={tc} propertyId={propertyId} isEdit />
        </div>
      </div>
    </>
  );
}
