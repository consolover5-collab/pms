"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, type UserRole } from "@/lib/use-user";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/locales/en";
import { Icon, type IconName } from "@/components/icon";

interface NavItem {
  href: string;
  labelKey: DictionaryKey;
  icon: IconName;
  visibleTo?: UserRole[];
}

interface NavSection {
  titleKey: DictionaryKey;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: "nav.section.main",
    items: [
      { href: "/", labelKey: "nav.dashboard", icon: "dashboard" },
      { href: "/tape-chart", labelKey: "nav.tapeChart", icon: "calendar" },
      { href: "/bookings", labelKey: "nav.bookings", icon: "bookings" },
      { href: "/configuration/profiles", labelKey: "nav.guests", icon: "users" },
    ],
  },
  {
    titleKey: "nav.section.operations",
    items: [
      { href: "/housekeeping", labelKey: "nav.housekeeping", icon: "broom" },
      {
        href: "/night-audit",
        labelKey: "nav.nightAudit",
        icon: "moon",
        visibleTo: ["admin", "manager", "front_desk"],
      },
      {
        href: "/cashier",
        labelKey: "nav.cashier",
        icon: "cash",
        visibleTo: ["admin", "manager", "front_desk"],
      },
    ],
  },
  {
    titleKey: "nav.section.system",
    items: [
      {
        href: "/configuration",
        labelKey: "nav.settings",
        icon: "settings",
        visibleTo: ["admin", "manager"],
      },
      { href: "/help", labelKey: "nav.help", icon: "help" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useUser();
  const { logout } = useAuth();
  const { dict } = useLocale();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const initial = initials(currentUser.username || "U");

  return (
    <aside className="sidebar">
      <Link href="/" className="logo">
        <span className="mark">P</span>
        <span className="name">
          PMS
          <small>Grand Baltic</small>
        </span>
      </Link>

      {SECTIONS.map((section) => {
        const items = section.items.filter(
          (item) => !item.visibleTo || item.visibleTo.includes(currentUser.role),
        );
        if (items.length === 0) return null;
        return (
          <div key={section.titleKey}>
            <div className="nav-section">{t(dict, section.titleKey)}</div>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
              >
                <Icon name={item.icon} />
                <span className="lbl">{t(dict, item.labelKey)}</span>
              </Link>
            ))}
          </div>
        );
      })}

      <div className="side-foot">
        <button
          type="button"
          onClick={logout}
          className="me"
          style={{ background: "transparent", border: "none", width: "100%", textAlign: "left" }}
        >
          <span className="av">{initial}</span>
          <span className="who">
            <div>{currentUser.username}</div>
            <div className="role">{ROLE_LABELS[currentUser.role] || currentUser.role}</div>
          </span>
          <Icon name="logout" size={14} style={{ marginLeft: "auto", color: "var(--muted)" }} />
        </button>
      </div>
    </aside>
  );
}
