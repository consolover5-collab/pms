import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { BookingForm } from "./booking-form";

type Property = {
  id: string;
  name: string;
};

export default async function NewBookingPage() {
  const properties = await apiFetch<Property[]>("/api/properties");
  const property = properties[0];

  if (!property) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">No property configured</h1>
      </main>
    );
  }

  return (
    <main className="p-8">
      <Link href="/bookings" className="text-blue-600 hover:underline text-sm">
        ← Back to bookings
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">New Booking</h1>
      <BookingForm propertyId={property.id} />
    </main>
  );
}
