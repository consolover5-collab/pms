import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RatePlanForm } from "../../rate-plan-form";

type RatePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseRate: string | null;
  isActive: boolean;
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

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href="/configuration/rate-plans"
        className="text-blue-600 hover:underline text-sm"
      >
        &larr; Back to Rate Plans
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Rate Plan: {ratePlan.name}</h1>

      <RatePlanForm
        ratePlan={{
          id: ratePlan.id,
          code: ratePlan.code,
          name: ratePlan.name,
          description: ratePlan.description || "",
          baseRate: ratePlan.baseRate || "",
          isActive: ratePlan.isActive,
        }}
        propertyId={propertyId}
        isEdit
      />
    </main>
  );
}
