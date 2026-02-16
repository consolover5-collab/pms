"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorDisplay, type ApiErrorDetail } from "@/components/error-display";


export function BookingActions({
  bookingId,
  status,
  checkInDate,
  hasRoom,
}: {
  bookingId: string;
  status: string;
  checkInDate: string;
  hasRoom: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [showForceCheckout, setShowForceCheckout] = useState(false);

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

        // Handle early/late checkout - offer force option
        if (data.code === "EARLY_CHECKOUT" || data.code === "LATE_CHECKOUT") {
          setError(errorDetail);
          setShowForceCheckout(true);
          return;
        }

        setError(errorDetail);
        return;
      }

      router.refresh();
    } catch (err) {
      const message = err instanceof TypeError && err.message === "Failed to fetch"
        ? `Connection error: Cannot reach the API server. Check that it is running.`
        : err instanceof Error ? err.message : "Network error - check your connection";

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

  // Determine which actions are available based on status AND dates
  const canCheckIn = status === "confirmed" && checkInDate <= today;
  const isFutureArrival = status === "confirmed" && checkInDate > today;
  const canCheckOut = status === "checked_in";
  const canCancel = status === "confirmed" || status === "no_show";
  const canCancelCheckIn = status === "checked_in";
  const canReinstate = status === "cancelled" || status === "no_show" || status === "checked_out";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {/* Check-in */}
        {canCheckIn && (
          <button
            onClick={() => performAction("check-in")}
            disabled={loading}
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Check Out
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
              performAction("cancel", reason ? { reason } : {});
            }}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Booking
          </button>
        )}

        {/* Reinstate */}
        {canReinstate && (
          <button
            onClick={() => {
              const confirmMsg = status === "checked_out"
                ? "Reinstate this booking? The guest will be checked back in and the room re-occupied."
                : "Reinstate this booking? It will return to confirmed status.";
              if (confirm(confirmMsg)) {
                performAction("reinstate");
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Reinstate
          </button>
        )}
      </div>

      {/* Force checkout option for early/late checkout */}
      {showForceCheckout && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-2">
            {error?.error}
          </p>
          <button
            onClick={() => performAction("check-out", { force: true })}
            disabled={loading}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            Confirm Check-out
          </button>
        </div>
      )}

      {/* Error display with technical details */}
      {error && !showForceCheckout && (
        <ErrorDisplay
          error={error}
          onDismiss={() => setError(null)}
        />
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
    </div>
  );
}
