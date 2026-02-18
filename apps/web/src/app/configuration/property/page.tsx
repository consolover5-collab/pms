import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { PropertyForm } from "./property-form";

type Property = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfRooms: number | null;
  numberOfFloors: number | null;
  taxRate: string | null;
};

export default async function PropertySettingsPage() {
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration" label="Back to Configuration" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Property Settings</h1>

      <PropertyForm property={property} />
    </main>
  );
}
