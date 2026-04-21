import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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
  const locale = await getLocale();
  const dict = getDict(locale);

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
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title" data-testid="tx-codes-title">{t(dict, "txCodes.title")}</h1>
        <div className="actions">
          <Link href="/configuration/transaction-codes/new" className="btn sm primary" data-testid="tx-codes-new">
            <Icon name="plus" size={12} />
            {t(dict, "txCodes.newCode")}
          </Link>
        </div>
      </div>

      {allCodes.length === 0 ? (
        <div className="card" data-testid="tx-codes-empty">
          <div className="card-body" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>
            {t(dict, "txCodes.empty")}
          </div>
        </div>
      ) : (
        <>
          <div className="card" data-testid="tx-codes-charges-card">
            <div className="card-head">
              <div className="card-title">
                {t(dict, "txCodes.charges", { count: String(chargeCodes.length) })}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="t">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>{t(dict, "txCodes.colCode")}</th>
                    <th>{t(dict, "txCodes.colName")}</th>
                    <th style={{ width: 120 }}>{t(dict, "txCodes.colGroup")}</th>
                    <th style={{ width: 100 }}>{t(dict, "txCodes.colType")}</th>
                    <th className="r" style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {chargeCodes.map((c) => (
                    <tr key={c.id} data-testid="tx-code-row" data-tx-code-id={c.id}>
                      <td className="tnum" data-testid="tx-code-code">{c.code}</td>
                      <td data-testid="tx-code-description">{c.description}</td>
                      <td style={{ color: "var(--muted)" }} data-testid="tx-code-group">{c.groupCode}</td>
                      <td>
                        <span className="badge confirmed" data-testid="tx-code-type-badge">
                          <span className="dot" />
                          charge
                        </span>
                      </td>
                      <td className="r">
                        <Link
                          href={`/configuration/transaction-codes/${c.id}/edit`}
                          className="btn xs ghost"
                          data-testid="tx-code-edit"
                        >
                          {t(dict, "txCodes.edit")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" data-testid="tx-codes-payments-card">
            <div className="card-head">
              <div className="card-title">
                {t(dict, "txCodes.payments", { count: String(paymentCodes.length) })}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="t">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>{t(dict, "txCodes.colCode")}</th>
                    <th>{t(dict, "txCodes.colName")}</th>
                    <th style={{ width: 120 }}>{t(dict, "txCodes.colGroup")}</th>
                    <th style={{ width: 100 }}>{t(dict, "txCodes.colType")}</th>
                    <th className="r" style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {paymentCodes.map((c) => (
                    <tr key={c.id} data-testid="tx-code-row" data-tx-code-id={c.id}>
                      <td className="tnum" data-testid="tx-code-code">{c.code}</td>
                      <td data-testid="tx-code-description">{c.description}</td>
                      <td style={{ color: "var(--muted)" }} data-testid="tx-code-group">{c.groupCode}</td>
                      <td>
                        <span className="badge checked-in" data-testid="tx-code-type-badge">
                          <span className="dot" />
                          payment
                        </span>
                      </td>
                      <td className="r">
                        <Link
                          href={`/configuration/transaction-codes/${c.id}/edit`}
                          className="btn xs ghost"
                          data-testid="tx-code-edit"
                        >
                          {t(dict, "txCodes.edit")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
