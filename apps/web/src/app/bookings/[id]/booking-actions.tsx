"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";

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
}: {
  title: string;
  propertyId: string;
  roomTypeId: string;
  excludeRoomId?: string | null;
  onConfirm: (roomId: string) => void;
  onCancel: () => void;
}) {
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rooms?propertyId=${propertyId}&roomTypeId=${roomTypeId}&occupancyStatus=vacant&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const list: AvailableRoom[] = (Array.isArray(data) ? data : (data.data ?? []));
        const ready = list.filter(
          (r) =>
            (r.housekeepingStatus === "clean" || r.housekeepingStatus === "inspected") &&
            r.id !== excludeRoomId
        );
        setRooms(ready);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [propertyId, roomTypeId, excludeRoomId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold mb-4">{title}</h3>

        {loading ? (
          <p className="text-sm text-gray-500">Загрузка комнат…</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-red-600">Нет свободных чистых комнат данного типа.</p>
        ) : (
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— выберите комнату —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                №{r.roomNumber}{r.floor ? ` · эт.${r.floor}` : ""} · {r.housekeepingStatus} / {r.occupancyStatus}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Подтвердить
          </button>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [showForceCheckout, setShowForceCheckout] = useState(false);
  const [showRoomPickerFor, setShowRoomPickerFor] = useState<"check-in" | "room-move" | null>(null);

  const today = new Date().toISOString().split("T")[0];

  async function performAction(action: string, body: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    setShowForceCheckout(false);

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

        // Предложить выбор комнаты если комната не назначена
        if (data.code === "NO_ROOM_ASSIGNED") {
          setShowRoomPickerFor("check-in");
          return;
        }

        setError(errorDetail);
        return;
      }

      router.refresh();
    } catch (err) {
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? `Connection error: Cannot reach the API server. Check that it is running.`
          : err instanceof Error
          ? err.message
          : "Network error - check your connection";

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
  const canCancel = status === "confirmed" || status === "no_show";
  // Cancel Check-in только в дату заезда (гость ещё не ночевал)
  const canCancelCheckIn = status === "checked_in" && checkInDate === today;
  const canReinstate = status === "cancelled" || status === "no_show" || status === "checked_out";
  const canRoomMove = status === "checked_in";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {/* Check-in */}
        {canCheckIn && (
          <button
            onClick={() => performAction("check-in")}
            disabled={loading}
            aria-label="Check in guest"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Check In
          </button>
        )}

        {/* Future arrival note */}
        {isFutureArrival && (
          <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded text-sm">
            Check-in available on {checkInDate}
          </span>
        )}

        {/* Check-out */}
        {canCheckOut && (
          <button
            onClick={() => performAction("check-out")}
            disabled={loading}
            aria-label="Check out guest"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Check Out
          </button>
        )}

        {/* Room move */}
        {canRoomMove && (
          <button
            onClick={() => setShowRoomPickerFor("room-move")}
            disabled={loading}
            aria-label="Move guest to another room"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Сменить комнату
          </button>
        )}

        {/* Cancel Check-in (undo) */}
        {canCancelCheckIn && (
          <button
            onClick={() => {
              if (confirm("Cancel check-in? The guest will need to check in again.")) {
                performAction("cancel-check-in");
              }
            }}
            disabled={loading}
            aria-label="Cancel check-in - guest will need to check in again"
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            Cancel Check-in
          </button>
        )}

        {/* Cancel booking */}
        {canCancel && (
          <button
            onClick={() => {
              const reason = prompt("Cancellation reason (optional):");
              if (reason === null) return;
              performAction("cancel", reason ? { reason } : {});
            }}
            disabled={loading}
            aria-label="Cancel this booking"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Booking
          </button>
        )}

        {/* Reinstate */}
        {canReinstate && (
          <button
            onClick={() => {
              const confirmMsg =
                status === "checked_out"
                  ? "Reinstate this booking? The guest will be checked back in and the room re-occupied."
                  : "Reinstate this booking? It will return to confirmed status.";
              if (confirm(confirmMsg)) {
                performAction("reinstate");
              }
            }}
            disabled={loading}
            aria-label="Reinstate this booking"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Reinstate
          </button>
        )}
      </div>

      {/* Force checkout option for early/late checkout */}
      {showForceCheckout && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-2">{error?.error}</p>
          <button
            onClick={() => performAction("check-out", { force: true })}
            disabled={loading}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            Confirm Check-out
          </button>
        </div>
      )}

      {/* Error display */}
      {error && !showForceCheckout && (
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      )}

      {/* Warning for checked-in without room */}
      {status === "checked_in" && !hasRoom && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            Warning: This booking is checked-in but has no room assigned.
            Please assign a room to proceed with check-out.
          </p>
        </div>
      )}

      {/* Room picker modal: выбор комнаты для заселения */}
      {showRoomPickerFor === "check-in" && (
        <RoomPickerModal
          title="Выберите комнату для заселения"
          propertyId={propertyId}
          roomTypeId={roomTypeId}
          excludeRoomId={null}
          onCancel={() => setShowRoomPickerFor(null)}
          onConfirm={(roomId) => {
            setShowRoomPickerFor(null);
            performAction("check-in", { roomId });
          }}
        />
      )}

      {/* Room picker modal: смена комнаты */}
      {showRoomPickerFor === "room-move" && (
        <RoomPickerModal
          title="Смена комнаты"
          propertyId={propertyId}
          roomTypeId={roomTypeId}
          excludeRoomId={currentRoomId}
          onCancel={() => setShowRoomPickerFor(null)}
          onConfirm={(newRoomId) => {
            setShowRoomPickerFor(null);
            performAction("room-move", { newRoomId });
          }}
        />
      )}
    </div>
  );
}
