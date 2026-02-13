"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";


export function GuestForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
    };

    // Optional fields — only include if non-empty
    for (const key of ["email", "phone", "nationality", "gender", "language", "dateOfBirth", "documentType", "documentNumber", "notes"]) {
      const val = form.get(key);
      if (val && String(val).trim()) body[key] = String(val).trim();
    }
    const vip = form.get("vipStatus");
    if (vip && String(vip).trim()) body.vipStatus = Number(vip);

    try {
      const res = await fetch(`/api/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const guest = await res.json();
      router.push(`/guests/${guest.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">First Name *</label>
          <input name="firstName" required className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
          <input name="lastName" required className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input name="email" type="email" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input name="phone" type="tel" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Gender</label>
          <select name="gender" className="w-full px-3 py-2 border rounded">
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nationality</label>
          <input name="nationality" maxLength={3} placeholder="RU" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Language</label>
          <input name="language" maxLength={10} placeholder="ru" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">VIP Status</label>
          <select name="vipStatus" className="w-full px-3 py-2 border rounded">
            <option value="">None</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Type</label>
          <input name="documentType" placeholder="Passport" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Number</label>
          <input name="documentNumber" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea name="notes" rows={3} className="w-full px-3 py-2 border rounded" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Create Guest"}
      </button>
    </form>
  );
}
