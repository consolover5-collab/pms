import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { RatePlanForm } from "../../rate-plan-form";
import { RoomRatesMatrix } from "../../room-rates-matrix";

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
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration/rate-plans" label="Back to Rate Plans" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Rate Plan: {ratePlan.name}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-base font-semibold mb-4 text-gray-700">Настройки тарифного плана</h2>
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

        <div>
          <h2 className="text-base font-semibold mb-4 text-gray-700">Цены по типам комнат</h2>
          <RoomRatesMatrix
            ratePlanId={id}
            roomTypes={roomTypes}
            roomRates={roomRates}
          />
        </div>
      </div>
    </main>
  );
}
