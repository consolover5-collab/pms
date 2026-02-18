"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser, type UserRole } from "@/lib/use-user";

interface NavItem {
  href: string;
  label: string;
  labelRu: string;
  /** If set, only these roles can see the link */
  visibleTo?: UserRole[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", labelRu: "Дашборд" },
  { href: "/bookings", label: "Bookings", labelRu: "Бронирования" },
  { href: "/rooms", label: "Rooms", labelRu: "Номера" },
  { href: "/tape-chart", label: "Tape Chart", labelRu: "Шахматка" },
  { href: "/guests", label: "Guests", labelRu: "Гости" },
  {
    href: "/night-audit",
    label: "Night Audit",
    labelRu: "Ночной аудит",
    visibleTo: ["admin", "manager", "front_desk"],
  },
  {
    href: "/configuration",
    label: "Settings",
    labelRu: "Настройки",
    visibleTo: ["admin", "manager"],
  },
  { href: "/help", label: "Справка", labelRu: "Справка" },
];

function formatBusinessDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  front_desk: "Ресепшен",
  housekeeping: "Горничная",
};

export function Navbar() {
  const pathname = usePathname();
  const currentUser = useUser();
  const [businessDate, setBusinessDate] = useState<string>("");

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
          setBusinessDate(
            formatBusinessDate(new Date().toISOString().split("T")[0]),
          );
          return;
        }
        const bd = await bdRes.json();
        setBusinessDate(formatBusinessDate(bd.date));
      } catch {
        setBusinessDate(
          formatBusinessDate(new Date().toISOString().split("T")[0]),
        );
      }
    }
    fetchBusinessDate();
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

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
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {businessDate && (
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded">
            <span className="text-gray-400 text-xs uppercase">Бизнес-дата</span>
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
        </div>
      </div>
    </nav>
  );
}
