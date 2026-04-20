import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/icon";

type Section = {
  title: string;
  href: string;
  description: string;
  icon: IconName;
};

export default async function ConfigurationPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

  const sections: Section[] = [
    {
      title: t(dict, "config.roomTypes"),
      href: "/configuration/room-types",
      description: t(dict, "config.roomTypesDesc"),
      icon: "bed",
    },
    {
      title: t(dict, "config.ratePlans"),
      href: "/configuration/rate-plans",
      description: t(dict, "config.ratePlansDesc"),
      icon: "cash",
    },
    {
      title: t(dict, "config.packages"),
      href: "/configuration/packages",
      description: t(dict, "config.packagesDesc"),
      icon: "sparkles",
    },
    {
      title: t(dict, "config.profiles"),
      href: "/configuration/profiles",
      description: t(dict, "config.profilesDesc"),
      icon: "users",
    },
    {
      title: t(dict, "config.property"),
      href: "/configuration/property",
      description: t(dict, "config.propertyDesc"),
      icon: "settings",
    },
    {
      title: t(dict, "config.txCodes"),
      href: "/configuration/transaction-codes",
      description: t(dict, "config.txCodesDesc"),
      icon: "key",
    },
    {
      title: t(dict, "guaranteeCodes.title"),
      href: "/configuration/guarantee-codes",
      description: t(dict, "config.guaranteeCodesDesc"),
      icon: "flag",
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t(dict, "config.title")}</h1>
        <span className="page-sub">{t(dict, "config.subtitle")}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="card"
            style={{
              textDecoration: "none",
              color: "inherit",
              transition: "transform .12s ease, border-color .12s ease",
            }}
          >
            <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={section.icon} size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {section.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                  {section.description}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
