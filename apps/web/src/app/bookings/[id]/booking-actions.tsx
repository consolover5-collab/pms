"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/locales/en";
import { Icon } from "@/components/icon";

type AvailableRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
};

function RoomPickerModal({
  title,
  propertyId,
  roomTypeId,
  excludeRoomId,
  onConfirm,
  onCancel,
  dict,
}: {
  title: string;
  propertyId: string;
  roomTypeId: string;
  excludeRoomId?: string | null;
  onConfirm: (roomId: string) => void;
  onCancel: () => void;
  dict: Dictionary;
}) {
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rooms?propertyId=${propertyId}&roomTypeId=${roomTypeId}&occupancyStatus=vacant&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const list: AvailableRoom[] = Array.isArray(data) ? data : (data.data ?? []);
        const ready = list.filter(
          (r) =>
            (r.housekeepingStatus === "clean" || r.housekeepingStatus === "inspected") &&
            r.id !== excludeRoomId,
        );
        setRooms(ready);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [propertyId, roomTypeId, excludeRoomId]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420, boxShadow: "var(--shadow-lg)" }}>
        <div className="card-head">
          <div className="card-title">{title}</div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>{t(dict, "booking.loadingRooms")}</p>
          ) : rooms.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--cancelled)" }}>{t(dict, "booking.noCleanRooms")}</p>
          ) : (
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">{t(dict, "booking.selectRoom")}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  №{r.roomNumber}
                  {r.floor ? ` · fl.${r.floor}` : ""} · {r.housekeepingStatus} / {r.occupancyStatus}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onCancel} className="btn sm" type="button">
              {t(dict, "booking.cancel")}
            </button>
            <button
              onClick={() => selectedId && onConfirm(selectedId)}
              disabled={!selectedId}
              className="btn sm primary"
              type="button"
            >
              {t(dict, "booking.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookingActions({
  bookingId,
  status,
  checkInDate,
  hasRoom,
  propertyId,
  roomTypeId,
  currentRoomId,
}: {
  bookingId: string;
  status: string;
  checkInDate: string;
  hasRoom: boolean;
  propertyId: string;
  roomTypeId: string;
  currentRoomId: string | null;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [showForceCheckout, setShowForceCheckout] = useState(false);
  const [showRoomPickerFor, setShowRoomPickerFor] = useState<"check-in" | "room-move" | null>(null);
  const [showDirtyWarning, setShowDirtyWarning] = useState<{ roomId?: string; message: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  async function performAction(action: string, body: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    setShowForceCheckout(false);
    setShowDirtyWarning(null);

    const url = `/api/bookings/${bookingId}/${action}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const errorDetail: ApiErrorDetail = {
          ...data,
          status: res.status,
          url,
          timestamp: new Date().toISOString(),
        };

        if (data.code === "EARLY_CHECKOUT" || data.code === "LATE_CHECKOUT") {
          setError(errorDetail);
          setShowForceCheckout(true);
          return;
        }

        if (data.code === "NO_ROOM_ASSIGNED") {
          setShowRoomPickerFor("check-in");
          return;
        }

        if (data.code === "ROOM_NOT_READY" && action === "check-in") {
          setShowDirtyWarning({ roomId: body.roomId as string | undefined, message: data.error });
          return;
        }

        setError(errorDetail);
        return;
      }

      router.refresh();
    } catch (err) {
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? t(dict, "booking.connectionError")
          : err instanceof Error
            ? err.message
            : t(dict, "booking.networkError");

      setError({
        error: message,
        code: "NETWORK_ERROR",
        url,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }

  const canCheckIn = status === "confirmed" && checkInDate <= today;
  const isFutureArrival = status === "confirmed" && checkInDate > today;
  const canCheckOut = status === "checked_in";
  const canCancel = status === "confirmed";
  const canCancelCheckIn = status === "checked_in" && checkInDate === today;
  const canReinstate = status === "cancelled" || status === "no_show" || status === "checked_out";
  const canRoomMove = status === "checked_in";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canCheckIn && (
          <button
            type="button"
            onClick={() => performAction("check-in")}
            disabled={loading}
            className="btn sm primary"
          >
            <Icon name="key" size={12} />
            {t(dict, "booking.checkIn")}
          </button>
        )}

        {isFutureArrival && (
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              padding: "5px 10px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            {t(dict, "booking.checkInAvailable", { date: checkInDate })}
          </span>
        )}

        {canCheckOut && (
          <button
            type="button"
            onClick={() => performAction("check-out")}
            disabled={loading}
            className="btn sm primary"
          >
            <Icon name="logout" size={12} />
            {t(dict, "booking.checkOut")}
          </button>
        )}

        {canRoomMove && (
          <button
            type="button"
            onClick={() => setShowRoomPickerFor("room-move")}
            disabled={loading}
            className="btn sm"
          >
            <Icon name="bed" size={12} />
            {t(dict, "booking.changeRoom")}
          </button>
        )}

        {canCancelCheckIn && (
          <button
            type="button"
            onClick={() => {
              if (confirm(t(dict, "booking.cancelCheckInConfirm"))) {
                performAction("cancel-check-in");
              }
            }}
            disabled={loading}
            className="btn sm"
          >
            {t(dict, "booking.cancelCheckIn")}
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => {
              const reason = prompt(t(dict, "booking.cancelReason"));
              if (reason === null) return;
              performAction("cancel", reason ? { reason } : {});
            }}
            disabled={loading}
            className="btn sm danger"
          >
            <Icon name="x" size={12} />
            {t(dict, "booking.cancelBooking")}
          </button>
        )}

        {canReinstate && (
          <button
            type="button"
            onClick={() => {
              const confirmMsg =
                status === "checked_out"
                  ? t(dict, "booking.reinstateCheckedOut")
                  : status === "no_show"
                    ? t(dict, "booking.reinstateNoShow")
                    : t(dict, "booking.reinstateCancelled");
              if (confirm(confirmMsg)) {
                performAction("reinstate");
              }
            }}
            disabled={loading}
            className="btn sm"
          >
            <Icon name="refresh" size={12} />
            {t(dict, "booking.reinstate")}
          </button>
        )}
      </div>

      {showForceCheckout && (
        <div
          style={{
            padding: 12,
            background: "var(--no-show-bg)",
            border: "1px solid var(--no-show)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--no-show-fg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: 1, minWidth: 200 }}>{error?.error}</span>
          <button
            type="button"
            onClick={() => performAction("check-out", { force: true })}
            disabled={loading}
            className="btn sm primary"
          >
            {t(dict, "booking.confirmCheckOut")}
          </button>
        </div>
      )}

      {error && !showForceCheckout && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

      {status === "checked_in" && !hasRoom && (
        <div
          style={{
            padding: 12,
            background: "var(--hk-pickup-bg)",
            border: "1px solid var(--hk-pickup)",
            borderRadius: 8,
            fontSize: 13,
            color: "#854d0e",
          }}
        >
          {t(dict, "booking.noRoomWarning")}
        </div>
      )}

      {showRoomPickerFor === "check-in" && (
        <RoomPickerModal
          title={t(dict, "booking.selectRoomForCheckIn")}
          propertyId={propertyId}
          roomTypeId={roomTypeId}
          excludeRoomId={null}
          onCancel={() => setShowRoomPickerFor(null)}
          onConfirm={(roomId) => {
            setShowRoomPickerFor(null);
            performAction("check-in", { roomId });
          }}
          dict={dict}
        />
      )}

      {showRoomPickerFor === "room-move" && (
        <RoomPickerModal
          title={t(dict, "booking.roomChange")}
          propertyId={propertyId}
          roomTypeId={roomTypeId}
          excludeRoomId={currentRoomId}
          onCancel={() => setShowRoomPickerFor(null)}
          onConfirm={(newRoomId) => {
            setShowRoomPickerFor(null);
            performAction("room-move", { newRoomId });
          }}
          dict={dict}
        />
      )}

      {showDirtyWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
            backdropFilter: "blur(2px)",
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: "100%", boxShadow: "var(--shadow-lg)" }}>
            <div className="card-head">
              <div className="card-title" style={{ color: "var(--no-show)" }}>
                <Icon name="alert" size={14} />
                {t(dict, "booking.dirtyWarning.title")}
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, margin: 0 }}>{showDirtyWarning.message}</p>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={() => setShowDirtyWarning(null)} className="btn sm">
                  {t(dict, "booking.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const payload: Record<string, unknown> = { force: true };
                    if (showDirtyWarning.roomId) payload.roomId = showDirtyWarning.roomId;
                    setShowDirtyWarning(null);
                    performAction("check-in", payload);
                  }}
                  className="btn sm primary"
                >
                  {t(dict, "booking.dirtyWarning.forceCheckIn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
