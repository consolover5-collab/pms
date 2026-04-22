"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Profile = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  iataCode: string | null;
  sourceCode: string | null;
};

const typeBadgeClass: Record<string, string> = {
  individual: "checked-in",
  company: "confirmed",
  travel_agent: "checked-out",
  source: "no-show",
  contact: "cancelled",
};

export function ProfilesList({
  profiles,
  initialType,
  initialSearch,
}: {
  profiles: Profile[];
  initialType: string;
  initialSearch: string;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [search, setSearch] = useState(initialSearch);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const tabs = [
    { key: "", label: t(dict, "profiles.tabAll") },
    { key: "individual", label: t(dict, "profiles.tabGuests") },
    { key: "company", label: t(dict, "profiles.tabCompanies") },
    { key: "travel_agent", label: t(dict, "profiles.tabAgents") },
    { key: "source", label: t(dict, "profiles.tabSources") },
  ];

  const typeLabels: Record<string, string> = {
    individual: t(dict, "profiles.typeIndividual"),
    company: t(dict, "profiles.typeCompany"),
    travel_agent: t(dict, "profiles.typeAgent"),
    source: t(dict, "profiles.typeSource"),
    contact: t(dict, "profiles.typeContact"),
  };

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (initialType) params.set("type", initialType);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    router.push(`/configuration/profiles${qs ? `?${qs}` : ""}`);
  }

  function switchTab(type: string) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    router.push(`/configuration/profiles${qs ? `?${qs}` : ""}`);
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const action = currentActive
      ? t(dict, "profiles.deactivate").toLowerCase()
      : t(dict, "profiles.activate").toLowerCase();
    if (!confirm(t(dict, "profiles.confirmToggle", { action }))) return;
    setDeactivating(id);
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert(t(dict, "profiles.updateFailed"));
      }
    } catch {
      alert(t(dict, "profiles.networkError"));
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <>
      <div className="ptabs" data-testid="config-profiles-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`pt ${initialType === tab.key ? "on" : ""}`}
            data-testid={`config-profiles-tab-${tab.key || "all"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(dict, "profiles.search")}
            className="input"
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>
        <button type="submit" className="btn sm">
          {t(dict, "profiles.searchBtn")}
        </button>
        {initialSearch && (
          <Link
            href={`/configuration/profiles${initialType ? `?type=${initialType}` : ""}`}
            className="btn sm ghost"
          >
            {t(dict, "profiles.clear")}
          </Link>
        )}
      </form>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            {t(dict, "profiles.title")}{" "}
            <span className="count" data-testid="config-profiles-count">
              {profiles.length}
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {profiles.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13,
              }}
              data-testid="config-profiles-empty"
            >
              {t(dict, "profiles.empty")}
            </div>
          ) : (
            <table className="t" data-testid="config-profiles-table">
              <thead>
                <tr>
                  <th>{t(dict, "profiles.colName")}</th>
                  <th>{t(dict, "profiles.colType")}</th>
                  <th>{t(dict, "profiles.colEmail")}</th>
                  <th>{t(dict, "profiles.colPhone")}</th>
                  <th>{t(dict, "profiles.colStatus")}</th>
                  <th className="r">{t(dict, "profiles.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} data-testid="config-profiles-row" data-profile-id={p.id} data-profile-type={p.type}>
                    <td>
                      <Link
                        href={`/configuration/profiles/${p.id}`}
                        style={{ color: "var(--fg)", fontWeight: 500 }}
                        data-testid="config-profiles-row-name"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${typeBadgeClass[p.type] || ""}`}>
                        <span className="dot" />
                        {typeLabels[p.type] || p.type}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{p.email || "—"}</td>
                    <td style={{ color: "var(--muted)" }} className="tnum">
                      {p.phone || "—"}
                    </td>
                    <td>
                      <span className={`badge ${p.isActive ? "checked-in" : "cancelled"}`}>
                        <span className="dot" />
                        {p.isActive ? t(dict, "profiles.active") : t(dict, "profiles.inactive")}
                      </span>
                    </td>
                    <td className="r">
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Link
                          href={`/configuration/profiles/${p.id}/edit`}
                          className="btn xs ghost"
                        >
                          {t(dict, "profiles.edit")}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p.id, p.isActive)}
                          disabled={deactivating === p.id}
                          className="btn xs ghost"
                        >
                          {deactivating === p.id
                            ? t(dict, "profiles.activating")
                            : p.isActive
                              ? t(dict, "profiles.deactivate")
                              : t(dict, "profiles.activate")}
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
