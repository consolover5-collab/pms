"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

interface PaletteAction {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: IconName;
  href?: string;
  onRun?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { dict } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);

  const actions: PaletteAction[] = useMemo(
    () => [
      { id: "goto-dashboard",  group: t(dict, "nav.section.main"),       label: t(dict, "nav.dashboard"),  icon: "dashboard", href: "/" },
      { id: "goto-tape",       group: t(dict, "nav.section.main"),       label: t(dict, "nav.tapeChart"),  icon: "calendar",  href: "/tape-chart" },
      { id: "goto-bookings",   group: t(dict, "nav.section.main"),       label: t(dict, "nav.bookings"),   icon: "bookings",  href: "/bookings" },
      { id: "goto-guests",     group: t(dict, "nav.section.main"),       label: t(dict, "nav.guests"),     icon: "users",     href: "/configuration/profiles" },
      { id: "goto-hk",         group: t(dict, "nav.section.operations"), label: t(dict, "nav.housekeeping"), icon: "broom",   href: "/housekeeping" },
      { id: "goto-audit",      group: t(dict, "nav.section.operations"), label: t(dict, "nav.nightAudit"), icon: "moon",      href: "/night-audit" },
      { id: "goto-cashier",    group: t(dict, "nav.section.operations"), label: t(dict, "nav.cashier"),    icon: "cash",      href: "/cashier" },
      { id: "goto-settings",   group: t(dict, "nav.section.system"),     label: t(dict, "nav.settings"),   icon: "settings",  href: "/configuration" },
      { id: "goto-help",       group: t(dict, "nav.section.system"),     label: t(dict, "nav.help"),       icon: "help",      href: "/help" },
      { id: "new-booking",     group: "Actions",                           label: t(dict, "nav.newBooking"), icon: "plus",      href: "/bookings/new" },
    ],
    [dict],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q) ||
        a.sub?.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    setSel(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const run = (a: PaletteAction) => {
    onClose();
    if (a.onRun) a.onRun();
    if (a.href) router.push(a.href);
  };

  const grouped = filtered.reduce<Record<string, PaletteAction[]>>((acc, a) => {
    (acc[a.group] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div
      className="palette-overlay on"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="in">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(dict, "topbar.search")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const a = filtered[sel];
                if (a) run(a);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="list">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="group">{group}</div>
              {items.map((a) => {
                const idx = filtered.indexOf(a);
                return (
                  <div
                    key={a.id}
                    className={`item${idx === sel ? " sel" : ""}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => run(a)}
                  >
                    <Icon name={a.icon} />
                    <span>{a.label}</span>
                    {a.sub && <span className="sub">{a.sub}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              —
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
