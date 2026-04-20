"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RatePlan = {
  id: string;
  code: string;
  name: string;
};

type PackageRatePlanLink = {
  ratePlanId: string;
  includedInRate: boolean;
};

type Package = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  transactionCodeId: string;
  calculationRule: string;
  amount: string;
  postingRhythm: string;
  isActive: boolean;
};

export function PackageForm({
  pkg,
  propertyId,
  transactionCodes,
  ratePlans,
  linkedRatePlans = [],
  isEdit = false,
}: {
  pkg?: Package;
  propertyId: string;
  transactionCodes: { id: string; code: string; description: string | null }[];
  ratePlans: RatePlan[];
  linkedRatePlans?: PackageRatePlanLink[];
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Package>({
    code: pkg?.code || "",
    name: pkg?.name || "",
    description: pkg?.description || "",
    transactionCodeId: pkg?.transactionCodeId || "",
    calculationRule: pkg?.calculationRule || "per_night",
    amount: pkg?.amount || "0",
    postingRhythm: pkg?.postingRhythm || "every_night",
    isActive: pkg?.isActive ?? true,
  });

  const [links, setLinks] = useState<PackageRatePlanLink[]>(linkedRatePlans);

  function toggleRatePlanLink(ratePlanId: string, includedInRate: boolean, checked: boolean) {
    if (checked) {
      setLinks([...links, { ratePlanId, includedInRate }]);
    } else {
      setLinks(links.filter((l) => l.ratePlanId !== ratePlanId));
    }
  }

  function updateIncludedInRate(ratePlanId: string, includedInRate: boolean) {
    setLinks(links.map((l) => (l.ratePlanId === ratePlanId ? { ...l, includedInRate } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let packageId = pkg?.id;
      const url = isEdit ? `/api/packages/${packageId}` : `/api/packages`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
          description: form.description || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t(dict, "packages.saveFailed"));
      }

      if (!isEdit) {
        const data = await res.json();
        packageId = data.id;
      }

      if (isEdit && packageId) {
        const linksRes = await fetch(`/api/packages/${packageId}/rate-plans`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ratePlans: links }),
        });
        if (!linksRes.ok) {
          throw new Error(t(dict, "packages.saveLinksFailed"));
        }
      }

      router.replace("/configuration/packages");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, "packages.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  const required = (
    <span style={{ color: "var(--cancelled)", marginLeft: 2 }}>*</span>
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            background: "var(--cancelled-bg)",
            color: "var(--cancelled-fg)",
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--fg)",
          marginBottom: -4,
        }}
      >
        {t(dict, "packages.section.details")}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.code")}
            {required}
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            disabled={isEdit}
            maxLength={20}
            className="input"
            placeholder={t(dict, "packages.ph.code")}
          />
        </div>
        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.name")}
            {required}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="input"
            placeholder={t(dict, "packages.ph.name")}
          />
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "packages.fld.description")}</label>
        <textarea
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="input"
          style={{ resize: "vertical", minHeight: 60 }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.transactionCode")}
            {required}
          </label>
          <select
            value={form.transactionCodeId}
            onChange={(e) => setForm({ ...form, transactionCodeId: e.target.value })}
            required
            className="select"
          >
            <option value="">{t(dict, "packages.ph.transactionCode")}</option>
            {transactionCodes.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.code} — {tc.description || t(dict, "packages.ph.noTcDescription")}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.calculationRule")}
            {required}
          </label>
          <select
            value={form.calculationRule}
            onChange={(e) => setForm({ ...form, calculationRule: e.target.value })}
            required
            className="select"
          >
            <option value="per_night">{t(dict, "packages.rule.perNight")}</option>
            <option value="per_person_per_night">
              {t(dict, "packages.rule.perPerson")}
            </option>
            <option value="per_stay">{t(dict, "packages.rule.perStay")}</option>
          </select>
        </div>

        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.postingRhythm")}
            {required}
          </label>
          <select
            value={form.postingRhythm}
            onChange={(e) => setForm({ ...form, postingRhythm: e.target.value })}
            required
            className="select"
          >
            <option value="every_night">{t(dict, "packages.rhythm.every")}</option>
            <option value="arrival_only">{t(dict, "packages.rhythm.arrival")}</option>
            <option value="departure_only">
              {t(dict, "packages.rhythm.departure")}
            </option>
          </select>
        </div>

        <div className="field">
          <label className="lab">
            {t(dict, "packages.fld.amount")}
            {required}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="input tnum"
          />
        </div>
      </div>

      <label
        style={{
          display: "inline-flex",
          gap: 8,
          fontSize: 13,
          alignItems: "center",
          cursor: "pointer",
          borderTop: "1px solid var(--border)",
          marginTop: 4,
          paddingTop: 10,
        }}
      >
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        <span style={{ fontWeight: 500 }}>{t(dict, "packages.fld.isActive")}</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {t(dict, "packages.fld.isActiveHint")}
        </span>
      </label>

      {isEdit && (
        <>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fg)",
              marginTop: 8,
              marginBottom: -4,
            }}
          >
            {t(dict, "packages.section.ratePlans")}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            {t(dict, "packages.section.ratePlansDesc")}
          </p>

          {ratePlans.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted-2)", margin: 0 }}>
              {t(dict, "packages.section.ratePlansEmpty")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ratePlans.map((rp) => {
                const link = links.find((l) => l.ratePlanId === rp.id);
                const isLinked = !!link;
                const includedInRate = link?.includedInRate ?? true;

                return (
                  <div
                    key={rp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      background: isLinked ? "var(--accent-soft)" : "var(--surface)",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flex: 1,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={(e) =>
                          toggleRatePlanLink(rp.id, includedInRate, e.target.checked)
                        }
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{rp.name}</div>
                        <div
                          className="tnum"
                          style={{
                            fontSize: 11.5,
                            color: "var(--muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {rp.code}
                        </div>
                      </div>
                    </label>
                    {isLinked && (
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={includedInRate}
                          onChange={(e) => updateIncludedInRate(rp.id, e.target.checked)}
                        />
                        {t(dict, "packages.fld.includedInRate")}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="submit" disabled={loading} className="btn primary">
          {loading
            ? t(dict, "common.saving")
            : isEdit
              ? t(dict, "packages.updateBtn")
              : t(dict, "packages.createBtn")}
        </button>
        <Link href="/configuration/packages" className="btn ghost">
          {t(dict, "common.cancel")}
        </Link>
      </div>
    </form>
  );
}
