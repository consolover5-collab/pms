"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", labelRu: "Дашборд" },
  { href: "/bookings", label: "Bookings", labelRu: "Бронирования" },
  { href: "/rooms", label: "Rooms", labelRu: "Номера" },
  { href: "/guests", label: "Guests", labelRu: "Гости" },
  { href: "/night-audit", label: "Night Audit", labelRu: "Ночной аудит" },
  { href: "/configuration", label: "Settings", labelRu: "Настройки" },
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

export function Navbar() {
  const pathname = usePathname();
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
          {navItems.map((item) => (
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
      </div>
    </nav>
  );
}
