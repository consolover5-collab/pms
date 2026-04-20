import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Property = { id: string; name: string };

type DashboardBooking = {
  id: string;
  confirmationNumber: string;
  checkOutDate: string;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string | null; roomNumber: string | null };
  roomType: { id: string; name: string; code: string };
};

type DashboardArrival = DashboardBooking & {
  checkInDate: string;
  status: string;
  adults: number;
  children: number;
};

type DashboardSummary = {
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  outOfOrderRooms: number;
  outOfServiceRooms: number;
  dirtyRooms: number;
  cleanRooms: number;
  pickupRooms: number;
  inspectedRooms: number;
  arrivalsCount: number;
  departuresCount: number;
  inHouseCount: number;
  currentBusinessDate: string;
};

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(first: string, last: string): string {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

type StatusClass = "confirmed" | "checked-in" | "checked-out" | "cancelled" | "no-show";

function statusClass(st: string): StatusClass {
  switch (st) {
    case "checked_in":
    case "checked-in":
      return "checked-in";
    case "checked_out":
    case "checked-out":
      return "checked-out";
    case "cancelled":
      return "cancelled";
    case "no_show":
    case "no-show":
      return "no-show";
    default:
      return "confirmed";
  }
}

function ErrorState({
  message,
  dict,
}: {
  message: string;
  dict: ReturnType<typeof getDict>;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ color: "var(--cancelled)", margin: 0, fontSize: 15 }}>
          {t(dict, "dashboard.failedToLoad")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{message}</p>
        <Link href="/" className="btn sm" style={{ marginTop: 8, display: "inline-flex" }}>
          {t(dict, "dashboard.retry")}
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const dict = getDict(locale);

  let properties: Property[];
  try {
    properties = await apiFetch<Property[]>("/api/properties");
  } catch (err) {
    const msg = err instanceof Error ? err.message : t(dict, "dashboard.couldNotConnect");
    return <ErrorState message={msg} dict={dict} />;
  }

  const property = properties[0];
  if (!property) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ margin: 0 }}>{t(dict, "dashboard.noProperty")}</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            {t(dict, "dashboard.runSeed")}
          </p>
        </div>
      </div>
    );
  }

  const qs = `propertyId=${property.id}`;

  let arrivals: DashboardArrival[];
  let departures: DashboardBooking[];
  let summary: DashboardSummary;
  try {
    [arrivals, departures, summary] = await Promise.all([
      apiFetch<DashboardArrival[]>(`/api/dashboard/arrivals?${qs}`),
      apiFetch<DashboardBooking[]>(`/api/dashboard/departures?${qs}`),
      apiFetch<DashboardSummary>(`/api/dashboard/summary?${qs}`),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : t(dict, "dashboard.couldNotConnect");
    return <ErrorState message={msg} dict={dict} />;
  }

  const totalRooms = summary.totalRooms;
  const occ = summary.occupiedRooms;
  const ooo = summary.outOfOrderRooms;
  const oos = summary.outOfServiceRooms;
  const vac = Math.max(totalRooms - occ - ooo - oos, 0);
  const occPct = totalRooms ? Math.round((occ / totalRooms) * 100) : 0;
  const vacPct = totalRooms ? Math.round((vac / totalRooms) * 100) : 0;
  const oooPct = totalRooms ? Math.round((ooo / totalRooms) * 100) : 0;
  const oosPct = totalRooms ? Math.max(100 - occPct - vacPct - oooPct, 0) : 0;

  const hkTotal = Math.max(
    summary.dirtyRooms + summary.cleanRooms + summary.pickupRooms + summary.inspectedRooms + ooo + oos,
    1,
  );

  const sources: { label: string }[] = [];
  void sources;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          {t(dict, "dashboard.greeting", { name: property.name })}
        </h1>
        <span className="page-sub">{formatDate(summary.currentBusinessDate, locale)}</span>
        <div className="actions">
          <Link href="/" className="btn sm">
            <Icon name="refresh" size={12} />
            <span>{t(dict, "dashboard.refresh")}</span>
          </Link>
          <Link href="/night-audit" className="btn sm primary">
            <Icon name="moon" size={12} />
            <span>{t(dict, "dashboard.runAudit")}</span>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid g4">
        <div className="kpi accent">
          <div className="lab">
            <Icon name="bed" size={13} />
            <span>{t(dict, "dashboard.kpi.occupancy")}</span>
          </div>
          <div className="val">
            {occPct}
            <span className="of">%</span>
          </div>
          <div className="foot">
            <span>{t(dict, "dashboard.kpi.rooms", { sold: occ, total: totalRooms })}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="lab">
            <Icon name="sparkles" size={13} />
            <span>{t(dict, "dashboard.kpi.adr")}</span>
          </div>
          <div className="val">—</div>
          <div className="foot">
            <span>{t(dict, "dashboard.kpi.adrSub")}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="lab">
            <Icon name="star" size={13} />
            <span>{t(dict, "dashboard.kpi.revpar")}</span>
          </div>
          <div className="val">—</div>
          <div className="foot">
            <span>{t(dict, "dashboard.kpi.revparSub")}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="lab">
            <Icon name="users" size={13} />
            <span>{t(dict, "dashboard.kpi.inHouse")}</span>
          </div>
          <div className="val">{summary.inHouseCount}</div>
          <div className="foot">
            <span>
              {t(dict, "dashboard.kpi.inHouseSub", {
                arrivals: summary.arrivalsCount,
                departures: summary.departuresCount,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory + Housekeeping */}
      <div className="grid g4">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-head">
            <div className="card-title">{t(dict, "dashboard.inventory.title")}</div>
          </div>
          <div className="card-body" style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div
              className="donut"
              style={
                {
                  "--occ": occPct,
                  "--vac": vacPct,
                  "--ooo": oooPct,
                  "--oos": oosPct,
                } as React.CSSProperties
              }
            >
              <div className="mid">
                {occPct}%
                <small>occupancy</small>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="leg">
                <span className="lab" style={{ color: "var(--occ-occupied)" }}>
                  <span className="sw" />
                  {t(dict, "dashboard.occupied")}
                </span>
                <strong>
                  {occ} / {totalRooms}
                </strong>
              </div>
              <div className="leg">
                <span className="lab" style={{ color: "var(--muted-2)" }}>
                  <span className="sw" />
                  {t(dict, "dashboard.vacant")}
                </span>
                <strong>{vac}</strong>
              </div>
              <div className="leg">
                <span className="lab" style={{ color: "var(--hk-ooo)" }}>
                  <span className="sw" />
                  {t(dict, "dashboard.inventory.ooo")}
                </span>
                <strong>{ooo}</strong>
              </div>
              <div className="leg">
                <span className="lab" style={{ color: "var(--hk-oos)" }}>
                  <span className="sw" />
                  {t(dict, "dashboard.inventory.oos")}
                </span>
                <strong>{oos}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-head">
            <div className="card-title">{t(dict, "dashboard.hk.title")}</div>
            <Link className="btn sm ghost" href="/housekeeping">
              <span>{t(dict, "dashboard.hk.openBoard")}</span>
              <Icon name="chevRight" size={12} />
            </Link>
          </div>
          <div className="card-body">
            <div className="stackbar" style={{ marginBottom: 12 }}>
              <div
                className="seg"
                style={{
                  width: `${(summary.dirtyRooms / hkTotal) * 100}%`,
                  background: "var(--hk-dirty)",
                }}
              />
              <div
                className="seg"
                style={{
                  width: `${(summary.pickupRooms / hkTotal) * 100}%`,
                  background: "var(--hk-pickup)",
                }}
              />
              <div
                className="seg"
                style={{
                  width: `${(summary.cleanRooms / hkTotal) * 100}%`,
                  background: "var(--hk-clean)",
                }}
              />
              <div
                className="seg"
                style={{
                  width: `${(summary.inspectedRooms / hkTotal) * 100}%`,
                  background: "var(--hk-inspected)",
                }}
              />
              <div
                className="seg"
                style={{
                  width: `${(ooo / hkTotal) * 100}%`,
                  background: "var(--hk-ooo)",
                }}
              />
              <div
                className="seg"
                style={{
                  width: `${(oos / hkTotal) * 100}%`,
                  background: "var(--hk-oos)",
                }}
              />
            </div>
            <div className="grid g3" style={{ gap: 10 }}>
              <HkStat cls="hk-dirty" n={summary.dirtyRooms} lab={t(dict, "dashboard.dirty")} />
              <HkStat cls="hk-pickup" n={summary.pickupRooms} lab={t(dict, "dashboard.hk.pickup")} />
              <HkStat cls="hk-clean" n={summary.cleanRooms} lab={t(dict, "dashboard.clean")} />
              <HkStat cls="hk-inspected" n={summary.inspectedRooms} lab={t(dict, "dashboard.inspected")} />
              <HkStat cls="hk-ooo" n={ooo} lab={t(dict, "dashboard.hk.ooo")} />
              <HkStat cls="hk-oos" n={oos} lab={t(dict, "dashboard.hk.oos")} />
            </div>
          </div>
        </div>
      </div>

      {/* Arrivals + Departures */}
      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              {t(dict, "dashboard.arrivals.title")}{" "}
              <span className="count">· {arrivals.length}</span>
            </div>
          </div>
          <div className="card-body flush" style={{ maxHeight: 360, overflow: "auto" }}>
            {arrivals.length === 0 ? (
              <div className="empty">{t(dict, "dashboard.noArrivals")}</div>
            ) : (
              <table className="t">
                <thead>
                  <tr>
                    <th>{t(dict, "dashboard.arrivals.guest")}</th>
                    <th>{t(dict, "dashboard.arrivals.roomCol")}</th>
                    <th>{t(dict, "dashboard.arrivals.nights")}</th>
                    <th>{t(dict, "dashboard.arrivals.status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {arrivals.map((a) => {
                    const nights =
                      Math.max(
                        Math.round(
                          (new Date(a.checkOutDate).getTime() -
                            new Date(a.checkInDate).getTime()) /
                            86_400_000,
                        ),
                        1,
                      ) || 1;
                    const stCls = statusClass(a.status);
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link className="guest" href={`/bookings/${a.id}`}>
                            <span className="av">
                              {initials(a.guest.firstName, a.guest.lastName)}
                            </span>
                            <span>
                              <span className="nm">
                                {a.guest.firstName} {a.guest.lastName}
                              </span>
                              <div className="sub">
                                <span className="conf">{a.confirmationNumber}</span>
                              </div>
                            </span>
                          </Link>
                        </td>
                        <td className="tnum">
                          {a.room.roomNumber ?? "—"}
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>
                            {" "}· {a.roomType.code}
                          </span>
                        </td>
                        <td className="tnum">{nights}</td>
                        <td>
                          <span className={`badge ${stCls}`}>
                            <span className="dot" />
                            {stCls === "checked-in"
                              ? t(dict, "dashboard.status.checkedIn")
                              : stCls === "no-show"
                                ? t(dict, "dashboard.status.noShow")
                                : t(dict, "dashboard.status.pending")}
                          </span>
                        </td>
                        <td className="r">
                          {stCls === "confirmed" && (
                            <Link href={`/bookings/${a.id}`} className="btn xs primary">
                              <Icon name="key" size={11} />
                              <span>{t(dict, "dashboard.arrivals.checkIn")}</span>
                            </Link>
                          )}
                          {stCls !== "confirmed" && (
                            <Link href={`/bookings/${a.id}`} className="btn xs ghost">
                              <Icon name="more" size={11} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              {t(dict, "dashboard.departures.title")}{" "}
              <span className="count">· {departures.length}</span>
            </div>
          </div>
          <div className="card-body flush" style={{ maxHeight: 360, overflow: "auto" }}>
            {departures.length === 0 ? (
              <div className="empty">{t(dict, "dashboard.noDepartures")}</div>
            ) : (
              <table className="t">
                <thead>
                  <tr>
                    <th>{t(dict, "dashboard.arrivals.guest")}</th>
                    <th>{t(dict, "dashboard.arrivals.roomCol")}</th>
                    <th>{t(dict, "dashboard.departures.etd")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {departures.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link className="guest" href={`/bookings/${d.id}`}>
                          <span className="av">
                            {initials(d.guest.firstName, d.guest.lastName)}
                          </span>
                          <span>
                            <span className="nm">
                              {d.guest.firstName} {d.guest.lastName}
                            </span>
                            <div className="sub">
                              <span className="conf">{d.confirmationNumber}</span>
                            </div>
                          </span>
                        </Link>
                      </td>
                      <td className="tnum">
                        {d.room.roomNumber ?? "—"}
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>
                          {" "}· {d.roomType.code}
                        </span>
                      </td>
                      <td className="tnum">
                        {new Date(d.checkOutDate + "T00:00:00").toLocaleDateString(
                          locale === "ru" ? "ru-RU" : "en-US",
                          { day: "numeric", month: "short" },
                        )}
                      </td>
                      <td className="r">
                        <Link href={`/bookings/${d.id}`} className="btn xs primary">
                          <Icon name="logout" size={11} />
                          <span>{t(dict, "dashboard.departures.checkOut")}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HkStat({ cls, n, lab }: { cls: string; n: number; lab: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <span className={`badge ${cls}`} style={{ minWidth: 34, justifyContent: "center" }}>
        {n}
      </span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{lab}</span>
    </div>
  );
}
