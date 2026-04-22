import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import { Icon } from "@/components/icon";
import { ProfilesList } from "./profiles-list";

type Profile = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  iataCode: string | null;
  sourceCode: string | null;
};

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const { type, q } = await searchParams;
  const params = new URLSearchParams();
  params.set("propertyId", "ff1d9135-dfb9-4baa-be46-0e739cd26dad");
  if (type) params.set("type", type);
  if (q) params.set("q", q);

  const url = `/api/profiles?${params.toString()}`;
  const result = await apiFetch<{ data: Profile[]; total: number }>(url);
  const profiles = result.data;

  return (
    <div data-testid="config-profiles-page">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <Link href="/configuration" style={{ color: "var(--muted)" }}>
          ← {t(dict, "config.backToConfig")}
        </Link>
      </div>

      <div className="page-head">
        <h1 className="page-title" data-testid="config-profiles-title">
          {t(dict, "profiles.title")}
        </h1>
        <span className="page-sub" data-testid="config-profiles-subtitle">
          {t(dict, "profiles.subtitle")}
        </span>
        <div className="actions">
          <Link
            href="/configuration/profiles/new?type=individual"
            className="btn sm"
            data-testid="config-profiles-add-individual"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addGuest")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=company"
            className="btn sm"
            data-testid="config-profiles-add-company"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addCompany")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=travel_agent"
            className="btn sm"
            data-testid="config-profiles-add-travel-agent"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addAgent")}
          </Link>
          <Link
            href="/configuration/profiles/new?type=source"
            className="btn sm primary"
            data-testid="config-profiles-add-source"
          >
            <Icon name="plus" size={12} />
            {t(dict, "profiles.addSource")}
          </Link>
        </div>
      </div>

      <ProfilesList
        profiles={profiles}
        initialType={type || ""}
        initialSearch={q || ""}
      />
    </div>
  );
}
