import Link from "next/link";
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
    <div data-testid="config-guarantee-codes-page">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title" data-testid="config-guarantee-codes-title">
          {t(dict, "guaranteeCodes.title")}
        </h1>
        <span className="page-sub" data-testid="config-guarantee-codes-subtitle">
          {t(dict, "guaranteeCodes.subtitle")}
        </span>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="t" data-testid="config-guarantee-codes-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>{t(dict, "guaranteeCodes.colCode")}</th>
                <th style={{ width: 220 }}>{t(dict, "guaranteeCodes.colName")}</th>
                <th>{t(dict, "guaranteeCodes.colDesc")}</th>
              </tr>
            </thead>
            <tbody>
              {GUARANTEE_CODES.map((g) => (
                <tr key={g.code} data-testid={`config-guarantee-codes-row-${g.code}`}>
                  <td className="tnum" style={{ color: "var(--accent)" }}>
                    {g.code}
                  </td>
                  <td style={{ fontWeight: 500 }}>{g.label}</td>
                  <td style={{ color: "var(--muted)" }}>{g.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
