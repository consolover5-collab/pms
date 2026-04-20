"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

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
        throw new Error(data.error || "Failed to save package");
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
          throw new Error("Failed to save rate plan links");
        }
      }

      router.replace("/configuration/packages");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="bg-white p-6 rounded-lg border space-y-6">
        <h2 className="text-lg font-semibold">Package Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              disabled={isEdit}
              maxLength={20}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              placeholder="e.g. BKFST"
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
              placeholder="e.g. Continental Breakfast"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Transaction Code *</label>
            <select
              value={form.transactionCodeId}
              onChange={(e) => setForm({ ...form, transactionCodeId: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Code...</option>
              {transactionCodes.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.code} - {tc.description || "No description"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Calculation Rule *</label>
            <select
              value={form.calculationRule}
              onChange={(e) => setForm({ ...form, calculationRule: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="per_night">Per Night (Fixed)</option>
              <option value="per_person_per_night">Per Person Per Night</option>
              <option value="per_stay">Per Stay (Once)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Posting Rhythm *</label>
            <select
              value={form.postingRhythm}
              onChange={(e) => setForm({ ...form, postingRhythm: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="every_night">Every Night</option>
              <option value="arrival_only">Arrival Only</option>
              <option value="departure_only">Departure Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount (₽) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="pt-2 border-t">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <span className="font-medium">Active (available for rate plans)</span>
          </label>
        </div>
      </div>

      {isEdit && (
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="text-lg font-semibold">Rate Plans</h2>
          <p className="text-sm text-gray-600 mb-4">Select the rate plans this package is available for.</p>
          
          {ratePlans.length === 0 ? (
            <p className="text-sm text-gray-500">No rate plans available.</p>
          ) : (
            <div className="space-y-3">
              {ratePlans.map((rp) => {
                const link = links.find((l) => l.ratePlanId === rp.id);
                const isLinked = !!link;
                const includedInRate = link?.includedInRate ?? true;

                return (
                  <div key={rp.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={(e) => toggleRatePlanLink(rp.id, includedInRate, e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">{rp.name}</div>
                        <div className="text-sm text-gray-500 font-mono">{rp.code}</div>
                      </div>
                    </label>
                    {isLinked && (
                      <label className="flex items-center gap-2 text-sm ml-4">
                        <input
                          type="checkbox"
                          checked={includedInRate}
                          onChange={(e) => updateIncludedInRate(rp.id, e.target.checked)}
                          className="rounded"
                        />
                        <span>Included in Rate</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Update Package" : "Create Package"}
        </button>
        <Link
          href="/configuration/packages"
          className="px-4 py-2 border rounded hover:bg-gray-50 inline-block"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
