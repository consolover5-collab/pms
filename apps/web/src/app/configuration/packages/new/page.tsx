import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { PackageForm } from "../package-form";

export default async function NewPackagePage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  const transactionCodes = propertyId 
    ? await apiFetch<any[]>(`/api/transaction-codes?propertyId=${propertyId}`)
    : [];

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href="/configuration/packages"
        className="text-blue-600 hover:underline text-sm"
      >
        &larr; Back to Packages
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">New Package</h1>

      <PackageForm 
        propertyId={propertyId} 
        transactionCodes={transactionCodes} 
        ratePlans={[]} 
      />
    </main>
  );
}
