import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { PackagesList } from "./packages-list";

type Package = {
  id: string;
  code: string;
  name: string;
  amount: string;
  calculationRule: string;
  postingRhythm: string;
  isActive: boolean;
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;

  let packages: Package[] = [];
  if (propertyId) {
    const url = q ? `/api/packages?propertyId=${propertyId}&q=${encodeURIComponent(q)}` : `/api/packages?propertyId=${propertyId}`;
    const res = await apiFetch<{ data: Package[] }>(url);
    packages = res.data;
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration" label="Back to Configuration" />
          <h1 className="text-2xl font-bold mt-2">Packages</h1>
        </div>
        <Link
          href="/configuration/packages/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Package
        </Link>
      </div>

      <PackagesList packages={packages} initialSearch={q || ""} />
    </main>
  );
}
