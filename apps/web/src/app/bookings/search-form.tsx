"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

export function BookingSearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const { dict } = useLocale();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    // Preserve existing params
    const status = searchParams.get("status");
    const view = searchParams.get("view");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (query.trim()) params.set("q", query.trim());
    router.push(`/bookings?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t(dict, "bookings.search.placeholder")}
        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        {t(dict, "bookings.search.submit")}
      </button>
    </form>
  );
}
