import { BackButton } from "@/components/back-button";
import { getLocale, getDict, t } from "@/lib/i18n";

export default async function GuaranteeCodesPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

  const GUARANTEE_CODES = [
    {
      code: "cc_guaranteed",
      label: t(dict, "gc.cc.label"),
      description: t(dict, "gc.cc.desc"),
    },
    {
      code: "company_guaranteed",
      label: t(dict, "gc.co.label"),
      description: t(dict, "gc.co.desc"),
    },
    {
      code: "deposit_guaranteed",
      label: t(dict, "gc.dep.label"),
      description: t(dict, "gc.dep.desc"),
    },
    {
      code: "non_guaranteed",
      label: t(dict, "gc.ng.label"),
      description: t(dict, "gc.ng.desc"),
    },
    {
      code: "travel_agent_guaranteed",
      label: t(dict, "gc.ta.label"),
      description: t(dict, "gc.ta.desc"),
    },
  ];

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <BackButton fallbackHref="/configuration" label="Back to Configuration" />
      <h1 className="text-2xl font-bold mt-2 mb-2">{t(dict, "guaranteeCodes.title")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t(dict, "guaranteeCodes.subtitle")}
      </p>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-52">
                {t(dict, "guaranteeCodes.colCode")}
              </th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-48">
                {t(dict, "guaranteeCodes.colName")}
              </th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                {t(dict, "guaranteeCodes.colDesc")}
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
