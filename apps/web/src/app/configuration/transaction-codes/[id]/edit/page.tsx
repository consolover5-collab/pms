import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
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
    <main className="p-8 max-w-2xl mx-auto">
      <BackButton
        fallbackHref="/configuration/transaction-codes"
        label="Back to Transaction Codes"
      />
      <h1 className="text-2xl font-bold mt-2 mb-6">{t(dict, "txCodes.editTitle")}</h1>
      <TransactionCodeForm code={tc} propertyId={propertyId} isEdit />
    </main>
  );
}
