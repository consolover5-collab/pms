import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { RoomTypeForm } from "../../room-type-form";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
};

export default async function EditRoomTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { id } = await params;
  const [roomType, properties] = await Promise.all([
    apiFetch<RoomType>(`/api/room-types/${id}`),
    apiFetch<{ id: string }[]>("/api/properties"),
  ]);
  const propertyId = properties[0]?.id;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/room-types" style={{ color: "var(--muted)" }}>
          ← {t(dict, "roomTypes.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "roomTypes.editTitle")}</h1>
        <span className="page-sub">{roomType.name}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <RoomTypeForm
            roomType={{
              id: roomType.id,
              code: roomType.code,
              name: roomType.name,
              maxOccupancy: roomType.maxOccupancy,
              description: roomType.description || "",
              sortOrder: roomType.sortOrder,
            }}
            propertyId={propertyId}
            isEdit
          />
        </div>
      </div>
    </>
  );
}
