import Link from "next/link";
import { notFound } from "next/navigation";

type HelpContent = {
  titleRu: string;
  titleEn: string;
  contentRu: React.ReactNode;
  contentEn: React.ReactNode;
};

const helpContent: Record<string, HelpContent> = {
  "quick-start": {
    titleRu: "Быстрый старт",
    titleEn: "Quick Start",
    contentRu: (
      <div className="prose max-w-none">
        <h2>Первый вход в систему</h2>
        <ol>
          <li>Откройте браузер и перейдите по адресу системы</li>
          <li>Вы увидите <strong>Dashboard</strong> с информацией о текущем состоянии отеля</li>
        </ol>

        <h2>Основные действия</h2>

        <h3>Создать бронирование</h3>
        <ol>
          <li>Нажмите <strong>Bookings</strong> на главной странице</li>
          <li>Нажмите <strong>+ New Booking</strong></li>
          <li>Заполните форму (гость, тип номера, даты)</li>
          <li>Нажмите <strong>Create Booking</strong></li>
        </ol>

        <h3>Заселить гостя</h3>
        <ol>
          <li>Перейдите в <strong>Bookings → Arrivals Today</strong></li>
          <li>Найдите бронирование</li>
          <li>Назначьте номер (если не назначен)</li>
          <li>Нажмите <strong>Check In</strong></li>
        </ol>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Важно:</strong> Номер должен быть чистым (Clean) и свободным (Vacant)
        </div>

        <h3>Выселить гостя</h3>
        <ol>
          <li>Перейдите в <strong>Bookings → Departures Today</strong></li>
          <li>Найдите бронирование</li>
          <li>Нажмите <strong>Check Out</strong></li>
        </ol>

        <h3>Пометить номер чистым</h3>
        <ol>
          <li>Перейдите в <strong>Rooms</strong></li>
          <li>Найдите грязный номер (красная метка)</li>
          <li>Кликните на номер</li>
          <li>Нажмите <strong>Mark Clean</strong></li>
        </ol>

        <h2>Цветовая индикация</h2>
        <table>
          <thead>
            <tr><th>Цвет</th><th>Бронирование</th><th>Номер</th></tr>
          </thead>
          <tbody>
            <tr><td>🔵 Синий</td><td>Confirmed</td><td>Occupied / Inspected</td></tr>
            <tr><td>🟢 Зелёный</td><td>Checked In</td><td>Clean</td></tr>
            <tr><td>🔴 Красный</td><td>Cancelled</td><td>Dirty</td></tr>
            <tr><td>⚪ Серый</td><td>Checked Out</td><td>-</td></tr>
            <tr><td>🟡 Жёлтый</td><td>No Show</td><td>Pickup</td></tr>
          </tbody>
        </table>
      </div>
    ),
    contentEn: (
      <div className="prose max-w-none">
        <h2>First Login</h2>
        <ol>
          <li>Open your browser and navigate to the system URL</li>
          <li>You will see the <strong>Dashboard</strong> with current hotel status</li>
        </ol>

        <h2>Basic Operations</h2>

        <h3>Create a Booking</h3>
        <ol>
          <li>Click <strong>Bookings</strong> on the main page</li>
          <li>Click <strong>+ New Booking</strong></li>
          <li>Fill in the form (guest, room type, dates)</li>
          <li>Click <strong>Create Booking</strong></li>
        </ol>

        <h3>Check In a Guest</h3>
        <ol>
          <li>Go to <strong>Bookings → Arrivals Today</strong></li>
          <li>Find the reservation</li>
          <li>Assign a room (if not assigned)</li>
          <li>Click <strong>Check In</strong></li>
        </ol>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Important:</strong> Room must be Clean and Vacant
        </div>

        <h3>Check Out a Guest</h3>
        <ol>
          <li>Go to <strong>Bookings → Departures Today</strong></li>
          <li>Find the reservation</li>
          <li>Click <strong>Check Out</strong></li>
        </ol>

        <h3>Mark Room as Clean</h3>
        <ol>
          <li>Go to <strong>Rooms</strong></li>
          <li>Find the dirty room (red badge)</li>
          <li>Click on the room</li>
          <li>Click <strong>Mark Clean</strong></li>
        </ol>

        <h2>Color Coding</h2>
        <table>
          <thead>
            <tr><th>Color</th><th>Booking</th><th>Room</th></tr>
          </thead>
          <tbody>
            <tr><td>🔵 Blue</td><td>Confirmed</td><td>Occupied / Inspected</td></tr>
            <tr><td>🟢 Green</td><td>Checked In</td><td>Clean</td></tr>
            <tr><td>🔴 Red</td><td>Cancelled</td><td>Dirty</td></tr>
            <tr><td>⚪ Gray</td><td>Checked Out</td><td>-</td></tr>
            <tr><td>🟡 Yellow</td><td>No Show</td><td>Pickup</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  "check-in-out": {
    titleRu: "Заезд и выезд",
    titleEn: "Check-in / Check-out",
    contentRu: (
      <div className="prose max-w-none">
        <h2>Check-in (Заселение)</h2>

        <h3>Требования для заселения</h3>
        <ul>
          <li>✅ Статус бронирования = <strong>Confirmed</strong></li>
          <li>✅ Номер назначен</li>
          <li>✅ Номер чистый (<strong>Clean</strong> или <strong>Inspected</strong>)</li>
          <li>✅ Номер свободен (<strong>Vacant</strong>)</li>
          <li>✅ Тип номера соответствует бронированию</li>
        </ul>

        <h3>Процедура заселения</h3>
        <ol>
          <li>Перейдите в <strong>Bookings → Arrivals Today</strong></li>
          <li>Найдите бронирование гостя</li>
          <li>Убедитесь, что номер назначен и готов</li>
          <li>Нажмите <strong>Check In</strong></li>
        </ol>

        <h3>Что происходит при Check-in</h3>
        <table>
          <tbody>
            <tr><td>Статус бронирования</td><td>confirmed → checked_in</td></tr>
            <tr><td>Время заезда</td><td>Записывается текущее время</td></tr>
            <tr><td>Статус номера</td><td>vacant → occupied</td></tr>
          </tbody>
        </table>

        <hr />

        <h2>Check-out (Выселение)</h2>

        <h3>Требования</h3>
        <ul>
          <li>✅ Статус бронирования = <strong>Checked In</strong></li>
        </ul>

        <h3>Процедура выселения</h3>
        <ol>
          <li>Перейдите в <strong>Bookings → Departures Today</strong></li>
          <li>Найдите бронирование</li>
          <li>Нажмите <strong>Check Out</strong></li>
        </ol>

        <h3>Что происходит при Check-out</h3>
        <table>
          <tbody>
            <tr><td>Статус бронирования</td><td>checked_in → checked_out</td></tr>
            <tr><td>Время выезда</td><td>Записывается текущее время</td></tr>
            <tr><td>Занятость номера</td><td>occupied → vacant</td></tr>
            <tr><td>Статус уборки</td><td>любой → dirty</td></tr>
          </tbody>
        </table>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Важно:</strong> После выселения номер автоматически становится грязным и требует уборки.
        </div>
      </div>
    ),
    contentEn: (
      <div className="prose max-w-none">
        <h2>Check-in</h2>

        <h3>Requirements for Check-in</h3>
        <ul>
          <li>✅ Booking status = <strong>Confirmed</strong></li>
          <li>✅ Room is assigned</li>
          <li>✅ Room is clean (<strong>Clean</strong> or <strong>Inspected</strong>)</li>
          <li>✅ Room is vacant (<strong>Vacant</strong>)</li>
          <li>✅ Room type matches the booking</li>
        </ul>

        <h3>Check-in Procedure</h3>
        <ol>
          <li>Go to <strong>Bookings → Arrivals Today</strong></li>
          <li>Find the guest&apos;s reservation</li>
          <li>Ensure room is assigned and ready</li>
          <li>Click <strong>Check In</strong></li>
        </ol>

        <h3>What Happens at Check-in</h3>
        <table>
          <tbody>
            <tr><td>Booking status</td><td>confirmed → checked_in</td></tr>
            <tr><td>Check-in time</td><td>Current time is recorded</td></tr>
            <tr><td>Room status</td><td>vacant → occupied</td></tr>
          </tbody>
        </table>

        <hr />

        <h2>Check-out</h2>

        <h3>Requirements</h3>
        <ul>
          <li>✅ Booking status = <strong>Checked In</strong></li>
        </ul>

        <h3>Check-out Procedure</h3>
        <ol>
          <li>Go to <strong>Bookings → Departures Today</strong></li>
          <li>Find the reservation</li>
          <li>Click <strong>Check Out</strong></li>
        </ol>

        <h3>What Happens at Check-out</h3>
        <table>
          <tbody>
            <tr><td>Booking status</td><td>checked_in → checked_out</td></tr>
            <tr><td>Check-out time</td><td>Current time is recorded</td></tr>
            <tr><td>Room occupancy</td><td>occupied → vacant</td></tr>
            <tr><td>Housekeeping status</td><td>any → dirty</td></tr>
          </tbody>
        </table>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Important:</strong> After check-out, the room automatically becomes dirty and requires cleaning.
        </div>
      </div>
    ),
  },
};

// Add more topics as needed...
const defaultContent: HelpContent = {
  titleRu: "Тема не найдена",
  titleEn: "Topic not found",
  contentRu: <p>Содержимое этой темы находится в разработке.</p>,
  contentEn: <p>This topic content is under development.</p>,
};

export default async function HelpTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { topic } = await params;
  const { lang = "ru" } = await searchParams;

  const content = helpContent[topic] || defaultContent;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href={`/help?lang=${lang}`} className="text-blue-600 hover:underline text-sm">
            ← {lang === "ru" ? "Назад к справке" : "Back to Help"}
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {lang === "ru" ? content.titleRu : content.titleEn}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/help/${topic}?lang=ru`}
            className={`px-3 py-1 rounded ${lang === "ru" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            RU
          </Link>
          <Link
            href={`/help/${topic}?lang=en`}
            className={`px-3 py-1 rounded ${lang === "en" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            EN
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        {lang === "ru" ? content.contentRu : content.contentEn}
      </div>
    </main>
  );
}
