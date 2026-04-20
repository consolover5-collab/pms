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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(dict, "txCodes.form.labelCode")}</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={20}
            className="w-full border rounded px-3 py-2 font-mono"
            placeholder="ROOM"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(dict, "txCodes.form.labelSortOrder")}</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t(dict, "txCodes.form.labelDescription")}</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          className="w-full border rounded px-3 py-2"
          placeholder={t(dict, "txCodes.form.placeholderDesc")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(dict, "txCodes.form.labelType")}</label>
          <select
            value={form.transactionType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="charge">{t(dict, "txCodes.form.typeCharge")} (charge)</option>
            <option value="payment">{t(dict, "txCodes.form.typePayment")} (payment)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(dict, "txCodes.form.labelGroup")}</label>
          <select
            value={form.groupCode}
            onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            {groupCodes.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isManualPostAllowed}
            onChange={(e) => setForm({ ...form, isManualPostAllowed: e.target.checked })}
            className="rounded"
          />
          {t(dict, "txCodes.form.allowManual")}
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            {t(dict, "txCodes.form.isActive")}
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t(dict, "txCodes.form.saving") : isEdit ? t(dict, "txCodes.form.update") : t(dict, "txCodes.form.create")}
        </button>
        <Link
          href="/configuration/transaction-codes"
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          {t(dict, "txCodes.form.cancel")}
        </Link>
      </div>
    </form>
  );
}
