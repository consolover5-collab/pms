"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

type RoomType = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  description: string | null;
  sortOrder: number;
  roomCount: number;
};

export function RoomTypesList({
  roomTypes,
  propertyId,
}: {
  roomTypes: RoomType[];
  propertyId: string;
}) {
  const router = useRouter();
  const { dict } = useLocale();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm(t(dict, "roomTypes.confirmDelete"))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/room-types/${id}?propertyId=${propertyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert(t(dict, "roomTypes.deleteFailed"));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          {t(dict, "roomTypes.title")} <span className="count">{roomTypes.length}</span>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {roomTypes.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            {t(dict, "roomTypes.empty")}
          </div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{t(dict, "roomTypes.colCode")}</th>
                <th>{t(dict, "roomTypes.colName")}</th>
                <th className="r" style={{ width: 100 }}>
                  {t(dict, "roomTypes.colMaxOcc")}
                </th>
                <th className="r" style={{ width: 90 }}>
                  {t(dict, "roomTypes.colRooms")}
                </th>
                <th className="r">{t(dict, "roomTypes.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id}>
                  <td className="tnum">{rt.code}</td>
                  <td>
                    <Link
                      href={`/configuration/room-types/${rt.id}`}
                      style={{ color: "var(--fg)", fontWeight: 500 }}
                    >
                      {rt.name}
                    </Link>
                    {rt.description && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{rt.description}</div>
                    )}
                  </td>
                  <td className="r tnum">{rt.maxOccupancy}</td>
                  <td className="r tnum">
                    <Link
                      href={`/configuration/room-types/${rt.id}`}
                      style={{ color: "var(--accent)" }}
                    >
                      {rt.roomCount}
                    </Link>
                  </td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Link
                        href={`/configuration/room-types/${rt.id}/edit`}
                        className="btn xs ghost"
                      >
                        {t(dict, "roomTypes.edit")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(rt.id)}
                        disabled={deleting === rt.id}
                        className="btn xs danger"
                      >
                        {deleting === rt.id ? t(dict, "roomTypes.deleting") : t(dict, "roomTypes.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
