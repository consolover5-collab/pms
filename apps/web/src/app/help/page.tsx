import Link from "next/link";
import { getLocale, getDict, t } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/locales/en";

type HelpTopic = {
  id: string;
  icon: string;
};

const helpTopics: HelpTopic[] = [
  { id: "quick-start", icon: "🚀" },
  { id: "dashboard", icon: "📊" },
  { id: "bookings", icon: "📅" },
  { id: "check-in-out", icon: "🔑" },
  { id: "rooms", icon: "🛏️" },
  { id: "guests", icon: "👤" },
  { id: "folio", icon: "💳" },
  { id: "night-audit", icon: "🌙" },
  { id: "configuration", icon: "⚙️" },
];

export default async function HelpPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← {t(dict, "help.back")}
          </Link>
          <h1 data-testid="help-hub-title" className="text-3xl font-bold mt-2">
            {t(dict, "help.title")}
          </h1>
          <p data-testid="help-hub-subtitle" className="text-gray-600">
            {t(dict, "help.subtitle")}
          </p>
        </div>
      </div>

      {/* Quick Reference */}
      <div data-testid="help-quick-links" className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h2 className="font-semibold text-blue-800 mb-2">
          {t(dict, "help.quickLinks")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link data-testid="help-quick-link-arrivals" href="/bookings?view=arrivals" className="text-blue-600 hover:underline text-sm">
            {t(dict, "help.arrivalsToday")}
          </Link>
          <span className="text-gray-300">|</span>
          <Link data-testid="help-quick-link-departures" href="/bookings?view=departures" className="text-blue-600 hover:underline text-sm">
            {t(dict, "help.departuresToday")}
          </Link>
          <span className="text-gray-300">|</span>
          <Link data-testid="help-quick-link-dirty-rooms" href="/rooms?hk=dirty" className="text-blue-600 hover:underline text-sm">
            {t(dict, "help.dirtyRooms")}
          </Link>
          <span className="text-gray-300">|</span>
          <Link data-testid="help-quick-link-new-booking" href="/bookings/new" className="text-blue-600 hover:underline text-sm">
            {t(dict, "help.newBooking")}
          </Link>
        </div>
      </div>

      {/* Topics Grid */}
      <div data-testid="help-topics-grid" className="grid md:grid-cols-2 gap-4">
        {helpTopics.map((topic) => (
          <Link
            key={topic.id}
            data-testid="help-topic-card"
            data-topic-id={topic.id}
            href={`/help/${topic.id}`}
            className="block p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <span data-testid="help-topic-card-icon" className="text-2xl">{topic.icon}</span>
              <div>
                <h3 data-testid="help-topic-card-title" className="font-semibold">
                  {t(dict, `help.topic.${topic.id}.title` as DictionaryKey)}
                </h3>
                <p data-testid="help-topic-card-desc" className="text-sm text-gray-600">
                  {t(dict, `help.topic.${topic.id}.desc` as DictionaryKey)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Status Reference */}
      <div data-testid="help-status-reference" className="mt-8 bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-4">
          {t(dict, "help.statusReference")}
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div data-testid="help-booking-statuses">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {t(dict, "help.bookingStatuses")}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>Confirmed - {t(dict, "help.status.confirmed")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>Checked In - {t(dict, "help.status.checkedIn")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <span>Checked Out - {t(dict, "help.status.checkedOut")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>Cancelled - {t(dict, "help.status.cancelled")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span>No Show - {t(dict, "help.status.noShow")}</span>
              </div>
            </div>
          </div>

          <div data-testid="help-room-statuses">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {t(dict, "help.roomStatuses")}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>Clean - {t(dict, "help.status.clean")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>Dirty - {t(dict, "help.status.dirty")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>Inspected - {t(dict, "help.status.inspected")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-700 rounded-full"></span>
                <span>Out of Order - {t(dict, "help.status.outOfOrder")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
