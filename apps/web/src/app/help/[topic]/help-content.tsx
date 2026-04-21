import React from "react";

type HelpContent = {
  titleRu: string;
  titleEn: string;
  contentRu: React.ReactNode;
  contentEn: React.ReactNode;
};

export const HelpContentDict: Record<string, HelpContent> = {
  "quick-start": {
    titleRu: "Быстрый старт",
    titleEn: "Quick Start",
    contentRu: (
      <div className="help-prose">
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
          <li>Перейдите в <strong>Bookings &rarr; Arrivals Today</strong></li>
          <li>Найдите бронирование</li>
          <li>Назначьте номер (если не назначен)</li>
          <li>Нажмите <strong>Check In</strong></li>
        </ol>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Важно:</strong> Номер должен быть чистым (Clean) и свободным (Vacant)
        </div>

        <h3>Выселить гостя</h3>
        <ol>
          <li>Перейдите в <strong>Bookings &rarr; Departures Today</strong></li>
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
            <tr><th>Цвет</th><th>Бронирование</th><th>Номер (HK статус)</th></tr>
          </thead>
          <tbody>
            <tr><td>Синий</td><td>Confirmed</td><td>Occupied</td></tr>
            <tr><td>Зелёный</td><td>Checked In</td><td>Inspected</td></tr>
            <tr><td>Голубой (Cyan)</td><td>—</td><td>Clean</td></tr>
            <tr><td>Жёлтый</td><td>No Show</td><td>Pickup</td></tr>
            <tr><td>Красный</td><td>Cancelled</td><td>Dirty</td></tr>
            <tr><td>Серый</td><td>Checked Out</td><td>Out of Order</td></tr>
          </tbody>
        </table>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
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
          <li>Go to <strong>Bookings &rarr; Arrivals Today</strong></li>
          <li>Find the reservation</li>
          <li>Assign a room (if not assigned)</li>
          <li>Click <strong>Check In</strong></li>
        </ol>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Important:</strong> Room must be Clean and Vacant
        </div>

        <h3>Check Out a Guest</h3>
        <ol>
          <li>Go to <strong>Bookings &rarr; Departures Today</strong></li>
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
            <tr><th>Color</th><th>Booking</th><th>Room (HK status)</th></tr>
          </thead>
          <tbody>
            <tr><td>Blue</td><td>Confirmed</td><td>Occupied</td></tr>
            <tr><td>Green</td><td>Checked In</td><td>Inspected</td></tr>
            <tr><td>Cyan</td><td>—</td><td>Clean</td></tr>
            <tr><td>Yellow</td><td>No Show</td><td>Pickup</td></tr>
            <tr><td>Red</td><td>Cancelled</td><td>Dirty</td></tr>
            <tr><td>Gray</td><td>Checked Out</td><td>Out of Order</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },

  dashboard: {
    titleRu: "Dashboard",
    titleEn: "Dashboard",
    contentRu: (
      <div className="help-prose">
        <h2>Главный экран</h2>
        <p>
          Dashboard &mdash; стартовая страница системы. Показывает состояние отеля
          на текущий <strong>бизнес-день</strong>.
        </p>

        <h3>Бизнес-дата</h3>
        <p>
          Отображается вверху страницы. Бизнес-дата меняется только после
          выполнения <strong>Night Audit</strong>, а не в полночь.
          Все операции за смену привязаны к этой дате.
        </p>

        <h3>Карточки номерного фонда</h3>
        <p>Верхняя панель показывает сводку по номерам:</p>
        <ul>
          <li><strong>Occupied / Total</strong> &mdash; занято номеров и процент загрузки</li>
          <li><strong>Vacant</strong> &mdash; свободные номера</li>
          <li><strong>Dirty</strong> &mdash; номера, требующие уборки (кликните для перехода в Rooms)</li>
          <li><strong>Clean</strong> &mdash; чистые номера, готовые к заселению</li>
          <li><strong>Inspected</strong> &mdash; проверенные супервайзером</li>
        </ul>

        <h3>Заезды (Arrivals)</h3>
        <p>
          Список бронирований с заездом сегодня. Показаны имя гостя,
          номер подтверждения, тип номера и назначенный номер.
          Кликните на бронирование для перехода к деталям и check-in.
        </p>

        <h3>Выезды (Departures)</h3>
        <p>
          Список гостей с выездом сегодня. Кликните на бронирование
          для перехода к check-out.
        </p>

        <h3>Гости в отеле (In-House)</h3>
        <p>
          Все заселённые гости с номерами комнат и датой выезда.
        </p>

        <h3>Рабочий процесс начала смены</h3>
        <ol>
          <li>Откройте Dashboard</li>
          <li>Проверьте количество заездов и выездов</li>
          <li>Проверьте количество грязных номеров &mdash; передайте в хаускипинг</li>
          <li>Просмотрите список In-House на предмет выездов с задержкой</li>
        </ol>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>Main Screen</h2>
        <p>
          The Dashboard is the system&apos;s home page. It shows the hotel status
          for the current <strong>business date</strong>.
        </p>

        <h3>Business Date</h3>
        <p>
          Displayed at the top of the page. The business date only changes
          after running <strong>Night Audit</strong>, not at midnight.
          All shift operations are tied to this date.
        </p>

        <h3>Room Summary Cards</h3>
        <p>The top panel shows a room overview:</p>
        <ul>
          <li><strong>Occupied / Total</strong> &mdash; occupied rooms and occupancy percentage</li>
          <li><strong>Vacant</strong> &mdash; available rooms</li>
          <li><strong>Dirty</strong> &mdash; rooms needing cleaning (click to go to Rooms)</li>
          <li><strong>Clean</strong> &mdash; clean rooms ready for check-in</li>
          <li><strong>Inspected</strong> &mdash; rooms verified by a supervisor</li>
        </ul>

        <h3>Arrivals</h3>
        <p>
          List of bookings arriving today. Shows guest name, confirmation number,
          room type and assigned room. Click a booking to view details and check in.
        </p>

        <h3>Departures</h3>
        <p>
          List of guests departing today. Click a booking to proceed with check-out.
        </p>

        <h3>In-House</h3>
        <p>
          All checked-in guests with room numbers and departure dates.
        </p>

        <h3>Shift Start Workflow</h3>
        <ol>
          <li>Open Dashboard</li>
          <li>Review arrival and departure counts</li>
          <li>Check dirty room count &mdash; notify housekeeping</li>
          <li>Review In-House list for overdue departures</li>
        </ol>
      </div>
    ),
  },

  bookings: {
    titleRu: "Бронирования",
    titleEn: "Bookings",
    contentRu: (
      <div className="help-prose">
        <h2>Список бронирований</h2>
        <p>Страница <strong>Bookings</strong> показывает все бронирования с фильтрацией.</p>

        <h3>Вкладки</h3>
        <ul>
          <li><strong>All</strong> &mdash; все бронирования (с фильтром по датам и статусу)</li>
          <li><strong>Arrivals Today</strong> &mdash; заезды на сегодня</li>
          <li><strong>Departures Today</strong> &mdash; выезды на сегодня</li>
          <li><strong>In-House</strong> &mdash; гости в отеле</li>
        </ul>

        <h3>Фильтры статуса</h3>
        <table>
          <thead>
            <tr><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Confirmed</strong></td><td>Подтверждено, ожидает заезда</td></tr>
            <tr><td><strong>Checked In</strong></td><td>Гость заселён</td></tr>
            <tr><td><strong>Checked Out</strong></td><td>Гость выехал</td></tr>
            <tr><td><strong>Cancelled</strong></td><td>Отменено</td></tr>
            <tr><td><strong>No Show</strong></td><td>Гость не приехал</td></tr>
          </tbody>
        </table>

        <h2>Создание бронирования</h2>
        <ol>
          <li>Нажмите <strong>+ New Booking</strong></li>
          <li>Выберите гостя (или создайте нового)</li>
          <li>Укажите даты заезда и выезда</li>
          <li>Выберите тип номера и тарифный план</li>
          <li>При необходимости назначьте конкретный номер</li>
          <li>Нажмите <strong>Create Booking</strong></li>
        </ol>

        <h2>Детали бронирования</h2>
        <p>Кликните на номер подтверждения для просмотра деталей:</p>
        <ul>
          <li>Информация о госте (имя, email, телефон)</li>
          <li>Даты проживания и количество ночей</li>
          <li>Назначенный номер и тип номера</li>
          <li>Тарифный план и стоимость</li>
          <li>Фолио (начисления и платежи)</li>
        </ul>

        <h3>Доступные действия</h3>
        <table>
          <thead>
            <tr><th>Текущий статус</th><th>Действия</th></tr>
          </thead>
          <tbody>
            <tr><td>Confirmed</td><td>Check In, Cancel, Edit</td></tr>
            <tr><td>Checked In</td><td>Check Out, Edit</td></tr>
            <tr><td>Checked Out</td><td>Только просмотр</td></tr>
            <tr><td>Cancelled</td><td>Только просмотр</td></tr>
          </tbody>
        </table>

        <h2>Редактирование</h2>
        <p>
          Нажмите <strong>Edit Booking</strong> на странице деталей.
          Можно изменить даты, тип номера, назначенный номер, количество гостей и заметки.
        </p>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Важно:</strong> Бронирования в статусе Checked Out и Cancelled нельзя редактировать.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>Booking List</h2>
        <p>The <strong>Bookings</strong> page shows all reservations with filtering.</p>

        <h3>Tabs</h3>
        <ul>
          <li><strong>All</strong> &mdash; all bookings (with date and status filters)</li>
          <li><strong>Arrivals Today</strong> &mdash; today&apos;s arrivals</li>
          <li><strong>Departures Today</strong> &mdash; today&apos;s departures</li>
          <li><strong>In-House</strong> &mdash; currently checked-in guests</li>
        </ul>

        <h3>Status Filters</h3>
        <table>
          <thead>
            <tr><th>Status</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Confirmed</strong></td><td>Confirmed, awaiting arrival</td></tr>
            <tr><td><strong>Checked In</strong></td><td>Guest is in-house</td></tr>
            <tr><td><strong>Checked Out</strong></td><td>Guest has departed</td></tr>
            <tr><td><strong>Cancelled</strong></td><td>Cancelled</td></tr>
            <tr><td><strong>No Show</strong></td><td>Guest did not arrive</td></tr>
          </tbody>
        </table>

        <h2>Creating a Booking</h2>
        <ol>
          <li>Click <strong>+ New Booking</strong></li>
          <li>Select a guest (or create a new one)</li>
          <li>Enter check-in and check-out dates</li>
          <li>Choose room type and rate plan</li>
          <li>Optionally assign a specific room</li>
          <li>Click <strong>Create Booking</strong></li>
        </ol>

        <h2>Booking Details</h2>
        <p>Click a confirmation number to view details:</p>
        <ul>
          <li>Guest information (name, email, phone)</li>
          <li>Stay dates and number of nights</li>
          <li>Assigned room and room type</li>
          <li>Rate plan and pricing</li>
          <li>Folio (charges and payments)</li>
        </ul>

        <h3>Available Actions</h3>
        <table>
          <thead>
            <tr><th>Current Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr><td>Confirmed</td><td>Check In, Cancel, Edit</td></tr>
            <tr><td>Checked In</td><td>Check Out, Edit</td></tr>
            <tr><td>Checked Out</td><td>View only</td></tr>
            <tr><td>Cancelled</td><td>View only</td></tr>
          </tbody>
        </table>

        <h2>Editing</h2>
        <p>
          Click <strong>Edit Booking</strong> on the detail page.
          You can change dates, room type, assigned room, guest count, and notes.
        </p>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Important:</strong> Bookings with status Checked Out or Cancelled cannot be edited.
        </div>
      </div>
    ),
  },

  "check-in-out": {
    titleRu: "Заезд и выезд",
    titleEn: "Check-in / Check-out",
    contentRu: (
      <div className="help-prose">
        <h2>Check-in (Заселение)</h2>

        <h3>Требования для заселения</h3>
        <ul>
          <li>Статус бронирования = <strong>Confirmed</strong></li>
          <li>Номер назначен</li>
          <li>Номер чистый (<strong>Clean</strong> или <strong>Inspected</strong>)</li>
          <li>Номер свободен (<strong>Vacant</strong>)</li>
          <li>Тип номера соответствует бронированию</li>
        </ul>

        <h3>Процедура заселения</h3>
        <ol>
          <li>Перейдите в <strong>Bookings &rarr; Arrivals Today</strong></li>
          <li>Найдите бронирование гостя</li>
          <li>Убедитесь, что номер назначен и готов</li>
          <li>Нажмите <strong>Check In</strong></li>
        </ol>

        <h3>Что происходит при Check-in</h3>
        <table>
          <tbody>
            <tr><td>Статус бронирования</td><td>confirmed &rarr; checked_in</td></tr>
            <tr><td>Время заезда</td><td>Записывается текущее время</td></tr>
            <tr><td>Статус номера</td><td>vacant &rarr; occupied</td></tr>
          </tbody>
        </table>

        <hr />

        <h2>Check-out (Выселение)</h2>

        <h3>Требования</h3>
        <ul>
          <li>Статус бронирования = <strong>Checked In</strong></li>
        </ul>

        <h3>Процедура выселения</h3>
        <ol>
          <li>Перейдите в <strong>Bookings &rarr; Departures Today</strong></li>
          <li>Найдите бронирование</li>
          <li>Нажмите <strong>Check Out</strong></li>
        </ol>

        <h3>Что происходит при Check-out</h3>
        <table>
          <tbody>
            <tr><td>Статус бронирования</td><td>checked_in &rarr; checked_out</td></tr>
            <tr><td>Время выезда</td><td>Записывается текущее время</td></tr>
            <tr><td>Занятость номера</td><td>occupied &rarr; vacant</td></tr>
            <tr><td>Статус уборки</td><td>любой &rarr; dirty</td></tr>
          </tbody>
        </table>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
          <strong>Требование к балансу:</strong> Выезд невозможен при положительном балансе фолио. Перед нажатием Check Out убедитесь, что гость оплатил все начисления. Используйте кнопку <strong>Post Payment</strong> в секции Folio.
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Важно:</strong> После выселения номер автоматически становится грязным и требует уборки.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>Check-in</h2>

        <h3>Requirements for Check-in</h3>
        <ul>
          <li>Booking status = <strong>Confirmed</strong></li>
          <li>Room is assigned</li>
          <li>Room is clean (<strong>Clean</strong> or <strong>Inspected</strong>)</li>
          <li>Room is vacant (<strong>Vacant</strong>)</li>
          <li>Room type matches the booking</li>
        </ul>

        <h3>Check-in Procedure</h3>
        <ol>
          <li>Go to <strong>Bookings &rarr; Arrivals Today</strong></li>
          <li>Find the guest&apos;s reservation</li>
          <li>Ensure room is assigned and ready</li>
          <li>Click <strong>Check In</strong></li>
        </ol>

        <h3>What Happens at Check-in</h3>
        <table>
          <tbody>
            <tr><td>Booking status</td><td>confirmed &rarr; checked_in</td></tr>
            <tr><td>Check-in time</td><td>Current time is recorded</td></tr>
            <tr><td>Room status</td><td>vacant &rarr; occupied</td></tr>
          </tbody>
        </table>

        <hr />

        <h2>Check-out</h2>

        <h3>Requirements</h3>
        <ul>
          <li>Booking status = <strong>Checked In</strong></li>
        </ul>

        <h3>Check-out Procedure</h3>
        <ol>
          <li>Go to <strong>Bookings &rarr; Departures Today</strong></li>
          <li>Find the reservation</li>
          <li>Click <strong>Check Out</strong></li>
        </ol>

        <h3>What Happens at Check-out</h3>
        <table>
          <tbody>
            <tr><td>Booking status</td><td>checked_in &rarr; checked_out</td></tr>
            <tr><td>Check-out time</td><td>Current time is recorded</td></tr>
            <tr><td>Room occupancy</td><td>occupied &rarr; vacant</td></tr>
            <tr><td>Housekeeping status</td><td>any &rarr; dirty</td></tr>
          </tbody>
        </table>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
          <strong>Balance requirement:</strong> Check-out is blocked if the folio has an outstanding balance. Ensure all charges are paid before clicking Check Out. Use the <strong>Post Payment</strong> button in the Folio section.
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Important:</strong> After check-out, the room automatically becomes dirty and requires cleaning.
        </div>
      </div>
    ),
  },

  rooms: {
    titleRu: "Номера",
    titleEn: "Rooms",
    contentRu: (
      <div className="help-prose">
        <h2>Управление номерами</h2>
        <p>
          Страница <strong>Rooms</strong> показывает все номера отеля в виде сетки
          по этажам с цветовой индикацией статуса.
        </p>

        <h3>Сводка (верхняя панель)</h3>
        <ul>
          <li><strong>Total</strong> &mdash; общее количество номеров</li>
          <li><strong>Vacant</strong> &mdash; свободные</li>
          <li><strong>Occupied</strong> &mdash; занятые</li>
          <li><strong>Clean</strong> &mdash; чистые</li>
          <li><strong>Dirty</strong> &mdash; грязные</li>
        </ul>

        <h3>Фильтры</h3>
        <p>Можно фильтровать номера по двум измерениям:</p>
        <ul>
          <li><strong>HK (Housekeeping)</strong>: Clean, Dirty, Inspected, Pickup</li>
          <li><strong>Occ (Occupancy)</strong>: Vacant, Occupied</li>
        </ul>

        <h2>Двумерная модель статусов</h2>
        <p>Каждый номер имеет два независимых статуса:</p>

        <h3>Housekeeping (уборка)</h3>
        <table>
          <thead>
            <tr><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Clean</strong></td><td>Убран, готов к заселению</td></tr>
            <tr><td><strong>Dirty</strong></td><td>Требует уборки</td></tr>
            <tr><td><strong>Pickup</strong></td><td>Требует лёгкой уборки (поправка)</td></tr>
            <tr><td><strong>Inspected</strong></td><td>Проверен супервайзером</td></tr>
            <tr><td><strong>Out of Order</strong></td><td>Неисправен, снят с продажи</td></tr>
            <tr><td><strong>Out of Service</strong></td><td>На обслуживании, можно продать при необходимости</td></tr>
          </tbody>
        </table>

        <h3>Occupancy (занятость)</h3>
        <table>
          <thead>
            <tr><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Vacant</strong></td><td>Свободен</td></tr>
            <tr><td><strong>Occupied</strong></td><td>Занят (гость заселён)</td></tr>
          </tbody>
        </table>

        <h2>Рабочий процесс хаускипинга</h2>
        <p>Типичный цикл уборки номера:</p>
        <ol>
          <li>Гость выехал &rarr; номер автоматически становится <strong>Dirty</strong></li>
          <li>Горничная убрала номер &rarr; пометить <strong>Clean</strong></li>
          <li>Супервайзер проверил &rarr; пометить <strong>Inspected</strong> (опционально)</li>
          <li>Номер готов к заселению следующего гостя</li>
        </ol>

        <h3>Смена статуса номера</h3>
        <ol>
          <li>Кликните на номер в сетке</li>
          <li>На странице номера нажмите нужную кнопку: <strong>Mark Clean</strong>, <strong>Mark Dirty</strong> и т.д.</li>
        </ol>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Для заселения</strong> номер должен быть Clean или Inspected и Vacant.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>Room Management</h2>
        <p>
          The <strong>Rooms</strong> page shows all hotel rooms in a grid
          organized by floor with color-coded status indicators.
        </p>

        <h3>Summary (top panel)</h3>
        <ul>
          <li><strong>Total</strong> &mdash; total number of rooms</li>
          <li><strong>Vacant</strong> &mdash; available rooms</li>
          <li><strong>Occupied</strong> &mdash; occupied rooms</li>
          <li><strong>Clean</strong> &mdash; clean rooms</li>
          <li><strong>Dirty</strong> &mdash; dirty rooms</li>
        </ul>

        <h3>Filters</h3>
        <p>You can filter rooms along two dimensions:</p>
        <ul>
          <li><strong>HK (Housekeeping)</strong>: Clean, Dirty, Inspected, Pickup</li>
          <li><strong>Occ (Occupancy)</strong>: Vacant, Occupied</li>
        </ul>

        <h2>Two-Dimensional Status Model</h2>
        <p>Each room has two independent statuses:</p>

        <h3>Housekeeping</h3>
        <table>
          <thead>
            <tr><th>Status</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Clean</strong></td><td>Cleaned, ready for check-in</td></tr>
            <tr><td><strong>Dirty</strong></td><td>Needs cleaning</td></tr>
            <tr><td><strong>Pickup</strong></td><td>Needs light touch-up</td></tr>
            <tr><td><strong>Inspected</strong></td><td>Verified by supervisor</td></tr>
            <tr><td><strong>Out of Order</strong></td><td>Not functional, removed from inventory</td></tr>
            <tr><td><strong>Out of Service</strong></td><td>Under maintenance, can be sold if needed</td></tr>
          </tbody>
        </table>

        <h3>Occupancy</h3>
        <table>
          <thead>
            <tr><th>Status</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Vacant</strong></td><td>Unoccupied</td></tr>
            <tr><td><strong>Occupied</strong></td><td>Guest checked in</td></tr>
          </tbody>
        </table>

        <h2>Housekeeping Workflow</h2>
        <p>Typical room cleaning cycle:</p>
        <ol>
          <li>Guest checks out &rarr; room automatically becomes <strong>Dirty</strong></li>
          <li>Housekeeper cleans the room &rarr; mark as <strong>Clean</strong></li>
          <li>Supervisor inspects &rarr; mark as <strong>Inspected</strong> (optional)</li>
          <li>Room is ready for the next guest</li>
        </ol>

        <h3>Changing Room Status</h3>
        <ol>
          <li>Click on a room in the grid</li>
          <li>On the room page, click the appropriate button: <strong>Mark Clean</strong>, <strong>Mark Dirty</strong>, etc.</li>
        </ol>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>For check-in</strong>, the room must be Clean or Inspected and Vacant.
        </div>
      </div>
    ),
  },

  guests: {
    titleRu: "Гости",
    titleEn: "Guests",
    contentRu: (
      <div className="help-prose">
        <h2>Профили гостей</h2>
        <p>
          Страница <strong>Guests</strong> содержит базу профилей гостей.
          Профиль создаётся один раз и используется для всех бронирований гостя.
        </p>

        <h3>Поиск гостей</h3>
        <p>
          Введите текст в поле поиска &mdash; система ищет по имени, фамилии,
          email и телефону (поиск нечувствителен к регистру).
        </p>

        <h3>Информация в профиле</h3>
        <ul>
          <li><strong>Имя и фамилия</strong> (обязательно)</li>
          <li><strong>Email</strong></li>
          <li><strong>Телефон</strong></li>
          <li><strong>Национальность</strong></li>
          <li><strong>Пол</strong></li>
          <li><strong>Дата рождения</strong></li>
          <li><strong>VIP-статус</strong> (от 1 до 5)</li>
        </ul>

        <h2>Создание нового гостя</h2>
        <ol>
          <li>Нажмите <strong>+ New Guest</strong></li>
          <li>Заполните имя и фамилию (обязательные поля)</li>
          <li>Добавьте контактные данные</li>
          <li>Нажмите <strong>Create Guest</strong></li>
        </ol>

        <h2>Редактирование профиля</h2>
        <ol>
          <li>Найдите гостя через поиск</li>
          <li>Кликните на имя гостя</li>
          <li>Нажмите <strong>Edit</strong></li>
          <li>Измените нужные поля и сохраните</li>
        </ol>

        <h3>VIP-статус</h3>
        <table>
          <thead>
            <tr><th>Уровень</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td>1-2</td><td>Обычный VIP</td></tr>
            <tr><td>3-4</td><td>Важный VIP</td></tr>
            <tr><td>5</td><td>Особый VIP</td></tr>
          </tbody>
        </table>
        <p>VIP-статус отображается цветной меткой в списке гостей.</p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Совет:</strong> При создании бронирования можно выбрать существующего гостя
          из базы или создать нового прямо из формы бронирования.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>Guest Profiles</h2>
        <p>
          The <strong>Guests</strong> page contains the guest profile database.
          A profile is created once and used for all of the guest&apos;s bookings.
        </p>

        <h3>Searching for Guests</h3>
        <p>
          Type in the search field &mdash; the system searches by first name, last name,
          email, and phone (case-insensitive).
        </p>

        <h3>Profile Information</h3>
        <ul>
          <li><strong>First and last name</strong> (required)</li>
          <li><strong>Email</strong></li>
          <li><strong>Phone</strong></li>
          <li><strong>Nationality</strong></li>
          <li><strong>Gender</strong></li>
          <li><strong>Date of birth</strong></li>
          <li><strong>VIP status</strong> (1 to 5)</li>
        </ul>

        <h2>Creating a New Guest</h2>
        <ol>
          <li>Click <strong>+ New Guest</strong></li>
          <li>Fill in first and last name (required fields)</li>
          <li>Add contact details</li>
          <li>Click <strong>Create Guest</strong></li>
        </ol>

        <h2>Editing a Profile</h2>
        <ol>
          <li>Find the guest via search</li>
          <li>Click on the guest&apos;s name</li>
          <li>Click <strong>Edit</strong></li>
          <li>Modify the fields as needed and save</li>
        </ol>

        <h3>VIP Status</h3>
        <table>
          <thead>
            <tr><th>Level</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>1-2</td><td>Regular VIP</td></tr>
            <tr><td>3-4</td><td>Important VIP</td></tr>
            <tr><td>5</td><td>Top VIP</td></tr>
          </tbody>
        </table>
        <p>VIP status is shown as a colored badge in the guest list.</p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Tip:</strong> When creating a booking, you can select an existing guest
          from the database or create a new one directly from the booking form.
        </div>
      </div>
    ),
  },

  folio: {
    titleRu: "Фолио / Касса",
    titleEn: "Folio / Cashiering",
    contentRu: (
      <div className="help-prose">
        <h2>Что такое фолио</h2>
        <p>
          <strong>Фолио</strong> &mdash; это счёт гостя, привязанный к бронированию.
          В нём отражаются все начисления (проживание, услуги) и платежи.
        </p>

        <h3>Где найти фолио</h3>
        <p>
          Откройте детали бронирования (<strong>Bookings &rarr; кликните на бронирование</strong>).
          Секция <strong>Folio</strong> находится внизу страницы.
        </p>

        <h2>Типы операций</h2>
        <table>
          <thead>
            <tr><th>Тип</th><th>Описание</th><th>Влияние на баланс</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Charge</strong></td><td>Начисление (проживание, налог, услуга)</td><td>Увеличивает баланс</td></tr>
            <tr><td><strong>Payment</strong></td><td>Оплата (наличные, карта)</td><td>Уменьшает баланс</td></tr>
          </tbody>
        </table>

        <h3>Добавление начисления</h3>
        <ol>
          <li>В секции Folio нажмите <strong>Post Charge</strong></li>
          <li>Выберите код транзакции (room, tax, minibar и т.д.)</li>
          <li>Введите сумму</li>
          <li>Нажмите <strong>Post</strong></li>
        </ol>

        <h3>Приём платежа</h3>
        <ol>
          <li>В секции Folio нажмите <strong>Post Payment</strong></li>
          <li>Выберите способ оплаты</li>
          <li>Введите сумму</li>
          <li>Нажмите <strong>Post</strong></li>
        </ol>

        <h3>Баланс фолио</h3>
        <p>
          <strong>Баланс = начисления - платежи.</strong> При выезде баланс
          должен быть нулевым (все начисления оплачены).
        </p>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Важно:</strong> Начисления за проживание и налоги
          автоматически создаются во время <strong>Night Audit</strong>.
          Вручную их обычно добавлять не нужно.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>What is a Folio</h2>
        <p>
          A <strong>folio</strong> is a guest&apos;s account linked to a booking.
          It tracks all charges (room, services) and payments.
        </p>

        <h3>Where to Find the Folio</h3>
        <p>
          Open booking details (<strong>Bookings &rarr; click on a booking</strong>).
          The <strong>Folio</strong> section is at the bottom of the page.
        </p>

        <h2>Transaction Types</h2>
        <table>
          <thead>
            <tr><th>Type</th><th>Description</th><th>Balance Effect</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Charge</strong></td><td>Charge (room, tax, service)</td><td>Increases balance</td></tr>
            <tr><td><strong>Payment</strong></td><td>Payment (cash, card)</td><td>Decreases balance</td></tr>
          </tbody>
        </table>

        <h3>Posting a Charge</h3>
        <ol>
          <li>In the Folio section, click <strong>Post Charge</strong></li>
          <li>Select a transaction code (room, tax, minibar, etc.)</li>
          <li>Enter the amount</li>
          <li>Click <strong>Post</strong></li>
        </ol>

        <h3>Accepting a Payment</h3>
        <ol>
          <li>In the Folio section, click <strong>Post Payment</strong></li>
          <li>Select payment method</li>
          <li>Enter the amount</li>
          <li>Click <strong>Post</strong></li>
        </ol>

        <h3>Folio Balance</h3>
        <p>
          <strong>Balance = charges - payments.</strong> At check-out, the balance
          should be zero (all charges are paid).
        </p>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Important:</strong> Room charges and taxes are
          automatically posted during <strong>Night Audit</strong>.
          You usually do not need to post them manually.
        </div>
      </div>
    ),
  },

  "night-audit": {
    titleRu: "Ночной аудит",
    titleEn: "Night Audit",
    contentRu: (
      <div className="help-prose">
        <h2>Что такое Night Audit</h2>
        <p>
          <strong>Night Audit</strong> &mdash; процедура закрытия бизнес-дня.
          Выполняется один раз в сутки, обычно ночью после завершения всех операций.
        </p>

        <h3>Что делает Night Audit</h3>
        <ol>
          <li><strong>No-Show</strong> &mdash; помечает неявившихся гостей (бронирования
            на сегодня со статусом Confirmed)</li>
          <li><strong>Начисление проживания</strong> &mdash; создаёт начисления за
            проживание (room charge) для всех заселённых гостей</li>
          <li><strong>Начисление налогов</strong> &mdash; создаёт налоговые начисления</li>
          <li><strong>Обновление номеров</strong> &mdash; помечает занятые номера как Dirty
            (для уборки на следующий день)</li>
          <li><strong>Смена бизнес-даты</strong> &mdash; переводит дату на следующий день</li>
        </ol>

        <h2>Как запустить</h2>

        <h3>Шаг 1: Предварительный просмотр (Preview)</h3>
        <ol>
          <li>Перейдите на страницу <strong>Night Audit</strong></li>
          <li>Нажмите <strong>Preview Night Audit</strong></li>
          <li>Проверьте данные:
            <ul>
              <li><strong>Rooms to charge</strong> &mdash; номера для начисления</li>
              <li><strong>Estimated revenue</strong> &mdash; ожидаемая выручка</li>
              <li><strong>Pending no-shows</strong> &mdash; потенциальные неявки</li>
              <li><strong>Due-outs</strong> &mdash; не выехавшие вовремя</li>
            </ul>
          </li>
          <li>Обратите внимание на предупреждения (Warnings)</li>
        </ol>

        <h3>Шаг 2: Запуск</h3>
        <ol>
          <li>Убедитесь, что все данные корректны</li>
          <li>Нажмите <strong>Run Night Audit</strong></li>
          <li>Дождитесь завершения</li>
        </ol>

        <h3>Результат</h3>
        <p>После завершения показываются итоги:</p>
        <ul>
          <li>Закрытая дата и новая бизнес-дата</li>
          <li>Количество начислений за проживание и налоги</li>
          <li>Количество no-show</li>
          <li>Общая выручка</li>
          <li>Количество номеров, помеченных как Dirty</li>
        </ul>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
          <strong>Внимание:</strong> Night Audit нельзя отменить.
          Всегда проверяйте Preview перед запуском.
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Рекомендация:</strong> Перед запуском убедитесь, что все
          ожидаемые выезды обработаны, а позднее заезды завершены.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>What is Night Audit</h2>
        <p>
          <strong>Night Audit</strong> is the end-of-day closing procedure.
          It runs once per day, typically at night after all operations are complete.
        </p>

        <h3>What Night Audit Does</h3>
        <ol>
          <li><strong>No-Show</strong> &mdash; marks no-show guests (today&apos;s bookings
            still in Confirmed status)</li>
          <li><strong>Room charges</strong> &mdash; posts room charges
            for all checked-in guests</li>
          <li><strong>Tax charges</strong> &mdash; posts tax charges</li>
          <li><strong>Room updates</strong> &mdash; marks occupied rooms as Dirty
            (for next-day cleaning)</li>
          <li><strong>Date rollover</strong> &mdash; advances the business date to the next day</li>
        </ol>

        <h2>How to Run</h2>

        <h3>Step 1: Preview</h3>
        <ol>
          <li>Go to the <strong>Night Audit</strong> page</li>
          <li>Click <strong>Preview Night Audit</strong></li>
          <li>Review the data:
            <ul>
              <li><strong>Rooms to charge</strong> &mdash; rooms that will be charged</li>
              <li><strong>Estimated revenue</strong> &mdash; expected revenue</li>
              <li><strong>Pending no-shows</strong> &mdash; potential no-shows</li>
              <li><strong>Due-outs</strong> &mdash; guests who have not checked out on time</li>
            </ul>
          </li>
          <li>Pay attention to any warnings</li>
        </ol>

        <h3>Step 2: Run</h3>
        <ol>
          <li>Confirm all data is correct</li>
          <li>Click <strong>Run Night Audit</strong></li>
          <li>Wait for completion</li>
        </ol>

        <h3>Results</h3>
        <p>After completion, the summary shows:</p>
        <ul>
          <li>Closed date and new business date</li>
          <li>Number of room and tax charges posted</li>
          <li>Number of no-shows</li>
          <li>Total revenue</li>
          <li>Number of rooms marked as Dirty</li>
        </ul>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
          <strong>Warning:</strong> Night Audit cannot be undone.
          Always review the Preview before running.
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
          <strong>Recommendation:</strong> Before running, ensure all expected
          departures are processed and late arrivals are completed.
        </div>
      </div>
    ),
  },

  configuration: {
    titleRu: "Конфигурация",
    titleEn: "Configuration",
    contentRu: (
      <div className="help-prose">
        <h2>Настройки системы</h2>
        <p>Раздел <strong>Settings</strong> (Настройки) доступен администраторам и менеджерам.</p>

        <h3>Параметры отеля (Property Settings)</h3>
        <ul>
          <li><strong>Название, код</strong> — название отеля и короткий код (используется в номерах подтверждения, например GBH-000001)</li>
          <li><strong>Адрес, город, страна</strong></li>
          <li><strong>Часовой пояс, валюта</strong></li>
          <li><strong>Время заезда/выезда</strong> — стандартное время check-in и check-out</li>
          <li><strong>Количество номеров/этажей</strong> — справочное значение; нельзя установить меньше реального числа номеров в системе</li>
          <li><strong>Ставка налога (%)</strong> — процент налога, начисляемого на проживание</li>
        </ul>

        <h3>Типы номеров (Room Types)</h3>
        <ul>
          <li>Категории номеров (Standard, Superior, Suite и т.д.)</li>
          <li>Для каждого типа задаётся код, название, максимальная вместимость</li>
          <li>Нельзя удалить тип, если есть связанные номера или бронирования</li>
        </ul>

        <h3>Тарифные планы (Rate Plans)</h3>
        <ul>
          <li>Определяют стоимость проживания</li>
          <li>Один план можно отметить <strong>★ Base Rate</strong> — он выбирается по умолчанию при создании нового бронирования</li>
          <li>В каждом тарифном плане задаётся цена для каждого типа номера через <strong>матрицу цен</strong> (редактируется на странице тарифа)</li>
          <li>Цена из матрицы автоматически подставляется в форме бронирования при выборе тарифа и типа номера</li>
          <li>Нельзя удалить тариф, если есть связанные бронирования</li>
        </ul>

        <h3>Коды транзакций (Transaction Codes)</h3>
        <ul>
          <li>Определяют типы начислений и платежей в фолио гостя</li>
          <li>Тип <strong>Charge</strong> — начисление (дебет, увеличивает баланс)</li>
          <li>Тип <strong>Payment</strong> — оплата (кредит, уменьшает баланс)</li>
          <li>Флаг <strong>Manual Post Allowed</strong> — разрешено ли добавлять вручную из фолио</li>
          <li>Нельзя удалить код, если есть связанные транзакции в фолио</li>
        </ul>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Важно:</strong> Изменение тарифных планов и типов номеров не влияет на уже созданные бронирования.
        </div>
      </div>
    ),
    contentEn: (
      <div className="help-prose">
        <h2>System Configuration</h2>
        <p>The <strong>Settings</strong> section is accessible to Admins and Managers.</p>

        <h3>Property Settings</h3>
        <ul>
          <li><strong>Name, code</strong> — hotel name and short code (used in confirmation numbers, e.g. GBH-000001)</li>
          <li><strong>Address, city, country</strong></li>
          <li><strong>Timezone, currency</strong></li>
          <li><strong>Check-in/Check-out times</strong> — default check-in and check-out times</li>
          <li><strong>Number of rooms/floors</strong> — reference value; cannot be set lower than actual room count in the system</li>
          <li><strong>Tax rate (%)</strong> — tax percentage applied to room charges</li>
        </ul>

        <h3>Room Types</h3>
        <ul>
          <li>Room categories (Standard, Superior, Suite, etc.)</li>
          <li>Each type has a code, name, and maximum occupancy</li>
          <li>Cannot delete a type that has rooms or bookings</li>
        </ul>

        <h3>Rate Plans</h3>
        <ul>
          <li>Define room pricing</li>
          <li>One plan can be marked <strong>★ Base Rate</strong> — it is selected by default when creating a new booking</li>
          <li>Each rate plan has per-room-type pricing via the <strong>rate matrix</strong> (edit on the rate plan page)</li>
          <li>The rate is auto-filled in the booking form when selecting a rate plan and room type</li>
          <li>Cannot delete a rate plan that has bookings</li>
        </ul>

        <h3>Transaction Codes</h3>
        <ul>
          <li>Define charge and payment types used in guest folios</li>
          <li>Type <strong>Charge</strong> — debit (increases balance)</li>
          <li>Type <strong>Payment</strong> — credit (decreases balance)</li>
          <li><strong>Manual Post Allowed</strong> — whether this code can be posted manually from a folio</li>
          <li>Cannot delete a code that has folio transactions</li>
        </ul>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
          <strong>Important:</strong> Changing rate plans and room types does not affect existing bookings.
        </div>
      </div>
    ),
  },
};
