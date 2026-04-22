import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RatePlanForm } from "../../rate-plan-form";
import { RoomRatesMatrix } from "../../room-rates-matrix";
import { getLocale, getDict, t } from "@/lib/i18n";

type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type RoomType = { id: string; name: string; code: string };

type RoomRate = {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  amount: string;
};

export default async function EditRatePlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;
  const [ratePlan, properties] = await Promise.all([
    apiFetch<RatePlan>(`/api/rate-plans/${id}`),
    apiFetch<{ id: string }[]>("/api/properties"),
  ]);
  const propertyId = properties[0]?.id;

  const [roomTypes, roomRates] = await Promise.all([
    propertyId
      ? apiFetch<RoomType[]>(`/api/room-types?propertyId=${propertyId}`)
      : Promise.resolve([] as RoomType[]),
    apiFetch<RoomRate[]>(`/api/rate-plans/${id}/room-rates`),
  ]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/rate-plans" style={{ color: "var(--muted)" }}>
          ← {t(dict, "ratePlans.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "ratePlans.editTitle")}</h1>
        <span className="page-sub">{ratePlan.name}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t(dict, "ratePlan.settingsTitle")}</div>
          </div>
          <div className="card-body">
            <RatePlanForm
              ratePlan={{
                id: ratePlan.id,
                code: ratePlan.code,
                name: ratePlan.name,
                description: ratePlan.description || "",
                baseRate: ratePlan.baseRate || "",
                isDefault: ratePlan.isDefault,
                isActive: ratePlan.isActive,
              }}
              propertyId={propertyId}
              isEdit
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">{t(dict, "ratePlan.roomRatesTitle")}</div>
          </div>
          <div className="card-body">
            <RoomRatesMatrix
              ratePlanId={id}
              roomTypes={roomTypes}
              roomRates={roomRates}
            />
          </div>
        </div>
      </div>
    </>
  );
}
