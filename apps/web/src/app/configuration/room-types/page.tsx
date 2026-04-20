import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import { RoomTypesList } from "./room-types-list";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
};

export default async function RoomTypesPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const roomTypesWithCount = propertyId
    ? await apiFetch<(RoomType & { roomCount: number })[]>(
        `/api/room-types?propertyId=${propertyId}`,
      )
    : [];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "roomTypes.title")}</h1>
        <div className="actions">
          <Link href="/configuration/room-types/new" className="btn sm primary">
            <Icon name="plus" size={12} />
            {t(dict, "roomTypes.add")}
          </Link>
        </div>
      </div>

      <RoomTypesList roomTypes={roomTypesWithCount} propertyId={propertyId ?? ""} />
    </>
  );
}
