import { apiFetch } from "@/lib/api";
import { HousekeepingClient } from "./housekeeping-client";
import { getLocale, getDict, t } from "@/lib/i18n";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
};

export type HousekeepingTask = {
  id: string;
  taskType: string;
  assignedTo: string | null;
  priority: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  room: Room;
};

export default async function HousekeepingPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  let tasks: HousekeepingTask[] = [];
  let businessDate: string | null = null;

  if (propertyId) {
    const res = await apiFetch<{ data: HousekeepingTask[], businessDate: string | null }>(
      `/api/housekeeping/tasks?propertyId=${propertyId}`
    );
    tasks = res.data;
    businessDate = res.businessDate;
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {businessDate ? t(dict, "hk.titleWithDate", { date: businessDate }) : t(dict, "hk.title")}
          </h1>
          <p className="text-gray-600 text-sm mt-1">{t(dict, "hk.subtitle")}</p>
        </div>
      </div>

      {!propertyId ? (
        <div className="text-center py-12 text-gray-500">
          {t(dict, "hk.noProperty")}
        </div>
      ) : (
        <HousekeepingClient
          initialTasks={tasks}
          propertyId={propertyId}
          businessDate={businessDate}
        />
      )}
    </main>
  );
}
