"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { useLocale } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import { t } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/locales/en";
import { CommandPalette } from "@/components/command-palette";

interface Crumb {
  label: string;
  href?: string;
}

const PATH_TITLES: Record<string, DictionaryKey> = {
  "/": "nav.dashboard",
  "/bookings": "nav.bookings",
  "/rooms": "nav.rooms",
  "/tape-chart": "nav.tapeChart",
  "/housekeeping": "nav.housekeeping",
  "/night-audit": "nav.nightAudit",
  "/cashier": "nav.cashier",
  "/configuration": "nav.settings",
  "/configuration/profiles": "nav.guests",
  "/help": "nav.help",
};

function formatBusinessDate(dateStr: string, localeCode: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(localeCode === "ru" ? "ru-RU" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function Topbar() {
  const pathname = usePathname();
  const { locale, setLocale, dict } = useLocale();
  const { theme, toggle } = useTheme();
  const [businessDateRaw, setBusinessDateRaw] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchBusinessDate() {
      try {
        const propRes = await fetch("/api/properties");
        if (!propRes.ok) return;
        const properties = await propRes.json();
        if (!properties.length) return;
        const bdRes = await fetch(`/api/business-date?propertyId=${properties[0].id}`);
        if (!bdRes.ok) {
          if (!cancelled) setBusinessDateRaw(new Date().toISOString().split("T")[0]);
          return;
        }
        const bd = await bdRes.json();
        if (!cancelled) setBusinessDateRaw(bd.date);
      } catch {
        if (!cancelled) setBusinessDateRaw(new Date().toISOString().split("T")[0]);
      }
    }
    fetchBusinessDate();
    return () => {
      cancelled = true;
    };
  }, []);

  const crumbs: Crumb[] = useMemo(() => {
    const titleKey = PATH_TITLES[pathname];
    const parts: Crumb[] = [{ label: "PMS", href: "/" }];
    if (titleKey) {
      parts.push({ label: t(dict, titleKey) });
    } else if (pathname.startsWith("/bookings/")) {
      parts.push({ label: t(dict, "nav.bookings"), href: "/bookings" });
      parts.push({ label: pathname.split("/").pop() ?? "" });
    } else {
      parts.push({ label: pathname });
    }
    return parts;
  }, [pathname, dict]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPaletteOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const businessDate = businessDateRaw ? formatBusinessDate(businessDateRaw, locale) : "";

  return (
    <>
      <header className="topbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span className="sep">/</span>}
              {c.href && i < crumbs.length - 1 ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span className={i === crumbs.length - 1 ? "cur" : undefined}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <button
          type="button"
          className="searchbox"
          onClick={() => setPaletteOpen(true)}
          aria-label={t(dict, "topbar.commandPalette")}
        >
          <Icon name="search" size={14} />
          <span>{t(dict, "topbar.search")}</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="spacer" />

        {businessDate && (
          <span className="biz-date" title={t(dict, "nav.businessDate")}>
            {businessDate}
          </span>
        )}

        <Link href="/bookings/new" className="btn sm primary" data-testid="topbar-new-booking">
          <Icon name="plus" size={12} />
          <span>{t(dict, "topbar.newBooking")}</span>
        </Link>

        <button
          type="button"
          className="icon-btn"
          title={t(dict, "topbar.notifications")}
          aria-label={t(dict, "topbar.notifications")}
        >
          <Icon name="bell" />
          <span className="badge-dot" />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          title={t(dict, "topbar.theme.toggle")}
          aria-label={t(dict, "topbar.theme.toggle")}
          data-testid="topbar-theme-toggle"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        <div style={{ display: "flex", gap: 2 }} data-testid="topbar-locale-toggle">
          {LOCALES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`chip${locale === code ? " on" : ""}`}
              style={{ cursor: "pointer" }}
              data-testid={`topbar-locale-${code}`}
              aria-pressed={locale === code}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
