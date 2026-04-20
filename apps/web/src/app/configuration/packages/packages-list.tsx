"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type Package = {
  id: string;
  code: string;
  name: string;
  amount: string;
  calculationRule: string;
  postingRhythm: string;
  isActive: boolean;
};

export function PackagesList({ packages, initialSearch }: { packages: Package[]; initialSearch: string }) {
  const router = useRouter();
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
    if (!confirm(`Are you sure you want to ${currentActive ? "deactivate" : "activate"} this package?`)) return;

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
        alert("Failed to update package status");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setDeactivating(null);
    }
  }

  function getCalculationRuleBadge(rule: string) {
    switch (rule) {
      case "per_night":
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">Per Night</span>;
      case "per_stay":
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Per Stay</span>;
      case "per_person_per_night":
        return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Per Person/Night</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">{rule}</span>;
    }
  }

  function getPostingRhythmLabel(rhythm: string) {
    switch (rhythm) {
      case "every_night": return "Every Night";
      case "arrival_only": return "Arrival Only";
      case "departure_only": return "Departure Only";
      default: return rhythm;
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="border rounded px-3 py-2 flex-1 max-w-sm"
        />
        <button type="submit" className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">
          Search
        </button>
        {initialSearch && (
          <Link href="/configuration/packages" className="px-4 py-2 text-blue-600 hover:underline flex items-center">
            Clear
          </Link>
        )}
      </form>

      {packages.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
          No packages found.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rule</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rhythm</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{pkg.code}</td>
                  <td className="px-4 py-3 font-medium">{pkg.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {Number(pkg.amount) === 0 ? "Included" : formatCurrency(pkg.amount) + " ₽"}
                  </td>
                  <td className="px-4 py-3">{getCalculationRuleBadge(pkg.calculationRule)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getPostingRhythmLabel(pkg.postingRhythm)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        pkg.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {pkg.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/configuration/packages/${pkg.id}/edit`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleActive(pkg.id, pkg.isActive)}
                      disabled={deactivating === pkg.id}
                      className="text-gray-600 hover:text-black text-sm disabled:opacity-50"
                    >
                      {deactivating === pkg.id ? "..." : (pkg.isActive ? "Deactivate" : "Activate")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
