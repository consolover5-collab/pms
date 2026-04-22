import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { getHkStatusLabel, getOccupancyLabel } from "@/lib/hk-labels";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
  roomTypeId: string;
  roomType: { id: string; name: string; code: string };
};

type Property = { id: string; name: string };
type RoomType = { id: string; name: string; code: string };

const hkStatusColors: Record<string, string> = {
  clean: "bg-cyan-100 text-cyan-800",
  dirty: "bg-red-100 text-red-800",
  pickup: "bg-yellow-100 text-yellow-800",
  inspected: "bg-green-100 text-green-800",
  out_of_order: "bg-gray-600 text-white",
  out_of_service: "bg-gray-400 text-white",
};

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ hk?: string; occ?: string; type?: string }>;
}) {
  const { hk, occ, type } = await searchParams;
  const locale = await getLocale();
  const dict = getDict(locale);

  let properties: Property[];
  try {
    properties = await apiFetch<Property[]>("/api/properties");
  } catch (err) {
    return (
      <main className="p-8">
        <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-800">{t(dict, "roomsList.loadFailed")}</h2>
          <p className="text-red-700 text-sm mt-1">
            {err instanceof Error ? err.message : t(dict, "roomsList.loadFailedDefault")}
          </p>
          <Link href="/rooms" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            {t(dict, "roomsList.retry")}
          </Link>
        </div>
      </main>
    );
  }

  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">{t(dict, "roomsList.noProperty")}</h1>
      </main>
    );
  }

  const queryParams = new URLSearchParams({ propertyId: property.id });
  if (hk) queryParams.set("housekeepingStatus", hk);
  if (occ) queryParams.set("occupancyStatus", occ);
  if (type) queryParams.set("roomTypeId", type);

  let rooms: Room[];
  let allRooms: Room[];
  try {
    [rooms, , allRooms] = await Promise.all([
      apiFetch<Room[]>(`/api/rooms?${queryParams.toString()}`),
      apiFetch<RoomType[]>(`/api/room-types?propertyId=${property.id}`),
      apiFetch<Room[]>(`/api/rooms?propertyId=${property.id}`),
    ]);
  } catch (err) {
    return (
      <main className="p-8">
        <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-800">{t(dict, "roomsList.loadFailed")}</h2>
          <p className="text-red-700 text-sm mt-1">
            {err instanceof Error ? err.message : t(dict, "roomsList.loadFailedDefault")}
          </p>
          <Link href="/rooms" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            {t(dict, "roomsList.retry")}
          </Link>
        </div>
      </main>
    );
  }

  const stats = {
    total: allRooms.length,
    vacant: allRooms.filter((r) => r.occupancyStatus === "vacant").length,
    occupied: allRooms.filter((r) => r.occupancyStatus === "occupied").length,
    clean: allRooms.filter((r) => r.housekeepingStatus === "clean").length,
    dirty: allRooms.filter((r) => r.housekeepingStatus === "dirty").length,
  };

  const roomsByFloor = rooms.reduce(
    (acc, room) => {
      const floor = String(room.floor || "0");
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(room);
      return acc;
    },
    {} as Record<string, Room[]>,
  );

  return (
    <main className="p-8">
      <h1 data-testid="rooms-heading" className="text-2xl font-bold mb-6">{t(dict, "roomsList.title")}</h1>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div data-testid="rooms-stat-total" className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-gray-500">{t(dict, "roomsList.stat.total")}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div data-testid="rooms-stat-vacant" className="text-2xl font-bold text-green-700">{stats.vacant}</div>
          <div className="text-xs text-gray-500">{t(dict, "roomsList.stat.vacant")}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div data-testid="rooms-stat-occupied" className="text-2xl font-bold text-blue-700">{stats.occupied}</div>
          <div className="text-xs text-gray-500">{t(dict, "roomsList.stat.occupied")}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div data-testid="rooms-stat-clean" className="text-2xl font-bold text-green-700">{stats.clean}</div>
          <div className="text-xs text-gray-500">{t(dict, "roomsList.stat.clean")}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div data-testid="rooms-stat-dirty" className="text-2xl font-bold text-red-700">{stats.dirty}</div>
          <div className="text-xs text-gray-500">{t(dict, "roomsList.stat.dirty")}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{t(dict, "roomsList.filter.hk")}</span>
          <div className="flex gap-1">
            <Link
              data-testid="rooms-filter-hk-all"
              href="/rooms"
              aria-current={!hk ? "page" : undefined}
              className={`px-3 py-1 rounded text-sm ${!hk ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {t(dict, "roomsList.filter.all")}
            </Link>
            {["clean", "dirty", "inspected", "pickup"].map((key) => (
              <Link
                key={key}
                data-testid={`rooms-filter-hk-${key}`}
                href={`/rooms?hk=${key}${occ ? `&occ=${occ}` : ""}`}
                aria-current={hk === key ? "page" : undefined}
                className={`px-3 py-1 rounded text-sm ${hk === key ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
              >
                {getHkStatusLabel(dict, key)}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{t(dict, "roomsList.filter.occ")}</span>
          <div className="flex gap-1">
            <Link
              data-testid="rooms-filter-occ-all"
              href={`/rooms${hk ? `?hk=${hk}` : ""}`}
              aria-current={!occ ? "page" : undefined}
              className={`px-3 py-1 rounded text-sm ${!occ ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {t(dict, "roomsList.filter.all")}
            </Link>
            <Link
              data-testid="rooms-filter-occ-vacant"
              href={`/rooms?occ=vacant${hk ? `&hk=${hk}` : ""}`}
              aria-current={occ === "vacant" ? "page" : undefined}
              className={`px-3 py-1 rounded text-sm ${occ === "vacant" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {getOccupancyLabel(dict, "vacant")}
            </Link>
            <Link
              data-testid="rooms-filter-occ-occupied"
              href={`/rooms?occ=occupied${hk ? `&hk=${hk}` : ""}`}
              aria-current={occ === "occupied" ? "page" : undefined}
              className={`px-3 py-1 rounded text-sm ${occ === "occupied" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {getOccupancyLabel(dict, "occupied")}
            </Link>
          </div>
        </div>
      </div>

      {/* Room Grid by Floor */}
      {Object.entries(roomsByFloor)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([floor, floorRooms]) => (
          <div key={floor} data-testid="rooms-floor-group" className="mb-6">
            <h2 className="text-lg font-semibold mb-3">{t(dict, "roomsList.floor", { floor })}</h2>
            <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
              {floorRooms
                .sort((a, b) =>
                  a.roomNumber.localeCompare(b.roomNumber, undefined, {
                    numeric: true,
                  }),
                )
                .map((room) => {
                  const hkLabel = getHkStatusLabel(dict, room.housekeepingStatus);
                  const occLabel = getOccupancyLabel(dict, room.occupancyStatus);
                  return (
                    <Link
                      key={room.id}
                      data-testid="rooms-card"
                      data-room-type-id={room.roomTypeId}
                      href={`/rooms/${room.id}`}
                      className={`relative p-3 rounded-lg border-2 hover:shadow-md transition-shadow ${
                        room.occupancyStatus === "occupied"
                          ? "border-blue-300 bg-blue-50"
                          : room.housekeepingStatus === "clean" ||
                              room.housekeepingStatus === "inspected"
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-red-300 bg-red-50"
                      }`}
                    >
                      <div
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                          room.occupancyStatus === "occupied"
                            ? "bg-blue-500"
                            : "bg-green-500"
                        }`}
                        aria-label={occLabel}
                        role="img"
                      />
                      <div data-testid="rooms-card-number" className="font-mono font-bold text-sm">
                        {room.roomNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {room.roomType.code}
                      </div>
                      <div className="mt-1">
                        <span
                          data-testid="rooms-hk-badge"
                          className={`text-xs px-1 rounded ${hkStatusColors[room.housekeepingStatus]}`}
                          aria-label={t(dict, "roomsList.aria.hk", {
                            status: hkLabel || t(dict, "roomsList.aria.hkUnknown"),
                          })}
                        >
                          {hkLabel?.slice(0, 1) || "?"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}

      {rooms.length === 0 && (
        <div data-testid="rooms-empty-state" className="text-center text-gray-500 py-8">
          {t(dict, "roomsList.empty")}
        </div>
      )}
    </main>
  );
}
