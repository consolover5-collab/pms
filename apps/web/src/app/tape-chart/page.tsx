"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icon";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  roomTypeName: string;
  roomTypeCode: string;
  housekeepingStatus?: string;
};

type TapeBooking = {
  id: string;
  confirmationNumber: string;
  guestName: string;
  roomId: string | null;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

type TapeChartData = {
  rooms: Room[];
  dates: string[];
  bookings: TapeBooking[];
};

const DAY_W = 90;
const ROOM_W = 180;
const ROW_H = 30;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function parseDay(dateStr: string): { day: string; mon: string; dow: string; isWeekend: boolean; isToday: boolean } {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate().toString();
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  const dow = d.toLocaleDateString(undefined, { weekday: "short" });
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return { day, mon, dow, isWeekend, isToday: dateStr === todayStr() };
}

const statusClassMap: Record<string, string> = {
  confirmed: "confirmed",
  checked_in: "checked-in",
  checked_out: "checked-out",
  cancelled: "cancelled",
  no_show: "no-show",
};

export default function TapeChartPage() {
  const { dict } = useLocale();
  const [range, setRange] = useState<14 | 30 | 90>(14);
  const [from, setFrom] = useState(() => todayStr());
  const to = useMemo(() => addDays(from, range), [from, range]);
  const [data, setData] = useState<TapeChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const propRes = await fetch("/api/properties");
        if (!propRes.ok) throw new Error("Failed to load properties");
        const properties = await propRes.json();
        if (!properties.length) throw new Error("No property configured");
        const propertyId = properties[0].id;

        const res = await fetch(`/api/tape-chart?propertyId=${propertyId}&from=${from}&to=${to}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `API error: ${res.status}`);
        }
        const payload: TapeChartData = await res.json();
        setData(payload);
        setOpenGroups((prev) => {
          const next = { ...prev };
          for (const r of payload.rooms) {
            if (!(r.roomTypeCode in next)) next[r.roomTypeCode] = true;
          }
          return next;
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    if (from && to && from < to) fetchData();
  }, [from, to]);

  const groupedRooms = useMemo(() => {
    const groups: Record<string, { name: string; rooms: Room[] }> = {};
    if (!data) return groups;
    for (const r of data.rooms) {
      if (!groups[r.roomTypeCode]) {
        groups[r.roomTypeCode] = { name: r.roomTypeName, rooms: [] };
      }
      groups[r.roomTypeCode].rooms.push(r);
    }
    return groups;
  }, [data]);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, TapeBooking[]>();
    if (!data) return map;
    for (const b of data.bookings) {
      if (!b.roomId) continue;
      if (!map.has(b.roomId)) map.set(b.roomId, []);
      map.get(b.roomId)!.push(b);
    }
    return map;
  }, [data]);

  const daysCount = data?.dates.length ?? range;
  const totalW = ROOM_W + daysCount * DAY_W;
  const unassigned = data?.bookings.filter((b) => !b.roomId) ?? [];

  function goToday() {
    setFrom(todayStr());
  }

  function shift(days: number) {
    setFrom(addDays(from, days));
  }

  function renderBar(b: TapeBooking, dates: string[]) {
    const startIdx = dates.indexOf(b.checkInDate);
    const endIdx = dates.indexOf(b.checkOutDate);
    const startDay = startIdx >= 0 ? startIdx : 0;
    const endDay = endIdx >= 0 ? endIdx : dates.length;
    const startBefore = startIdx < 0 && b.checkInDate < dates[0];
    const endAfter = endIdx < 0 && b.checkOutDate > dates[dates.length - 1];
    const span = endDay - startDay;
    if (span <= 0) return null;
    const left = startDay * DAY_W + (startBefore ? 0 : DAY_W * 0.4);
    const right = (dates.length - endDay) * DAY_W + (endAfter ? 0 : DAY_W * 0.4);
    const width = dates.length * DAY_W - left - right;
    const cls = statusClassMap[b.status] || "confirmed";
    return (
      <Link
        key={b.id}
        href={`/bookings/${b.id}`}
        className={`bar ${cls}`}
        data-testid="tape-chart-bar"
        data-booking-id={b.id}
        data-booking-status={b.status}
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left,
          width,
          borderRadius: 4,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textDecoration: "none",
        }}
        title={`${b.guestName} · ${b.confirmationNumber}`}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.guestName}</span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            opacity: 0.7,
          }}
        >
          {b.confirmationNumber}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title" data-testid="tape-chart-title">{t(dict, "tape.title")}</h1>
        <span className="page-sub" data-testid="tape-chart-subtitle">
          {t(dict, "tape.subtitle", {
            from,
            to,
            days: daysCount,
            rooms: data?.rooms.length ?? 0,
          })}
        </span>
        <div className="actions">
          <div className="ptabs" data-testid="tape-chart-period-tabs">
            {([14, 30, 90] as const).map((r) => (
              <div
                key={r}
                className={`pt ${range === r ? "on" : ""}`}
                onClick={() => setRange(r)}
                role="button"
                data-testid={`tape-chart-period-${r}-button`}
                data-active={range === r ? "true" : "false"}
              >
                {t(dict, r === 14 ? "tape.days14" : r === 30 ? "tape.days30" : "tape.days90")}
              </div>
            ))}
          </div>
          <button type="button" className="btn sm" onClick={() => shift(-range)} data-testid="tape-chart-prev-button">
            <Icon name="chevLeft" size={12} />
          </button>
          <button type="button" className="btn sm" onClick={goToday} data-testid="tape-chart-today-button">
            {t(dict, "tape.today")}
          </button>
          <button type="button" className="btn sm" onClick={() => shift(range)} data-testid="tape-chart-next-button">
            <Icon name="chevRight" size={12} />
          </button>
          <Link href="/bookings/new" className="btn sm primary" data-testid="tape-chart-new-booking-link">
            <Icon name="plus" size={12} />
            {t(dict, "tape.newBooking")}
          </Link>
        </div>
      </div>

      <div
        data-testid="tape-chart-legend"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 12px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        {(
          [
            { cls: "confirmed", key: "tape.legend.confirmed" },
            { cls: "checked-in", key: "tape.legend.checkedIn" },
            { cls: "checked-out", key: "tape.legend.checkedOut" },
            { cls: "no-show", key: "tape.legend.noShow" },
            { cls: "cancelled", key: "tape.legend.cancelled" },
          ] as const
        ).map((l) => (
          <span key={l.cls} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span
              className={`bar ${l.cls}`}
              style={{ width: 18, height: 12, borderRadius: 3, position: "relative", padding: 0 }}
            />
            <span style={{ color: "var(--muted)" }}>{t(dict, l.key)}</span>
          </span>
        ))}
      </div>

      {error && (
        <div
          data-testid="tape-chart-error"
          style={{
            background: "var(--cancelled-bg)",
            color: "var(--cancelled-fg)",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading && <div data-testid="tape-chart-loading" style={{ color: "var(--muted)" }}>{t(dict, "tape.loading")}</div>}

      {!loading && data && (
        <div className="card" data-testid="tape-chart-grid" style={{ padding: 0, overflow: "hidden" }}>
          <div className="tape-wrap">
            <div style={{ minWidth: totalW }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `${ROOM_W}px repeat(${daysCount}, ${DAY_W}px)`,
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  background: "var(--bg-subtle)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    padding: "7px 12px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    position: "sticky",
                    left: 0,
                    background: "var(--bg-subtle)",
                    zIndex: 6,
                    borderRight: "1px solid var(--border)",
                  }}
                >
                  {t(dict, "tape.roomCol")}
                </div>
                {data.dates.map((d) => {
                  const info = parseDay(d);
                  return (
                    <div
                      key={d}
                      style={{
                        padding: "5px 4px",
                        fontSize: 11,
                        textAlign: "center",
                        fontWeight: info.isToday ? 600 : 500,
                        color: info.isToday ? "var(--accent)" : "var(--muted)",
                        background: info.isToday
                          ? "var(--accent-soft)"
                          : info.isWeekend
                            ? "var(--bg-sunken)"
                            : "transparent",
                        borderRight: "1px solid var(--border)",
                        borderBottom: info.isToday ? "2px solid var(--accent)" : "none",
                      }}
                    >
                      <div>
                        {info.day} {info.mon}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: info.isToday ? "var(--accent)" : "var(--muted-2)",
                          fontWeight: 400,
                        }}
                      >
                        {info.dow}
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.entries(groupedRooms).map(([code, group]) => {
                const isOpen = openGroups[code] !== false;
                const soldCount = group.rooms.reduce((s, r) => {
                  const bs = bookingsByRoom.get(r.id) || [];
                  return (
                    s +
                    (bs.some(
                      (b) =>
                        b.checkInDate <= todayStr() &&
                        b.checkOutDate > todayStr() &&
                        b.status === "checked_in",
                    )
                      ? 1
                      : 0)
                  );
                }, 0);

                return (
                  <div key={code} data-testid="tape-chart-group" data-group-code={code}>
                    <div
                      onClick={() => setOpenGroups((g) => ({ ...g, [code]: !isOpen }))}
                      data-testid="tape-chart-group-header"
                      style={{
                        padding: "6px 12px",
                        background: "var(--bg-subtle)",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        color: "var(--muted)",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        position: "sticky",
                        left: 0,
                      }}
                    >
                      <Icon
                        name="chevDown"
                        size={12}
                        style={{
                          transform: isOpen ? "rotate(0)" : "rotate(-90deg)",
                          transition: "transform .15s",
                        }}
                      />
                      <span>
                        {group.name} ({code})
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--muted-2)",
                          fontWeight: 400,
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        {t(dict, "tape.roomsCount", { count: group.rooms.length, sold: soldCount })}
                      </span>
                    </div>

                    {isOpen &&
                      group.rooms.map((r) => (
                        <div
                          key={r.id}
                          data-testid="tape-chart-room-row"
                          data-room-id={r.id}
                          data-room-number={r.roomNumber}
                          style={{
                            display: "flex",
                            borderBottom: "1px solid var(--border)",
                            position: "relative",
                            height: ROW_H,
                            background: "var(--surface)",
                          }}
                        >
                          <div
                            style={{
                              width: ROOM_W,
                              flexShrink: 0,
                              padding: "0 10px",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              fontWeight: 500,
                              position: "sticky",
                              left: 0,
                              background: "var(--surface)",
                              zIndex: 2,
                              borderRight: "1px solid var(--border)",
                            }}
                          >
                            <span>{r.roomNumber}</span>
                            <span
                              style={{
                                color: "var(--muted)",
                                fontSize: 10,
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              {r.roomTypeCode}
                            </span>
                          </div>
                          <div
                            style={{
                              position: "relative",
                              width: daysCount * DAY_W,
                              height: ROW_H,
                            }}
                          >
                            {data.dates.map((d, di) => {
                              const info = parseDay(d);
                              return (
                                <div
                                  key={d}
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: di * DAY_W,
                                    width: DAY_W,
                                    borderRight: "1px solid var(--border)",
                                    background: info.isToday
                                      ? "rgba(37,99,235,0.04)"
                                      : info.isWeekend
                                        ? "var(--bg-subtle)"
                                        : "transparent",
                                    boxShadow: info.isToday ? "inset 2px 0 0 var(--accent)" : "none",
                                  }}
                                />
                              );
                            })}
                            {(bookingsByRoom.get(r.id) || []).map((b) => renderBar(b, data.dates))}
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}

              {data.rooms.length === 0 && (
                <div data-testid="tape-chart-no-rooms" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  {t(dict, "tape.noRooms")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && unassigned.length > 0 && (
        <div className="card" data-testid="tape-chart-unassigned-card">
          <div className="card-head">
            <div className="card-title">
              {t(dict, "tape.unassigned")} <span className="count">{unassigned.length}</span>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {unassigned.map((b) => {
              const cls = statusClassMap[b.status] || "confirmed";
              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={`badge ${cls}`}
                  style={{ textDecoration: "none", fontSize: 11.5 }}
                >
                  <span className="tnum">{b.confirmationNumber}</span>
                  <span style={{ marginLeft: 4 }}>· {b.guestName}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
