"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function getDefaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function getDefaultDateTo(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateFrom, setDateFrom] = useState(
    searchParams.get("dateFrom") || getDefaultDateFrom()
  );
  const [dateTo, setDateTo] = useState(
    searchParams.get("dateTo") || getDefaultDateTo()
  );

  function applyFilter() {
    const params = new URLSearchParams();
    // Preserve existing params
    const status = searchParams.get("status");
    const view = searchParams.get("view");
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/bookings?${params.toString()}`);
  }

  function clearFilter() {
    const params = new URLSearchParams();
    const status = searchParams.get("status");
    const view = searchParams.get("view");
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    setDateFrom("");
    setDateTo("");
    router.push(`/bookings?${params.toString()}`);
  }

  function applyPreset(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    const params = new URLSearchParams();
    const status = searchParams.get("status");
    const view = searchParams.get("view");
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    params.set("dateFrom", from);
    params.set("dateTo", to);
    router.push(`/bookings?${params.toString()}`);
  }

  function setToday() {
    const today = new Date().toISOString().split("T")[0];
    applyPreset(today, today);
  }

  function setThisWeek() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    applyPreset(monday.toISOString().split("T")[0], sunday.toISOString().split("T")[0]);
  }

  function setThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    applyPreset(first.toISOString().split("T")[0], last.toISOString().split("T")[0]);
  }

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
      <span className="text-gray-500">Даты:</span>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="px-2 py-1 border rounded text-sm"
      />
      <span className="text-gray-400">—</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        min={dateFrom || undefined}
        className="px-2 py-1 border rounded text-sm"
      />
      <button
        onClick={applyFilter}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        Применить
      </button>
      {/* Quick presets */}
      <div className="flex gap-1 ml-2">
        <button onClick={setToday} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
          Сегодня
        </button>
        <button onClick={setThisWeek} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
          Неделя
        </button>
        <button onClick={setThisMonth} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
          Месяц
        </button>
      </div>
      {hasFilter && (
        <button
          onClick={clearFilter}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}
