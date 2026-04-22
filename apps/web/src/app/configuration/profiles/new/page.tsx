import Link from "next/link";
import { getLocale, getDict, t, type DictionaryKey } from "@/lib/i18n";
import { ProfileForm } from "../profile-form";

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { type } = await searchParams;

  const titleKey = (
    type === "individual" || type === "company" || type === "travel_agent" || type === "source"
      ? `profiles.newTitle.${type}`
      : "profiles.newTitle.default"
  ) as DictionaryKey;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration/profiles" style={{ color: "var(--muted)" }}>
          ← {t(dict, "profiles.backToList")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title">{t(dict, titleKey)}</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <ProfileForm />
        </div>
      </div>
    </>
  );
}
