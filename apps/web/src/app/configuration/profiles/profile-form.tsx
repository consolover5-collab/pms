"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  gender: string | null;
  language: string | null;
  passportNumber: string | null;
  documentType: string | null;
  vipStatus: string | null;
  shortName: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  address: string | null;
  creditLimit: string | null;
  paymentTermDays: number | null;
  arAccountNumber: string | null;
  iataCode: string | null;
  commissionPercent: string | null;
  sourceCode: string | null;
  channelType: string | null;
  contactPerson: string | null;
  contactTitle: string | null;
};

export function ProfileForm({ profile }: { profile?: Profile }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!profile;
  const type = profile?.type || new URLSearchParams(window.location.search).get("type") || "individual";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};

    if (!isEdit) {
      body.propertyId = "ff1d9135-dfb9-4baa-be46-0e739cd26dad";
      body.type = type;
    }

    for (const [key, val] of form.entries()) {
      if (val === "") continue;
      body[key] = val;
    }

    if (type === "individual" && !body.name && (body.firstName || body.lastName)) {
      body.name = [body.firstName, body.lastName].filter(Boolean).join(" ");
    }

    try {
      const res = await fetch(
        isEdit ? `/api/profiles/${profile.id}` : "/api/profiles",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Server error: ${res.status}`);
        setSaving(false);
        return;
      }

      router.replace("/configuration/profiles");
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  function Input({ label, name, defaultValue, type: inputType = "text", disabled = false }: {
    label: string; name: string; defaultValue?: string | null; type?: string; disabled?: boolean;
  }) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          type={inputType}
          name={name}
          defaultValue={defaultValue || ""}
          disabled={disabled}
          className="w-full px-3 py-2 border rounded disabled:bg-gray-100 disabled:text-gray-400"
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-500 mb-2">
        Profile type: <span className="font-semibold capitalize">{type === "travel_agent" ? "Travel Agent" : type}</span>
      </div>

      {(type === "individual") && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name *" name="firstName" defaultValue={profile?.firstName || ""} />
          <Input label="Last Name *" name="lastName" defaultValue={profile?.lastName || ""} />
        </div>
      )}

      <Input label="Name *" name="name" defaultValue={profile?.name || ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" name="email" defaultValue={profile?.email || ""} />
        <Input label="Phone" name="phone" defaultValue={profile?.phone || ""} />
      </div>

      {type === "individual" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Birth" name="dateOfBirth" defaultValue={profile?.dateOfBirth || ""} type="date" />
            <Input label="Nationality" name="nationality" defaultValue={profile?.nationality || ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Gender" name="gender" defaultValue={profile?.gender || ""} />
            <Input label="Language" name="language" defaultValue={profile?.language || ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Document Type" name="documentType" defaultValue={profile?.documentType || ""} />
            <Input label="Passport Number" name="passportNumber" defaultValue={profile?.passportNumber || ""} />
          </div>
          <Input label="VIP Status" name="vipStatus" defaultValue={profile?.vipStatus || ""} />
        </>
      )}

      {type === "company" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Short Name" name="shortName" defaultValue={profile?.shortName || ""} />
            <Input label="Tax ID" name="taxId" defaultValue={profile?.taxId || ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Registration Number" name="registrationNumber" defaultValue={profile?.registrationNumber || ""} />
            <Input label="AR Account Number" name="arAccountNumber" defaultValue={profile?.arAccountNumber || ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Credit Limit" name="creditLimit" defaultValue={profile?.creditLimit || ""} />
            <Input label="Payment Terms (days)" name="paymentTermDays" defaultValue={profile?.paymentTermDays?.toString() || ""} />
          </div>
          <Input label="Address" name="address" defaultValue={profile?.address || ""} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" name="contactPerson" defaultValue={profile?.contactPerson || ""} />
            <Input label="Contact Title" name="contactTitle" defaultValue={profile?.contactTitle || ""} />
          </div>
        </>
      )}

      {type === "travel_agent" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Input label="IATA Code" name="iataCode" defaultValue={profile?.iataCode || ""} />
            <Input label="Commission %" name="commissionPercent" defaultValue={profile?.commissionPercent || ""} disabled />
          </div>
          <Input label="Address" name="address" defaultValue={profile?.address || ""} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" name="contactPerson" defaultValue={profile?.contactPerson || ""} />
            <Input label="Contact Title" name="contactTitle" defaultValue={profile?.contactTitle || ""} />
          </div>
        </>
      )}

      {type === "source" && (
        <>
          <Input label="Source Code" name="sourceCode" defaultValue={profile?.sourceCode || ""} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel Type</label>
            <select
              name="channelType"
              defaultValue={profile?.channelType || ""}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">—</option>
              <option value="direct">Direct</option>
              <option value="ota">OTA</option>
              <option value="gds">GDS</option>
              <option value="corporate">Corporate</option>
              <option value="walkin">Walk-in</option>
              <option value="other">Other</option>
            </select>
          </div>
        </>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={profile?.notes || ""}
          rows={3}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Profile" : "Create Profile"}
        </button>
        <button
          type="button"
          onClick={() => router.replace("/configuration/profiles")}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
