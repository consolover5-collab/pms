import Link from "next/link";

type HelpTopic = {
  id: string;
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  icon: string;
};

const helpTopics: HelpTopic[] = [
  {
    id: "quick-start",
    titleRu: "Быстрый старт",
    titleEn: "Quick Start",
    descriptionRu: "Начало работы с системой",
    descriptionEn: "Getting started with the system",
    icon: "🚀",
  },
  {
    id: "dashboard",
    titleRu: "Dashboard",
    titleEn: "Dashboard",
    descriptionRu: "Главный экран и House Status",
    descriptionEn: "Main screen and House Status",
    icon: "📊",
  },
  {
    id: "bookings",
    titleRu: "Бронирования",
    titleEn: "Bookings",
    descriptionRu: "Создание и управление бронированиями",
    descriptionEn: "Creating and managing reservations",
    icon: "📅",
  },
  {
    id: "check-in-out",
    titleRu: "Заезд и выезд",
    titleEn: "Check-in / Check-out",
    descriptionRu: "Заселение и выселение гостей",
    descriptionEn: "Guest arrival and departure procedures",
    icon: "🔑",
  },
  {
    id: "rooms",
    titleRu: "Номера",
    titleEn: "Rooms",
    descriptionRu: "Управление номерным фондом",
    descriptionEn: "Room inventory management",
    icon: "🛏️",
  },
  {
    id: "guests",
    titleRu: "Гости",
    titleEn: "Guests",
    descriptionRu: "Профили гостей",
    descriptionEn: "Guest profiles",
    icon: "👤",
  },
  {
    id: "folio",
    titleRu: "Фолио / Касса",
    titleEn: "Folio / Cashiering",
    descriptionRu: "Начисления, платежи и баланс гостя",
    descriptionEn: "Charges, payments and guest balance",
    icon: "💳",
  },
  {
    id: "night-audit",
    titleRu: "Ночной аудит",
    titleEn: "Night Audit",
    descriptionRu: "Закрытие бизнес-дня и начисление проживания",
    descriptionEn: "End-of-day processing and room charge posting",
    icon: "🌙",
  },
  {
    id: "configuration",
    titleRu: "Конфигурация",
    titleEn: "Configuration",
    descriptionRu: "Настройка системы",
    descriptionEn: "System settings",
    icon: "⚙️",
  },
];

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  // Read language from URL searchParams
  const { lang: langParam } = await searchParams;
  const lang = langParam === "en" ? "en" : "ru";

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← {lang === "ru" ? "Назад" : "Back"}
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            {lang === "ru" ? "Справка" : "Help"}
          </h1>
          <p className="text-gray-600">
            {lang === "ru"
              ? "Руководство пользователя PMS"
              : "PMS User Guide"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/help?lang=ru"
            className={`px-3 py-1 rounded ${lang === "ru" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            RU
          </Link>
          <Link
            href="/help?lang=en"
            className={`px-3 py-1 rounded ${lang === "en" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            EN
          </Link>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h2 className="font-semibold text-blue-800 mb-2">
          {lang === "ru" ? "Быстрые ссылки" : "Quick Links"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/bookings?view=arrivals" className="text-blue-600 hover:underline text-sm">
            {lang === "ru" ? "Заезды сегодня" : "Arrivals Today"}
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/bookings?view=departures" className="text-blue-600 hover:underline text-sm">
            {lang === "ru" ? "Выезды сегодня" : "Departures Today"}
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/rooms?hk=dirty" className="text-blue-600 hover:underline text-sm">
            {lang === "ru" ? "Грязные номера" : "Dirty Rooms"}
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/bookings/new" className="text-blue-600 hover:underline text-sm">
            {lang === "ru" ? "Новое бронирование" : "New Booking"}
          </Link>
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {helpTopics.map((topic) => (
          <Link
            key={topic.id}
            href={`/help/${topic.id}?lang=${lang}`}
            className="block p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{topic.icon}</span>
              <div>
                <h3 className="font-semibold">
                  {lang === "ru" ? topic.titleRu : topic.titleEn}
                </h3>
                <p className="text-sm text-gray-600">
                  {lang === "ru" ? topic.descriptionRu : topic.descriptionEn}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Status Reference */}
      <div className="mt-8 bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-4">
          {lang === "ru" ? "Справочник статусов" : "Status Reference"}
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {lang === "ru" ? "Статусы бронирования" : "Booking Statuses"}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>Confirmed - {lang === "ru" ? "Подтверждено" : "Confirmed"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>Checked In - {lang === "ru" ? "Заселён" : "Checked In"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <span>Checked Out - {lang === "ru" ? "Выселен" : "Checked Out"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>Cancelled - {lang === "ru" ? "Отменено" : "Cancelled"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span>No Show - {lang === "ru" ? "Неявка" : "No Show"}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {lang === "ru" ? "Статусы номеров" : "Room Statuses"}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>Clean - {lang === "ru" ? "Чистый" : "Clean"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>Dirty - {lang === "ru" ? "Грязный" : "Dirty"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>Inspected - {lang === "ru" ? "Проверен" : "Inspected"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-700 rounded-full"></span>
                <span>Out of Order - {lang === "ru" ? "Не работает" : "Out of Order"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
