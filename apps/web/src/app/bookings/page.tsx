import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { DateFilter } from "./date-filter";
import { BookingSearchForm } from "./search-form";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import type { DictionaryKey } from "@/lib/i18n/locales/en";

type Booking = {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  adults: number;
  children: number;
  totalAmount: string | null;
  actualCheckOut: string | null;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string; roomNumber: string } | null;
  roomType: { id: string; name: string; code: string };
};

type Property = { id: string; name: string };
type BookingsResponse = { data: Booking[]; total: number };

const PAGE_SIZE = 50;

type StatusClass = "confirmed" | "checked-in" | "checked-out" | "cancelled" | "no-show";

function statusClass(st: string): StatusClass {
  switch (st) {
    case "checked_in":
      return "checked-in";
    case "checked_out":
      return "checked-out";
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "no-show";
    default:
      return "confirmed";
  }
}

function statusLabelKey(st: string): DictionaryKey {
  switch (st) {
    case "checked_in":
      return "bookings.status.checkedIn";
    case "checked_out":
      return "bookings.status.checkedOut";
    case "cancelled":
      return "bookings.status.cancelled";
    case "no_show":
      return "bookings.status.noShow";
    default:
      return "bookings.status.confirmed";
  }
}

function initials(first: string, last: string): string {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

const ALL_STATUSES: { key: string; labelKey: DictionaryKey }[] = [
  { key: "confirmed", labelKey: "bookings.status.confirmed" },
  { key: "checked_in", labelKey: "bookings.status.checkedIn" },
  { key: "checked_out", labelKey: "bookings.status.checkedOut" },
  { key: "cancelled", labelKey: "bookings.status.cancelled" },
  { key: "no_show", labelKey: "bookings.status.noShow" },
];

function ErrorState({ message, dict }: { message: string; dict: ReturnType<typeof getDict> }) {
  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ color: "var(--cancelled)", margin: 0, fontSize: 15 }}>
          {t(dict, "dashboard.failedToLoad")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{message}</p>
        <Link href="/bookings" className="btn sm" style={{ marginTop: 8, display: "inline-flex" }}>
          {t(dict, "dashboard.retry")}
        </Link>
      </div>
    </div>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    view?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { status, view, dateFrom, dateTo, q, page } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const defaultFrom = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();
  const defaultTo = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();

  let properties: Property[];
  try {
    properties = await apiFetch<Property[]>("/api/properties");
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : ""} dict={dict} />;
  }
  const property = properties[0];
  if (!property) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ margin: 0 }}>{t(dict, "dashboard.noProperty")}</h2>
        </div>
      </div>
    );
  }

  const queryParams = new URLSearchParams({ propertyId: property.id });
  if (view) {
    queryParams.set("view", view);
  } else {
    if (status) queryParams.set("status", status);
    const effectiveFrom = dateFrom || defaultFrom;
    const effectiveTo = dateTo || defaultTo;
    if (!q) {
      queryParams.set("checkInDate", effectiveFrom);
      queryParams.set("checkOutDate", effectiveTo);
    }
  }
  if (q) queryParams.set("search", q);
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(offset));

  let result: BookingsResponse;
  let bizDateRes: { date: string };
  try {
    [result, bizDateRes] = await Promise.all([
      apiFetch<BookingsResponse>(`/api/bookings?${queryParams.toString()}`),
      apiFetch<{ date: string }>(`/api/business-date?propertyId=${property.id}`),
    ]);
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : ""} dict={dict} />;
  }

  const { data: bookings, total } = result;

  const viewTitle = (() => {
    if (view === "arrivals") return t(dict, "bookings.arrivalsToday");
    if (view === "departures") return t(dict, "bookings.departuresToday");
    if (view === "inhouse") return t(dict, "bookings.inHouse");
    return t(dict, "bookings.title");
  })();

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/bookings${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{viewTitle}</h1>
        {q && (
          <span className="page-sub">
            {t(dict, "bookings.resultsFor", { q, total })}
          </span>
        )}
        <div className="actions">
          <Link href="/bookings/new" className="btn sm primary">
            <Icon name="plus" size={12} />
            <span>{t(dict, "bookings.newBooking")}</span>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <BookingSearchForm />

          <div className="tabs-bar" style={{ marginBottom: 0 }}>
            <Link
              href="/bookings"
              className={`tb${!view ? " on" : ""}`}
            >
              {t(dict, "bookings.all")}
            </Link>
            <Link
              href="/bookings?view=arrivals"
              className={`tb${view === "arrivals" ? " on" : ""}`}
            >
              {t(dict, "bookings.arrivalsToday")}
            </Link>
            <Link
              href="/bookings?view=departures"
              className={`tb${view === "departures" ? " on" : ""}`}
            >
              {t(dict, "bookings.departuresToday")}
            </Link>
            <Link
              href="/bookings?view=inhouse"
              className={`tb${view === "inhouse" ? " on" : ""}`}
            >
              {t(dict, "bookings.inHouse")}
            </Link>
          </div>

          {!view && (
            <div className="filterbar">
              <Link
                href="/bookings"
                className={`fld${!status ? " on" : ""}`}
              >
                <span className="key">{t(dict, "common.status")}:</span>
                {t(dict, "bookings.all")}
              </Link>
              {ALL_STATUSES.map((s) => (
                <Link
                  key={s.key}
                  href={`/bookings?status=${s.key}`}
                  className={`fld${status === s.key ? " on" : ""}`}
                >
                  {t(dict, s.labelKey)}
                </Link>
              ))}
            </div>
          )}

          {!view && <DateFilter />}
        </div>
      </div>

      <div className="card">
        <div className="card-body flush" style={{ overflow: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>{t(dict, "bookings.col.conf")}</th>
                <th>{t(dict, "common.guest")}</th>
                <th>{t(dict, "common.room")}</th>
                <th>{t(dict, "bookings.col.checkIn")}</th>
                <th>{t(dict, "bookings.col.checkOut")}</th>
                <th>{t(dict, "common.status")}</th>
                <th className="r">{t(dict, "common.total")}</th>
                {(view === "arrivals" || view === "departures") && (
                  <th className="r">{t(dict, "bookings.col.action")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const stCls = statusClass(b.status);
                const stKey = statusLabelKey(b.status);
                const isTodayCheckIn = b.checkInDate === bizDateRes.date;
                const isTodayCheckOut = b.checkOutDate === bizDateRes.date;
                let badgeCls: StatusClass = stCls;
                let badgeLabel = t(dict, stKey);
                if (b.status === "confirmed" && isTodayCheckIn) {
                  badgeCls = "no-show";
                  badgeLabel = t(dict, "bookings.dueIn");
                } else if (b.status === "checked_in" && isTodayCheckOut) {
                  badgeCls = "no-show";
                  badgeLabel = t(dict, "bookings.dueOut");
                }

                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/bookings/${b.id}`} className="conf">
                        {b.confirmationNumber}
                      </Link>
                    </td>
                    <td>
                      <Link className="guest" href={`/bookings/${b.id}`}>
                        <span className="av">{initials(b.guest.firstName, b.guest.lastName)}</span>
                        <span>
                          <span className="nm">
                            {b.guest.lastName} {b.guest.firstName}
                          </span>
                          <div className="sub">
                            {b.adults} · {b.roomType.name}
                          </div>
                        </span>
                      </Link>
                    </td>
                    <td className="tnum">
                      {b.room ? b.room.roomNumber : "—"}{" "}
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>· {b.roomType.code}</span>
                    </td>
                    <td className="tnum">{b.checkInDate}</td>
                    <td className="tnum">{b.checkOutDate}</td>
                    <td>
                      <span className={`badge ${badgeCls}`}>
                        <span className="dot" />
                        {badgeLabel}
                      </span>
                    </td>
                    <td className="r tnum">
                      {b.totalAmount ? `${formatCurrency(b.totalAmount)} ₽` : "—"}
                    </td>
                    {view === "arrivals" && (
                      <td className="r">
                        {b.status === "confirmed" ? (
                          <Link href={`/bookings/${b.id}`} className="btn xs primary">
                            <Icon name="key" size={11} />
                            <span>{t(dict, "bookings.action.checkIn")}</span>
                          </Link>
                        ) : (
                          <Link href={`/bookings/${b.id}`} className="btn xs ghost">
                            <Icon name="more" size={11} />
                          </Link>
                        )}
                      </td>
                    )}
                    {view === "departures" && (
                      <td className="r">
                        {b.status === "checked_in" ? (
                          <Link href={`/bookings/${b.id}`} className="btn xs primary">
                            <Icon name="logout" size={11} />
                            <span>{t(dict, "bookings.action.checkOut")}</span>
                          </Link>
                        ) : (
                          <Link href={`/bookings/${b.id}`} className="btn xs ghost">
                            <Icon name="more" size={11} />
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={view === "arrivals" || view === "departures" ? 8 : 7}>
                    <div className="empty">{t(dict, "bookings.empty")}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="card-foot">
            <span>
              {t(dict, "bookings.showing", {
                from: offset + 1,
                to: Math.min(offset + PAGE_SIZE, total),
                total,
              })}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {currentPage > 1 ? (
                <Link href={pageUrl(currentPage - 1)} className="btn xs">
                  <Icon name="chevLeft" size={11} />
                  <span>{t(dict, "bookings.prev")}</span>
                </Link>
              ) : (
                <span className="btn xs" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                  <Icon name="chevLeft" size={11} />
                  <span>{t(dict, "bookings.prev")}</span>
                </span>
              )}
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
                {t(dict, "bookings.pageOf", { current: currentPage, total: totalPages })}
              </span>
              {currentPage < totalPages ? (
                <Link href={pageUrl(currentPage + 1)} className="btn xs">
                  <span>{t(dict, "bookings.next")}</span>
                  <Icon name="chevRight" size={11} />
                </Link>
              ) : (
                <span className="btn xs" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                  <span>{t(dict, "bookings.next")}</span>
                  <Icon name="chevRight" size={11} />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
