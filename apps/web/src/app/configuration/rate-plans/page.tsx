import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { RatePlansList } from "./rate-plans-list";

type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export default async function RatePlansPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const ratePlans = propertyId
    ? await apiFetch<RatePlan[]>(`/api/rate-plans?propertyId=${propertyId}`)
    : [];

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration" label="Back to Configuration" />
          <h1 className="text-2xl font-bold mt-2">Rate Plans</h1>
        </div>
        <Link
          href="/configuration/rate-plans/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Rate Plan
        </Link>
      </div>

      <RatePlansList ratePlans={ratePlans} propertyId={propertyId ?? ""} />
    </main>
  );
}
