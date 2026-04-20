"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export function RatePlansList({
  ratePlans,
  propertyId,
}: {
  ratePlans: RatePlan[];
  propertyId: string;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm(t(dict, "ratePlans.confirmDelete"))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/rate-plans/${id}?propertyId=${propertyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert(t(dict, "ratePlans.deleteFailed"));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          {t(dict, "ratePlans.title")} <span className="count">{ratePlans.length}</span>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {ratePlans.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            {t(dict, "ratePlans.empty")}
          </div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 100 }}>{t(dict, "ratePlans.colCode")}</th>
                <th>{t(dict, "ratePlans.colName")}</th>
                <th className="r" style={{ width: 140 }}>
                  {t(dict, "ratePlans.colBase")}
                </th>
                <th style={{ width: 110 }}>{t(dict, "ratePlans.colStatus")}</th>
                <th className="r">{t(dict, "ratePlans.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((rp) => (
                <tr key={rp.id}>
                  <td className="tnum">{rp.code}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Link
                        href={`/configuration/rate-plans/${rp.id}/edit`}
                        style={{ color: "var(--fg)", fontWeight: 500 }}
                      >
                        {rp.name}
                      </Link>
                      {rp.isDefault && (
                        <span className="badge confirmed">
                          <span className="dot" />
                          {t(dict, "ratePlans.base")}
                        </span>
                      )}
                    </div>
                    {rp.description && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{rp.description}</div>
                    )}
                  </td>
                  <td className="r tnum">
                    {rp.baseRate ? `${formatCurrency(rp.baseRate)} ₽` : "—"}
                  </td>
                  <td>
                    <span className={`badge ${rp.isActive ? "checked-in" : "cancelled"}`}>
                      <span className="dot" />
                      {rp.isActive ? t(dict, "ratePlans.active") : t(dict, "ratePlans.inactive")}
                    </span>
                  </td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Link
                        href={`/configuration/rate-plans/${rp.id}/edit`}
                        className="btn xs ghost"
                      >
                        {t(dict, "ratePlans.edit")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(rp.id)}
                        disabled={deleting === rp.id}
                        className="btn xs danger"
                      >
                        {deleting === rp.id
                          ? t(dict, "ratePlans.deleting")
                          : t(dict, "ratePlans.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
