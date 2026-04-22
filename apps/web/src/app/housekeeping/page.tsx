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
    const res = await apiFetch<{ data: HousekeepingTask[]; businessDate: string | null }>(
      `/api/housekeeping/tasks?propertyId=${propertyId}`,
    );
    tasks = res.data;
    businessDate = res.businessDate;
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t(dict, "hk.title")}</h1>
        <span className="page-sub">
          {businessDate ? businessDate : t(dict, "hk.subtitle")}
        </span>
      </div>

      {!propertyId ? (
        <div className="card">
          <div className="card-body">
            <div className="empty">{t(dict, "hk.noProperty")}</div>
          </div>
        </div>
      ) : (
        <HousekeepingClient
          initialTasks={tasks}
          propertyId={propertyId}
          businessDate={businessDate}
        />
      )}
    </>
  );
}
