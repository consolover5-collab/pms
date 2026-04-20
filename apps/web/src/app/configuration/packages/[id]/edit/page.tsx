import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { PackageForm } from "../../package-form";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  const [pkg, transactionCodes, ratePlans, linkedRatePlansData] = await Promise.all([
    apiFetch<any>(`/api/packages/${id}`),
    propertyId ? apiFetch<any[]>(`/api/transaction-codes?propertyId=${propertyId}`) : [],
    propertyId ? apiFetch<any[]>(`/api/rate-plans?propertyId=${propertyId}`) : [],
    apiFetch<{ data: any[] }>(`/api/packages/${id}/rate-plans`),
  ]);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration/packages" label="Back to Packages" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Package: {pkg.name}</h1>

      <PackageForm 
        pkg={pkg}
        propertyId={propertyId}
        transactionCodes={transactionCodes}
        ratePlans={ratePlans}
        linkedRatePlans={linkedRatePlansData.data}
        isEdit 
      />
    </main>
  );
}
