import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { RoomTypeForm } from "../room-type-form";

export default async function NewRoomTypePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/room-types" style={{ color: "var(--muted)" }}>
          ← {t(dict, "roomTypes.title")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, "roomTypes.newTitle")}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <RoomTypeForm propertyId={propertyId} />
        </div>
      </div>
    </>
  );
}
