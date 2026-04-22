import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import { ProfilesList } from "./profiles-list";

const PAGE_SIZE = 50;

type Profile = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  iataCode: string | null;
  sourceCode: string | null;
};

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { type, q, page } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  params.set("propertyId", "ff1d9135-dfb9-4baa-be46-0e739cd26dad");
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const url = `/api/profiles?${params.toString()}`;
  const result = await apiFetch<{ data: Profile[]; total: number }>(url);
  const profiles = result.data;
  const total = result.total;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function pageUrl(targetPage: number): string {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (q) p.set("q", q);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return `/configuration/profiles${qs ? `?${qs}` : ""}`;
  }

  return (
    <div data-testid="config-profiles-page">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title" data-testid="config-profiles-title">
          {t(dict, "profiles.title")}
        </h1>
        <span className="page-sub" data-testid="config-profiles-subtitle">
          {t(dict, "profiles.subtitle")}
        </span>
        <div className="actions">
          <Link
            href="/configuration/profiles/new?type=individual"
            className="btn sm"
            data-testid="config-profiles-add-individual"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addGuest")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=company"
            className="btn sm"
            data-testid="config-profiles-add-company"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addCompany")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=travel_agent"
            className="btn sm"
            data-testid="config-profiles-add-travel-agent"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addAgent")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=source"
            className="btn sm primary"
            data-testid="config-profiles-add-source"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addSource")}
          </Link>
        </div>
      </div>

      <ProfilesList
        profiles={profiles}
        total={total}
        initialType={type || ""}
        initialSearch={q || ""}
      />

      {totalPages > 1 && (
        <div
          data-testid="config-profiles-pagination"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }} data-testid="config-profiles-showing">
            {t(dict, "profiles.showing", {
              from: String(offset + 1),
              to: String(Math.min(offset + PAGE_SIZE, total)),
              total: String(total),
            })}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {currentPage > 1 ? (
              <Link
                href={pageUrl(currentPage - 1)}
                className="btn xs ghost"
                data-testid="config-profiles-pagination-prev"
              >
                <Icon name="chevLeft" size={12} />
                {t(dict, "profiles.prev")}
              </Link>
            ) : (
              <span
                className="btn xs ghost"
                style={{ opacity: 0.4, pointerEvents: "none" }}
                data-testid="config-profiles-pagination-prev"
              >
                <Icon name="chevLeft" size={12} />
                {t(dict, "profiles.prev")}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {t(dict, "profiles.pageOf", {
                current: String(currentPage),
                total: String(totalPages),
              })}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={pageUrl(currentPage + 1)}
                className="btn xs ghost"
                data-testid="config-profiles-pagination-next"
              >
                {t(dict, "profiles.next")}
                <Icon name="chevRight" size={12} />
              </Link>
            ) : (
              <span
                className="btn xs ghost"
                style={{ opacity: 0.4, pointerEvents: "none" }}
                data-testid="config-profiles-pagination-next"
              >
                {t(dict, "profiles.next")}
                <Icon name="chevRight" size={12} />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
