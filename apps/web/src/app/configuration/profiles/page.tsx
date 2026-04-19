import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
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
  const { type, q } = await searchParams;
  const params = new URLSearchParams();
  params.set("propertyId", "ff1d9135-dfb9-4baa-be46-0e739cd26dad");
  if (type) params.set("type", type);
  if (q) params.set("q", q);

  const url = `/api/profiles?${params.toString()}`;
  const result = await apiFetch<{ data: Profile[]; total: number }>(url);
  const profiles = result.data;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration" label="Back to Configuration" />
          <h1 className="text-2xl font-bold mt-2">Profiles</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/configuration/profiles/new?type=individual"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Add Guest
          </Link>
          <Link
            href="/configuration/profiles/new?type=company"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            Add Company
          </Link>
          <Link
            href="/configuration/profiles/new?type=travel_agent"
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
          >
            Add Agent
          </Link>
          <Link
            href="/configuration/profiles/new?type=source"
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 text-sm"
          >
            Add Source
          </Link>
        </div>
      </div>

      <ProfilesList
        profiles={profiles}
        initialType={type || ""}
        initialSearch={q || ""}
      />
    </main>
  );
}
