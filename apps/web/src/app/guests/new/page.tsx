import { GuestForm } from "./guest-form";

export default function NewGuestPage() {
  return (
    <main className="p-8">
      <a href="/guests" className="text-blue-600 hover:underline text-sm">
        &larr; Back to guests
      </a>
      <h1 className="text-2xl font-bold mt-4 mb-6">New Guest</h1>
      <GuestForm />
    </main>
  );
}
