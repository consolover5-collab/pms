"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";


type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isActive: boolean;
};

export function RatePlansList({ ratePlans }: { ratePlans: RatePlan[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this rate plan?")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/rate-plans/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete rate plan");
      }
    } finally {
      setDeleting(null);
    }
  }

  if (ratePlans.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No rate plans configured. Add your first rate plan to get started.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Code
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Name
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Base Rate
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ratePlans.map((rp) => (
            <tr key={rp.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-sm">{rp.code}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{rp.name}</div>
                {rp.description && (
                  <div className="text-xs text-gray-500">{rp.description}</div>
                )}
              </td>
              <td className="px-4 py-3">
                {rp.baseRate ? parseFloat(rp.baseRate).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    rp.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {rp.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <a
                  href={`/configuration/rate-plans/${rp.id}/edit`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Edit
                </a>
                <button
                  onClick={() => handleDelete(rp.id)}
                  disabled={deleting === rp.id}
                  className="text-red-600 hover:underline text-sm disabled:opacity-50"
                >
                  {deleting === rp.id ? "..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
