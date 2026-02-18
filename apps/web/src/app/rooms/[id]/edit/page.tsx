"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type RoomType = { id: string; name: string; code: string };

export default function EditRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [propertyId, setPropertyId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState<string>("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [propRes, roomRes] = await Promise.all([
        fetch("/api/properties").then((r) => r.json()),
        fetch(`/api/rooms/${id}`).then((r) => r.json()),
      ]);

      const pid = propRes[0]?.id;
      setPropertyId(pid);
      setRoomNumber(roomRes.roomNumber ?? "");
      setFloor(roomRes.floor != null ? String(roomRes.floor) : "");
      setRoomTypeId(roomRes.roomType?.id ?? "");

      if (pid) {
        const rt = await fetch(`/api/room-types?propertyId=${pid}`).then((r) => r.json());
        setRoomTypes(Array.isArray(rt) ? rt : []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      roomNumber,
      roomTypeId,
      floor: floor !== "" ? parseInt(floor, 10) : null,
    };

    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
        return;
      }

      router.replace(`/rooms/${id}`);
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-8"><p className="text-gray-500">Загрузка…</p></main>;
  }

  return (
    <main className="p-8 max-w-lg">
      <Link href={`/rooms/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Назад к комнате
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Редактировать комнату</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 uppercase mb-1">Номер комнаты *</label>
          <input
            type="text"
            required
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase mb-1">Этаж</label>
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            min={1}
            max={99}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase mb-1">Тип номера *</label>
          <select
            required
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">— выберите тип —</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} ({rt.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <Link
            href={`/rooms/${id}`}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Отмена
          </Link>
        </div>
      </form>
    </main>
  );
}
