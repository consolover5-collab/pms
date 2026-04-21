"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Package = {
  id: string;
  code: string;
  name: string;
  amount: string;
  calculationRule: string;
  postingRhythm: string;
  isActive: boolean;
};

export function PackagesList({
  packages,
  initialSearch,
}: {
  packages: Package[];
  initialSearch: string;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [search, setSearch] = useState(initialSearch);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/configuration/packages?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push(`/configuration/packages`);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const action = currentActive
      ? t(dict, "packages.deactivate").toLowerCase()
      : t(dict, "packages.activate").toLowerCase();
    if (!confirm(t(dict, "packages.confirmToggle", { action }))) return;
    setDeactivating(id);
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert(t(dict, "packages.updateFailed"));
      }
    } catch {
      alert(t(dict, "profiles.networkError"));
    } finally {
      setDeactivating(null);
    }
  }

  function ruleLabel(rule: string) {
    switch (rule) {
      case "per_night":
        return t(dict, "packages.rule.perNight");
      case "per_stay":
        return t(dict, "packages.rule.perStay");
      case "per_person_per_night":
        return t(dict, "packages.rule.perPerson");
      default:
        return rule;
    }
  }

  function rhythmLabel(rhythm: string) {
    switch (rhythm) {
      case "every_night":
        return t(dict, "packages.rhythm.every");
      case "arrival_only":
        return t(dict, "packages.rhythm.arrival");
      case "departure_only":
        return t(dict, "packages.rhythm.departure");
      default:
        return rhythm;
    }
  }

  return (
    <>
      <form data-testid="packages-search-form" onSubmit={handleSearch} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 420 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            data-testid="packages-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(dict, "packages.search")}
            className="input"
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>
        <button data-testid="packages-search-submit" type="submit" className="btn sm">
          {t(dict, "profiles.searchBtn")}
        </button>
        {initialSearch && (
          <Link data-testid="packages-clear" href="/configuration/packages" className="btn sm ghost">
            {t(dict, "profiles.clear")}
          </Link>
        )}
      </form>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            {t(dict, "packages.title")} <span className="count">{packages.length}</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {packages.length === 0 ? (
            <div
              data-testid="packages-empty"
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              {t(dict, "packages.empty")}
            </div>
          ) : (
            <table data-testid="packages-table" className="t">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>{t(dict, "packages.colCode")}</th>
                  <th>{t(dict, "packages.colName")}</th>
                  <th className="r" style={{ width: 120 }}>
                    {t(dict, "packages.colAmount")}
                  </th>
                  <th style={{ width: 150 }}>{t(dict, "packages.colRule")}</th>
                  <th style={{ width: 140 }}>{t(dict, "packages.colRhythm")}</th>
                  <th style={{ width: 110 }}>{t(dict, "packages.colStatus")}</th>
                  <th className="r">{t(dict, "packages.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} data-testid="package-row" data-package-id={pkg.id}>
                    <td className="tnum" data-testid="package-code">{pkg.code}</td>
                    <td style={{ fontWeight: 500 }} data-testid="package-name">{pkg.name}</td>
                    <td className="r tnum" data-testid="package-amount">
                      {Number(pkg.amount) === 0
                        ? t(dict, "packages.included")
                        : `${formatCurrency(pkg.amount)} ₽`}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }} data-testid="package-rule">
                      {ruleLabel(pkg.calculationRule)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }} data-testid="package-rhythm">
                      {rhythmLabel(pkg.postingRhythm)}
                    </td>
                    <td>
                      <span data-testid="package-status-badge" className={`badge ${pkg.isActive ? "checked-in" : "cancelled"}`}>
                        <span className="dot" />
                        {pkg.isActive ? t(dict, "packages.active") : t(dict, "packages.inactive")}
                      </span>
                    </td>
                    <td className="r">
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Link
                          data-testid="package-edit"
                          href={`/configuration/packages/${pkg.id}/edit`}
                          className="btn xs ghost"
                        >
                          {t(dict, "packages.edit")}
                        </Link>
                        <button
                          data-testid="package-toggle-active"
                          type="button"
                          onClick={() => handleToggleActive(pkg.id, pkg.isActive)}
                          disabled={deactivating === pkg.id}
                          className="btn xs ghost"
                        >
                          {deactivating === pkg.id
                            ? "…"
                            : pkg.isActive
                              ? t(dict, "packages.deactivate")
                              : t(dict, "packages.activate")}
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
    </>
  );
}
