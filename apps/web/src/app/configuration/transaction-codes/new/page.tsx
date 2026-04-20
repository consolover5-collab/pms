import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { TransactionCodeForm } from "../transaction-code-form";
import { getLocale, getDict, t } from "@/lib/i18n";

export default async function NewTransactionCodePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id || "";

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <BackButton
        fallbackHref="/configuration/transaction-codes"
        label="Back to Transaction Codes"
      />
      <h1 className="text-2xl font-bold mt-2 mb-6">{t(dict, "txCodes.newTitle")}</h1>
      <TransactionCodeForm propertyId={propertyId} />
    </main>
  );
}
