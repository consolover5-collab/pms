"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";


type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  gender: string | null;
  language: string | null;
  dateOfBirth: string | null;
  vipStatus: string | null;
  notes: string | null;
};

const documentTypes = [
  { value: "", label: "Not specified" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
];

const genders = [
  { value: "", label: "Not specified" },
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

const languages = [
  { value: "", label: "Not specified" },
  { value: "EN", label: "English" },
  { value: "RU", label: "Russian" },
  { value: "DE", label: "German" },
  { value: "FR", label: "French" },
  { value: "ES", label: "Spanish" },
  { value: "ZH", label: "Chinese" },
  { value: "JA", label: "Japanese" },
];

export function GuestEditForm({ guest }: { guest: Guest }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const body: Record<string, unknown> = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
    };

    const optionalFields = [
      "email", "phone", "documentType", "documentNumber",
      "nationality", "gender", "language", "dateOfBirth", "notes",
    ];
    for (const field of optionalFields) {
      const value = form.get(field);
      body[field] = value && String(value).trim() ? value : null;
    }

    const vipStatus = form.get("vipStatus");
    body.vipStatus = vipStatus && String(vipStatus).trim() ? String(vipStatus).trim() : null;

    try {
      const res = await fetch(`/api/profiles/${guest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error: ${res.status}`);
      }

      router.replace(`/guests/${guest.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">First Name *</label>
          <input name="firstName" type="text" required defaultValue={guest.firstName}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
          <input name="lastName" type="text" required defaultValue={guest.lastName}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input name="email" type="email" defaultValue={guest.email || ""}
            className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input name="phone" type="tel" defaultValue={guest.phone || ""}
            className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Gender</label>
          <select name="gender" defaultValue={guest.gender || ""} className="w-full px-3 py-2 border rounded">
            {genders.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" defaultValue={guest.dateOfBirth || ""}
            className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nationality</label>
          <input name="nationality" type="text" maxLength={2} placeholder="e.g. RU"
            defaultValue={guest.nationality || ""} className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Language</label>
          <select name="language" defaultValue={guest.language || ""} className="w-full px-3 py-2 border rounded">
            {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">VIP Status</label>
          <select name="vipStatus" defaultValue={guest.vipStatus || ""} className="w-full px-3 py-2 border rounded">
            <option value="">None</option>
            <option value="VIP1">VIP 1</option>
            <option value="VIP2">VIP 2</option>
            <option value="VIP3">VIP 3</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Type</label>
          <select name="documentType" defaultValue={guest.documentType || ""} className="w-full px-3 py-2 border rounded">
            {documentTypes.map((dt) => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Number</label>
          <input name="documentNumber" type="text" defaultValue={guest.documentNumber || ""}
            className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea name="notes" rows={3} defaultValue={guest.notes || ""}
          className="w-full px-3 py-2 border rounded" />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <Link href={`/guests/${guest.id}`}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          Cancel
        </Link>
      </div>
    </form>
  );
}
