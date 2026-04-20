"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

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

const typeLabels: Record<string, string> = {
  individual: "Guest",
  company: "Company",
  travel_agent: "Agent",
  source: "Source",
  contact: "Contact",
};

const typeColors: Record<string, string> = {
  individual: "bg-blue-100 text-blue-800",
  company: "bg-green-100 text-green-800",
  travel_agent: "bg-purple-100 text-purple-800",
  source: "bg-orange-100 text-orange-800",
  contact: "bg-gray-100 text-gray-800",
};

const tabs = [
  { key: "", label: "All" },
  { key: "individual", label: "Guests" },
  { key: "company", label: "Companies" },
  { key: "travel_agent", label: "Agents" },
  { key: "source", label: "Sources" },
];

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
  const [search, setSearch] = useState(initialSearch);
  const [deactivating, setDeactivating] = useState<string | null>(null);

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
    if (!confirm(`Are you sure you want to ${currentActive ? "deactivate" : "activate"} this profile?`)) return;
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
        alert("Failed to update profile status");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-t ${
              initialType === tab.key
                ? "bg-white border border-b-white -mb-[1px] font-semibold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone..."
          className="border rounded px-3 py-2 flex-1 max-w-sm"
        />
        <button type="submit" className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">
          Search
        </button>
        {initialSearch && (
          <Link href={`/configuration/profiles${initialType ? `?type=${initialType}` : ""}`} className="px-4 py-2 text-blue-600 hover:underline flex items-center">
            Clear
          </Link>
        )}
      </form>

      {profiles.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
          No profiles found.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${typeColors[p.type] || "bg-gray-100 text-gray-800"}`}>
                      {typeLabels[p.type] || p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{p.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{p.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        p.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/configuration/profiles/${p.id}/edit`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleActive(p.id, p.isActive)}
                      disabled={deactivating === p.id}
                      className="text-gray-600 hover:text-black text-sm disabled:opacity-50"
                    >
                      {deactivating === p.id ? "..." : (p.isActive ? "Deactivate" : "Activate")}
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
