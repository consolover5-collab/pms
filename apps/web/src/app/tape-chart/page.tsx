"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  roomTypeName: string;
  roomTypeCode: string;
};

type TapeBooking = {
  id: string;
  confirmationNumber: string;
  guestName: string;
  roomId: string | null;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

type TapeChartData = {
  rooms: Room[];
  dates: string[];
  bookings: TapeBooking[];
};

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-200 hover:bg-blue-300 border-blue-400",
  checked_in: "bg-green-200 hover:bg-green-300 border-green-400",
  checked_out: "bg-gray-200 hover:bg-gray-300 border-gray-400",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { weekday: "short" });
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export default function TapeChartPage() {
  const [from, setFrom] = useState(() => todayStr());
  const [to, setTo] = useState(() => addDays(todayStr(), 14));
  const [data, setData] = useState<TapeChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Get property (single-property MVP)
        const propRes = await fetch("/api/properties");
        if (!propRes.ok) throw new Error("Failed to load properties");
        const properties = await propRes.json();
        if (!properties.length) throw new Error("No property configured");
        const propertyId = properties[0].id;

        const res = await fetch(
          `/api/tape-chart?propertyId=${propertyId}&from=${from}&to=${to}`,
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `API error: ${res.status}`);
        }
        setData(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    if (from && to && from < to) {
      fetchData();
    }
  }, [from, to]);

  // Build lookup: roomId -> date -> booking
  const cellMap = new Map<string, Map<string, TapeBooking>>();
  if (data) {
    for (const b of data.bookings) {
      if (!b.roomId) continue;
      if (!cellMap.has(b.roomId)) cellMap.set(b.roomId, new Map());
      const roomMap = cellMap.get(b.roomId)!;
      // Fill each date the booking occupies
      let current = b.checkInDate;
      while (current < b.checkOutDate) {
        roomMap.set(current, b);
        current = addDays(current, 1);
      }
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tape Chart</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">
            From:
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-1 border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            To:
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-1 border rounded px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {Object.entries(statusColors).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded border ${cls}`} />
            <span>{statusLabels[status]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border bg-white border-gray-300" />
          <span>Available</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {loading && <div className="text-gray-500">Loading...</div>}

      {!loading && data && (
        <div className="overflow-auto border rounded">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 z-10 border-r border-b px-2 py-1 text-left min-w-[120px]">
                  Room
                </th>
                {data.dates.map((date) => (
                  <th
                    key={date}
                    className="border-b border-r px-1 py-1 text-center min-w-[60px]"
                  >
                    <div>{formatDayOfWeek(date)}</div>
                    <div className="font-normal">{formatDateShort(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((room) => {
                const roomBookings = cellMap.get(room.id);
                return (
                  <tr key={room.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white z-10 border-r border-b px-2 py-1 font-mono whitespace-nowrap">
                      <span className="font-bold">{room.roomNumber}</span>
                      <span className="text-gray-400 ml-1">
                        {room.roomTypeCode}
                      </span>
                    </td>
                    {data.dates.map((date) => {
                      const booking = roomBookings?.get(date);
                      if (booking) {
                        // Check if this is the first cell of the booking in this row
                        const isStart = date === booking.checkInDate;
                        const colorCls =
                          statusColors[booking.status] ||
                          "bg-gray-100 border-gray-300";
                        return (
                          <td
                            key={date}
                            className={`border-b border-r p-0`}
                          >
                            <Link
                              href={`/bookings/${booking.id}`}
                              className={`block w-full h-full px-1 py-1 ${colorCls} border-y cursor-pointer`}
                              title={`${booking.guestName} (${booking.confirmationNumber}) — ${statusLabels[booking.status] || booking.status}`}
                            >
                              {isStart && (
                                <span className="truncate block text-[10px] leading-tight">
                                  {booking.guestName.split(" ")[1] || booking.guestName}
                                </span>
                              )}
                            </Link>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={date}
                          className="border-b border-r bg-white"
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && data.rooms.length === 0 && (
        <div className="text-gray-500 text-center py-8">No rooms found</div>
      )}

      {/* Unassigned bookings */}
      {!loading && data && (() => {
        const unassigned = data.bookings.filter((b) => !b.roomId);
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">
              Unassigned Bookings ({unassigned.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={`text-xs px-2 py-1 rounded border ${statusColors[b.status] || "bg-gray-100 border-gray-300"}`}
                >
                  {b.confirmationNumber} — {b.guestName} ({b.checkInDate} → {b.checkOutDate})
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
