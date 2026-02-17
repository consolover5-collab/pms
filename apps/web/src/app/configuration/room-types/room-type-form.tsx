"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";


type RoomType = {
  id?: string;
  code: string;
  name: string;
  maxOccupancy: number;
  baseRate: string;
  description: string;
  sortOrder: number;
};

export function RoomTypeForm({
  roomType,
  propertyId,
  isEdit = false,
}: {
  roomType?: RoomType;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RoomType>({
    code: roomType?.code || "",
    name: roomType?.name || "",
    maxOccupancy: roomType?.maxOccupancy || 2,
    baseRate: roomType?.baseRate || "",
    description: roomType?.description || "",
    sortOrder: roomType?.sortOrder || 0,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/room-types/${roomType?.id}`
        : `/api/room-types`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save room type");
      }

      router.replace("/configuration/room-types");
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
            maxLength={10}
            className="w-full border rounded px-3 py-2"
            placeholder="STD"
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
            placeholder="Standard Room"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Max Occupancy *</label>
          <input
            type="number"
            value={form.maxOccupancy}
            onChange={(e) => setForm({ ...form, maxOccupancy: parseInt(e.target.value) || 2 })}
            required
            min={1}
            max={10}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Base Rate *</label>
          <input
            type="number"
            value={form.baseRate}
            onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
            required
            min={0}
            step={0.01}
            className="w-full border rounded px-3 py-2"
            placeholder="4500.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full border rounded px-3 py-2"
          placeholder="Room type description..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Sort Order</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
          min={0}
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Lower numbers appear first in lists
        </p>
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
          href="/configuration/room-types"
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
