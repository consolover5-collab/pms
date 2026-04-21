"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useLocale();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      router.push(`/guests?${params.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    if (query === (searchParams.get("q") || "")) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      navigate(query);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, navigate, searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate(query);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 480 }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--muted)",
            pointerEvents: "none",
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(dict, "profiles.search")}
          className="input"
          style={{ paddingLeft: 32, width: "100%" }}
          data-testid="guests-search-input"
        />
      </div>
      <button type="submit" className="btn sm" data-testid="guests-search-submit">
        {t(dict, "profiles.searchBtn")}
      </button>
    </form>
  );
}
