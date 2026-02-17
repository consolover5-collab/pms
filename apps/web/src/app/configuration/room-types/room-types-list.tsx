"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";


type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  baseRate: string;
  description: string | null;
  sortOrder: number;
};

export function RoomTypesList({ roomTypes }: { roomTypes: RoomType[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this room type?")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/room-types/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete room type");
      }
    } finally {
      setDeleting(null);
    }
  }

  if (roomTypes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No room types configured. Add your first room type to get started.
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
              Max Occ.
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Base Rate
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {roomTypes.map((rt) => (
            <tr key={rt.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-sm">{rt.code}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{rt.name}</div>
                {rt.description && (
                  <div className="text-xs text-gray-500">{rt.description}</div>
                )}
              </td>
              <td className="px-4 py-3">{rt.maxOccupancy}</td>
              <td className="px-4 py-3">
                {formatCurrency(rt.baseRate)}
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <a
                  href={`/configuration/room-types/${rt.id}/edit`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Edit
                </a>
                <button
                  onClick={() => handleDelete(rt.id)}
                  disabled={deleting === rt.id}
                  className="text-red-600 hover:underline text-sm disabled:opacity-50"
                >
                  {deleting === rt.id ? "..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
