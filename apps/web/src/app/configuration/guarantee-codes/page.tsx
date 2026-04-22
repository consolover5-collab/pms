import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { GUARANTEE_CODES } from "@/lib/constants/guarantee-codes";

export default async function GuaranteeCodesPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

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
                  <td style={{ fontWeight: 500 }}>{t(dict, g.labelKey)}</td>
                  <td style={{ color: "var(--muted)" }}>{t(dict, g.descKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
