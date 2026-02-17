import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";

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
          <h1 className="text-2xl font-bold mt-2">Transaction Codes</h1>
        </div>
      </div>

      {allCodes.length === 0 ? (
        <p className="text-gray-500">No transaction codes configured.</p>
      ) : (
        <div className="space-y-8">
          {/* Charges */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-blue-700">
              Charges ({chargeCodes.length})
            </h2>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Group
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Type
                    </th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payments */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-green-700">
              Payments ({paymentCodes.length})
            </h2>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Group
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                      Type
                    </th>
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
