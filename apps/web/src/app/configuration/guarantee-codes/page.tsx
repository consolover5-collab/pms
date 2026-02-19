import { BackButton } from "@/components/back-button";

const GUARANTEE_CODES = [
  {
    code: "cc_guaranteed",
    label: "Гарантия кредитной картой",
    description:
      "Бронь обеспечена кредитной картой гостя. При no-show возможно списание с карты.",
  },
  {
    code: "company_guaranteed",
    label: "Гарантия компании",
    description:
      "Счёт выставляется компании. При no-show счёт выставляется компании.",
  },
  {
    code: "deposit_guaranteed",
    label: "Гарантия депозитом",
    description:
      "Гость внёс предоплату. При no-show депозит удерживается полностью или частично.",
  },
  {
    code: "non_guaranteed",
    label: "Без гарантии",
    description:
      "Бронь не обеспечена. При no-show финансовые претензии невозможны.",
  },
  {
    code: "travel_agent_guaranteed",
    label: "Гарантия турагента",
    description:
      "Турагент несёт финансовую ответственность. При no-show счёт выставляется агенту.",
  },
];

export default function GuaranteeCodesPage() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <BackButton fallbackHref="/configuration" label="Back to Configuration" />
      <h1 className="text-2xl font-bold mt-2 mb-2">Коды гарантии</h1>
      <p className="text-sm text-gray-500 mb-6">
        Код гарантии определяет чем обеспечена бронь и влияет на обработку
        no-show и отмены бронирования.
      </p>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-52">
                Код
              </th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-48">
                Название
              </th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                Описание
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {GUARANTEE_CODES.map((g) => (
              <tr key={g.code} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-700">{g.code}</td>
                <td className="px-4 py-3 font-medium">{g.label}</td>
                <td className="px-4 py-3 text-gray-600">{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
