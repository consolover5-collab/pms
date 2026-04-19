import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { SearchForm } from "./search-form";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  gender: string | null;
  vipStatus: string | null;
};

type GuestsResponse = {
  data: Guest[];
  total: number;
};

const PAGE_SIZE = 50;

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  params.set("propertyId", "ff1d9135-dfb9-4baa-be46-0e739cd26dad");
  params.set("type", "individual");
  if (q) params.set("q", q);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  let result: GuestsResponse;
  try {
    result = await apiFetch<GuestsResponse>(`/api/profiles?${params.toString()}`);
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

  const { data: guests, total } = result;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const vipBadge = (level: string) => {
    const map: Record<string, string> = {
      VIP: "bg-red-100 text-red-800",
      GOLD: "bg-yellow-100 text-yellow-800",
      SILVER: "bg-gray-200 text-gray-800",
    };
    return map[level] || "bg-gray-100 text-gray-700";
  };

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/guests${qs ? `?${qs}` : ""}`;
  }

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
          Results for &quot;{q}&quot;: {total} found
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
                    {guest.lastName || guest.name}, {guest.firstName}
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
                      {guest.vipStatus}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of{" "}
            {total}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                href={pageUrl(currentPage - 1)}
                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
              >
                Previous
              </Link>
            ) : (
              <span className="px-3 py-1 text-sm bg-gray-50 text-gray-400 rounded">
                Previous
              </span>
            )}
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={pageUrl(currentPage + 1)}
                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
              >
                Next
              </Link>
            ) : (
              <span className="px-3 py-1 text-sm bg-gray-50 text-gray-400 rounded">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
