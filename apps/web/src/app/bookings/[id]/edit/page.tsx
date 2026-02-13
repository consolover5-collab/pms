import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { BookingEditForm } from "./booking-edit-form";

type Booking = {
  id: string;
  propertyId: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  adults: number;
  children: number;
  rateAmount: string | null;
  totalAmount: string | null;
  paymentMethod: string | null;
  notes: string | null;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string; roomNumber: string } | null;
  roomType: { id: string; name: string; code: string };
  ratePlan: { id: string; name: string; code: string } | null;
};

type Property = { id: string; name: string };

export default async function BookingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [booking, properties] = await Promise.all([
    apiFetch<Booking>(`/api/bookings/${id}`),
    apiFetch<Property[]>("/api/properties"),
  ]);

  const property = properties[0];
  if (!property) {
    return <main className="p-8"><h1 className="text-2xl font-bold">No property configured</h1></main>;
  }

  return (
    <main className="p-8">
      <BackButton fallbackHref={`/bookings/${booking.id}`} label="Back to booking" />
      <h1 className="text-2xl font-bold mt-4 mb-6">Edit Booking #{booking.confirmationNumber}</h1>
      <BookingEditForm booking={{ ...booking, propertyId: property.id }} propertyId={property.id} />
    </main>
  );
}
