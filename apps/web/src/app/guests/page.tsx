import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { SearchForm } from "./search-form";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  gender: string | null;
  vipStatus: string | null;
};

type GuestsResponse = {
  data: Guest[];
  total: number;
};

const PAGE_SIZE = 50;

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { q, page } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  params.set("propertyId", "ff1d9135-dfb9-4baa-be46-0e739cd26dad");
  params.set("type", "individual");
  if (q) params.set("q", q);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  let result: GuestsResponse;
  try {
    result = await apiFetch<GuestsResponse>(`/api/profiles?${params.toString()}`);
  } catch (err) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t(dict, "guests.title")}</h1>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 600, color: "var(--cancelled-fg)" }}>
              {t(dict, "guests.failedToLoad")}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {err instanceof Error ? err.message : ""}
            </div>
            <div>
              <Link href="/guests" className="btn xs">
                {t(dict, "guests.retry")}
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const { data: guests, total } = result;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function vipBadgeClass(level: string) {
    switch (level) {
      case "VIP":
        return "no-show";
      case "GOLD":
        return "confirmed";
      case "SILVER":
        return "checked-out";
      default:
        return "cancelled";
    }
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/guests${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title" data-testid="guests-title">{t(dict, "guests.title")}</h1>
        <span className="page-sub">{t(dict, "guests.subtitle")}</span>
        <div className="actions">
          <Link href="/guests/new" className="btn sm primary" data-testid="guests-new-button">
            <Icon name="plus" size={12} />
            {t(dict, "guests.newGuest")}
          </Link>
        </div>
      </div>

      <SearchForm />

      {q && (
        <div style={{ fontSize: 12, color: "var(--muted)" }} data-testid="guests-search-summary">
          {t(dict, "guests.searchResults", { q, total: String(total) })}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            {t(dict, "guests.title")}{" "}
            <span className="count" data-testid="guests-total-count">
              {total}
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {guests.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13,
              }}
              data-testid="guests-empty"
            >
              {q ? t(dict, "guests.notFound") : t(dict, "guests.empty")}
            </div>
          ) : (
            <table className="t">
              <thead>
                <tr>
                  <th>{t(dict, "guests.colName")}</th>
                  <th>{t(dict, "guests.colEmail")}</th>
                  <th>{t(dict, "guests.colPhone")}</th>
                  <th>{t(dict, "guests.colNationality")}</th>
                  <th>{t(dict, "guests.colVip")}</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id} data-testid="guests-row" data-guest-id={guest.id}>
                    <td>
                      <Link
                        href={`/guests/${guest.id}`}
                        style={{ color: "var(--fg)", fontWeight: 500 }}
                        data-testid="guests-row-name"
                      >
                        {guest.lastName || guest.name}
                        {guest.firstName ? `, ${guest.firstName}` : ""}
                      </Link>
                    </td>
                    <td style={{ color: "var(--muted)" }} data-testid="guests-row-email">
                      {guest.email || "—"}
                    </td>
                    <td
                      style={{ color: "var(--muted)" }}
                      className="tnum"
                      data-testid="guests-row-phone"
                    >
                      {guest.phone || "—"}
                    </td>
                    <td>{guest.nationality || "—"}</td>
                    <td>
                      {guest.vipStatus ? (
                        <span className={`badge ${vipBadgeClass(guest.vipStatus)}`}>
                          <span className="dot" />
                          {guest.vipStatus}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {t(dict, "guests.showing", {
              from: String(offset + 1),
              to: String(Math.min(offset + PAGE_SIZE, total)),
              total: String(total),
            })}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {currentPage > 1 ? (
              <Link href={pageUrl(currentPage - 1)} className="btn xs ghost">
                <Icon name="chevLeft" size={12} />
                {t(dict, "guests.prev")}
              </Link>
            ) : (
              <span className="btn xs ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
                <Icon name="chevLeft" size={12} />
                {t(dict, "guests.prev")}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {t(dict, "guests.pageOf", {
                current: String(currentPage),
                total: String(totalPages),
              })}
            </span>
            {currentPage < totalPages ? (
              <Link href={pageUrl(currentPage + 1)} className="btn xs ghost">
                {t(dict, "guests.next")}
                <Icon name="chevRight" size={12} />
              </Link>
            ) : (
              <span className="btn xs ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
                {t(dict, "guests.next")}
                <Icon name="chevRight" size={12} />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
