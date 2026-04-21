"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import Link from "next/link";

const CHARGE_GROUP_CODES = [
  "room_charge", "tax", "minibar", "restaurant",
  "spa", "laundry", "phone", "parking", "misc",
];

const PAYMENT_GROUP_CODES = ["payment"];

type TransactionCodeData = {
  id?: string;
  code: string;
  description: string;
  groupCode: string;
  transactionType: string;
  isManualPostAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function TransactionCodeForm({
  code,
  propertyId,
  isEdit = false,
}: {
  code?: TransactionCodeData;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TransactionCodeData>({
    code: code?.code || "",
    description: code?.description || "",
    groupCode: code?.groupCode || "room_charge",
    transactionType: code?.transactionType || "charge",
    isManualPostAllowed: code?.isManualPostAllowed ?? true,
    sortOrder: code?.sortOrder ?? 0,
    isActive: code?.isActive ?? true,
  });

  const groupCodes = form.transactionType === "payment" ? PAYMENT_GROUP_CODES : CHARGE_GROUP_CODES;

  function handleTypeChange(type: string) {
    const defaultGroup = type === "payment" ? "payment" : "room_charge";
    setForm({ ...form, transactionType: type, groupCode: defaultGroup });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/transaction-codes/${code?.id}`
        : `/api/transaction-codes`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, propertyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t(dict, "txCodes.form.saveError"));
      }
      router.replace("/configuration/transaction-codes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, "txCodes.form.saveError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      data-testid="tx-code-form"
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 640,
      }}
    >
      {error && (
        <div
          data-testid="tx-code-error-banner"
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "txCodes.form.labelCode")}</label>
          <input
            data-testid="tx-code-field-code"
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={20}
            className="input"
            style={{ fontFamily: "var(--font-mono)" }}
            placeholder="ROOM"
          />
        </div>
        <div className="field">
          <label className="lab">{t(dict, "txCodes.form.labelSortOrder")}</label>
          <input
            data-testid="tx-code-field-sort-order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            min={0}
            className="input tnum"
          />
        </div>
      </div>

      <div className="field">
        <label className="lab">{t(dict, "txCodes.form.labelDescription")}</label>
        <input
          data-testid="tx-code-field-description"
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          className="input"
          placeholder={t(dict, "txCodes.form.placeholderDesc")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lab">{t(dict, "txCodes.form.labelType")}</label>
          <select
            data-testid="tx-code-field-type"
            value={form.transactionType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="select"
          >
            <option value="charge">{t(dict, "txCodes.form.typeCharge")}</option>
            <option value="payment">{t(dict, "txCodes.form.typePayment")}</option>
          </select>
        </div>
        <div className="field">
          <label className="lab">{t(dict, "txCodes.form.labelGroup")}</label>
          <select
            data-testid="tx-code-field-group"
            value={form.groupCode}
            onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
            className="select"
          >
            {groupCodes.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <input
            data-testid="tx-code-field-manual-post"
            type="checkbox"
            checked={form.isManualPostAllowed}
            onChange={(e) => setForm({ ...form, isManualPostAllowed: e.target.checked })}
          />
          {t(dict, "txCodes.form.allowManual")}
        </label>
        {isEdit && (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <input
              data-testid="tx-code-field-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t(dict, "txCodes.form.isActive")}
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button data-testid="tx-code-submit" type="submit" disabled={loading} className="btn primary">
          {loading
            ? t(dict, "txCodes.form.saving")
            : isEdit
              ? t(dict, "txCodes.form.update")
              : t(dict, "txCodes.form.create")}
        </button>
        <Link href="/configuration/transaction-codes" className="btn ghost">
          {t(dict, "txCodes.form.cancel")}
        </Link>
      </div>
    </form>
  );
}
