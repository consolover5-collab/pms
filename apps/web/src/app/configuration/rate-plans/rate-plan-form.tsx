"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RatePlan = {
  id?: string;
  code: string;
  name: string;
  description: string;
  baseRate: string;
  isDefault: boolean;
  isActive: boolean;
};

export function RatePlanForm({
  ratePlan,
  propertyId,
  isEdit = false,
}: {
  ratePlan?: RatePlan;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RatePlan>({
    code: ratePlan?.code || "",
    name: ratePlan?.name || "",
    description: ratePlan?.description || "",
    baseRate: ratePlan?.baseRate || "",
    isDefault: ratePlan?.isDefault ?? false,
    isActive: ratePlan?.isActive ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/rate-plans/${ratePlan?.id}`
        : `/api/rate-plans`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
          baseRate: form.baseRate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rate plan");
      }

      router.replace("/configuration/rate-plans");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Code *</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={20}
            className="w-full border rounded px-3 py-2"
            placeholder="RACK"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full border rounded px-3 py-2"
            placeholder="Rack Rate"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Base Rate</label>
        <input
          type="number"
          value={form.baseRate}
          onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
          min={0}
          step={0.01}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional base rate amount"
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave empty if rate varies by room type
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full border rounded px-3 py-2"
          placeholder="Rate plan description..."
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            className="rounded"
          />
          <span className="font-medium">Base Rate</span>
          <span className="text-gray-500">{t(dict, "ratePlan.defaultHint")}</span>        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="isActive">Active (available for new reservations)</label>
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Update" : "Create"}
        </button>
        <a
          href="/configuration/rate-plans"
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
