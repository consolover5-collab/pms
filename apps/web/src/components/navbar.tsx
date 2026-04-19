"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser, type UserRole } from "@/lib/use-user";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { LOCALES } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/locales/en";
import { t } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: DictionaryKey;
  /** If set, only these roles can see the link */
  visibleTo?: UserRole[];
}

const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard" },
  { href: "/bookings", labelKey: "nav.bookings" },
  { href: "/rooms", labelKey: "nav.rooms" },
  { href: "/tape-chart", labelKey: "nav.tapeChart" },
  { href: "/configuration/profiles", labelKey: "nav.guests" },
  { href: "/housekeeping", labelKey: "nav.housekeeping" },
  {
    href: "/night-audit",
    labelKey: "nav.nightAudit",
    visibleTo: ["admin", "manager", "front_desk"],
  },
  {
    href: "/configuration",
    labelKey: "nav.settings",
    visibleTo: ["admin", "manager"],
  },
  { href: "/help", labelKey: "nav.help" },
];

function formatBusinessDate(dateStr: string, localeCode: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(localeCode === "ru" ? "ru-RU" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
};

export function Navbar() {
  const pathname = usePathname();
  const currentUser = useUser();
  const { logout } = useAuth();
  const { locale, setLocale, dict } = useLocale();
  const [businessDateRaw, setBusinessDateRaw] = useState<string>("");

  useEffect(() => {
    async function fetchBusinessDate() {
      try {
        const propRes = await fetch("/api/properties");
        if (!propRes.ok) return;
        const properties = await propRes.json();
        if (!properties.length) return;

        const bdRes = await fetch(
          `/api/business-date?propertyId=${properties[0].id}`,
        );
        if (!bdRes.ok) {
          // Fallback to system date
          setBusinessDateRaw(new Date().toISOString().split("T")[0]);
          return;
        }
        const bd = await bdRes.json();
        setBusinessDateRaw(bd.date);
      } catch {
        setBusinessDateRaw(new Date().toISOString().split("T")[0]);
      }
    }
    fetchBusinessDate();
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const businessDate = businessDateRaw ? formatBusinessDate(businessDateRaw, locale) : "";

  return (
    <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-tight">
          PMS
        </Link>
        <div className="flex gap-1">
          {navItems
            .filter(
              (item) =>
                !item.visibleTo ||
                item.visibleTo.includes(currentUser.role),
            )
            .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t(dict, item.labelKey)}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {businessDate && (
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded">
            <span className="text-gray-400 text-xs uppercase">{t(dict, "nav.businessDate")}</span>
            <span className="text-white font-medium">{businessDate}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-gray-300">
            {currentUser.username}{" "}
            <span className="text-gray-500 text-xs">
              ({ROLE_LABELS[currentUser.role] || currentUser.role})
            </span>
          </span>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-xs underline"
          >
            {t(dict, "nav.logout")}
          </button>
        </div>
        
        {/* Language Switcher */}
        <div className="flex gap-1 border-l border-gray-700 pl-4 ml-2">
          {LOCALES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                locale === code
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
