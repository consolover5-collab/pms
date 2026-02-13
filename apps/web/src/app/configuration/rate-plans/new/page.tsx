import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RatePlanForm } from "../rate-plan-form";

export default async function NewRatePlanPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href="/configuration/rate-plans"
        className="text-blue-600 hover:underline text-sm"
      >
        &larr; Back to Rate Plans
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">New Rate Plan</h1>

      <RatePlanForm propertyId={propertyId} />
    </main>
  );
}
