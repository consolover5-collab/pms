import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import Link from "next/link";

type TransactionCode = {
  id: string;
  code: string;
  description: string;
  groupCode: string;
  transactionType: string;
  isManualPostAllowed: boolean;
  isActive: boolean;
  sortOrder: number;
};

export default async function TransactionCodesPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const allCodes = propertyId
    ? await apiFetch<TransactionCode[]>(
        `/api/transaction-codes?propertyId=${propertyId}`,
      )
    : [];

  const chargeCodes = allCodes.filter((c) => c.transactionType === "charge");
  const paymentCodes = allCodes.filter((c) => c.transactionType === "payment");

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton
            fallbackHref="/configuration"
            label="Back to Configuration"
          />
          <h1 className="text-2xl font-bold mt-2">Коды транзакций</h1>
        </div>
        <Link
          href="/configuration/transaction-codes/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          + Новый код
        </Link>
      </div>

      {allCodes.length === 0 ? (
        <p className="text-gray-500">Коды транзакций не настроены.</p>
      ) : (
        <div className="space-y-8">
          {/* Charges */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-blue-700">
              Начисления ({chargeCodes.length})
            </h2>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Код
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Название
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Группа
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Тип
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {chargeCodes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">
                        {c.code}
                      </td>
                      <td className="px-4 py-2">{c.description}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {c.groupCode}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          charge
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/configuration/transaction-codes/${c.id}/edit`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Изменить
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payments */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-green-700">
              Оплаты ({paymentCodes.length})
            </h2>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Код
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Название
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Группа
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Тип
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentCodes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">
                        {c.code}
                      </td>
                      <td className="px-4 py-2">{c.description}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {c.groupCode}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                          payment
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/configuration/transaction-codes/${c.id}/edit`}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Изменить
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
