import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { SearchForm } from "./search-form";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  gender: string | null;
  vipStatus: number | null;
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const queryStr = q ? `?q=${encodeURIComponent(q)}` : "";

  let guests: Guest[];
  try {
    guests = await apiFetch<Guest[]>(`/api/guests${queryStr}`);
  } catch (err) {
    return (
      <main className="p-8">
        <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-800">
            Failed to load guests
          </h2>
          <p className="text-red-700 text-sm mt-1">
            {err instanceof Error ? err.message : "Could not connect to API"}
          </p>
          <Link
            href="/guests"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Retry
          </Link>
        </div>
      </main>
    );
  }

  const vipBadge = (level: number) => {
    const colors = [
      "",
      "bg-yellow-100 text-yellow-800",
      "bg-yellow-200 text-yellow-900",
      "bg-orange-100 text-orange-800",
      "bg-orange-200 text-orange-900",
      "bg-red-100 text-red-800",
    ];
    return colors[level] || "";
  };

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Guests</h1>
        <Link
          href="/guests/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + New Guest
        </Link>
      </div>

      <SearchForm />

      {q && (
        <p className="text-sm text-gray-500 mb-4">
          Results for &quot;{q}&quot;: {guests.length} found
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Nationality</th>
              <th className="p-2">VIP</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <Link
                    href={`/guests/${guest.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {guest.lastName}, {guest.firstName}
                  </Link>
                </td>
                <td className="p-2 text-gray-600">{guest.email || "\u2014"}</td>
                <td className="p-2 text-gray-600">{guest.phone || "\u2014"}</td>
                <td className="p-2">{guest.nationality || "\u2014"}</td>
                <td className="p-2">
                  {guest.vipStatus ? (
                    <span
                      className={`text-xs px-2 py-1 rounded ${vipBadge(guest.vipStatus)}`}
                    >
                      VIP {guest.vipStatus}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  {q ? "No guests found" : "No guests yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
