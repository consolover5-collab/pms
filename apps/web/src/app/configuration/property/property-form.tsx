"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";


type Property = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfRooms: number | null;
  numberOfFloors: number | null;
  taxRate: string | null;
};

export function PropertyForm({ property }: { property: Property }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: property.name,
    code: property.code,
    address: property.address || "",
    city: property.city || "",
    country: property.country || "",
    timezone: property.timezone,
    currency: property.currency,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    numberOfRooms: property.numberOfRooms || 0,
    numberOfFloors: property.numberOfFloors || 0,
    taxRate: property.taxRate || "0",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const url = `/api/properties/${property.id}`;

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError({
          error: data.error || `Server error: ${res.status}`,
          code: data.code,
          status: res.status,
          url,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError({
          error: `Connection error: Cannot reach the API server. Check that it is running.`,
          code: "NETWORK_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      } else {
        setError({
          error: err instanceof Error ? err.message : "Save failed",
          code: "UNKNOWN_ERROR",
          url,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {error && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}
      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded">
          Settings saved successfully
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">General Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Property Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                maxLength={10}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                maxLength={2}
                className="w-full border rounded px-3 py-2"
                placeholder="RU"
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Operations</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check-in Time</label>
              <input
                type="time"
                value={form.checkInTime}
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check-out Time</label>
              <input
                type="time"
                value={form.checkOutTime}
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="UTC">UTC</option>
                <option value="Europe/Moscow">Europe/Moscow</option>
                <option value="Europe/Kaliningrad">Europe/Kaliningrad</option>
                <option value="Asia/Yekaterinburg">Asia/Yekaterinburg</option>
                <option value="Asia/Novosibirsk">Asia/Novosibirsk</option>
                <option value="Asia/Vladivostok">Asia/Vladivostok</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
            <input
              type="number"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              min={0}
              max={100}
              step={0.01}
              className="w-full border rounded px-3 py-2"
              placeholder="20"
            />
            <p className="text-xs text-gray-500 mt-1">
              НДС/VAT — ставка налога, применяемая к начислениям за проживание
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Capacity</h2>
        <p className="text-xs text-gray-500 mb-3">
          Reference information only. To manage actual rooms, use Rooms → Room Management.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Number of Rooms</label>
            <input
              type="number"
              value={form.numberOfRooms}
              onChange={(e) => setForm({ ...form, numberOfRooms: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Number of Floors</label>
            <input
              type="number"
              value={form.numberOfFloors}
              onChange={(e) => setForm({ ...form, numberOfFloors: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </section>

      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
