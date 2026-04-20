import fs from 'fs';
import path from 'path';

const codes = {
  "err_unknown": { en: "An error occurred", ru: "Произошла ошибка" },
  "err_booking_not_found": { en: "Booking not found", ru: "Бронирование не найдено" },
  "err_guest_not_found": { en: "Guest not found", ru: "Гость не найден" },
  "err_room_type_not_found": { en: "Room type not found", ru: "Тип комнаты не найден" },
  "err_rate_plan_not_found": { en: "Rate plan not found", ru: "Тарифный план не найден" },
  "err_past_checkin_date": { en: "Check-in date cannot be before current business date", ru: "Дата заезда не может быть раньше бизнес-даты" },
  "err_room_not_found": { en: "Specified room not found", ru: "Указанная комната не найдена" },
  "err_room_type_mismatch": { en: "Room type does not match booking type", ru: "Тип комнаты не совпадает с типом в бронировании" },
  "err_room_unavailable": { en: "Room is unavailable", ru: "Комната недоступна" },
  "err_dates_locked": { en: "Dates are locked", ru: "Нельзя изменить даты" },
  "err_dates_expired": { en: "Dates have expired", ru: "Срок действия дат истек" },
  "err_invalid_status": { en: "Invalid booking status for this action", ru: "Недопустимый статус бронирования для этого действия" },
  "err_early_checkin": { en: "Check-in date has not been reached", ru: "Дата заезда еще не наступила" },
  "err_no_room_assigned": { en: "A room must be assigned", ru: "Комнату необходимо назначить" },
  "err_room_occupied": { en: "Room is occupied", ru: "Комната уже занята" },
  "err_room_has_guest": { en: "Room already has a guest", ru: "В комнате уже проживает гость" },
  "err_early_checkout": { en: "Early checkout requires confirmation", ru: "Ранний выезд требует подтверждения" },
  "err_late_checkout": { en: "Late checkout requires confirmation", ru: "Поздний выезд требует подтверждения" },
  "err_unpaid_balance": { en: "Guest has an open balance", ru: "У гостя открытый баланс" },
  "err_cancel_checkin_too_late": { en: "Too late to cancel check-in", ru: "Слишком поздно отменять заезд" },
  "err_room_conflict": { en: "Room scheduling conflict", ru: "Конфликт расписания комнаты" },
  "err_room_not_available": { en: "Room is no longer available", ru: "Комната больше недоступна" },
  "err_missing_room_id": { en: "Room ID is required", ru: "ID комнаты обязателен" },
  "err_has_folio_transactions": { en: "Folio has transactions", ru: "В фолио есть транзакции" },
  "err_invalid_status_transition": { en: "Invalid status transition", ru: "Недопустимый переход статуса" },
  "err_missing_dates": { en: "Start and end dates are required", ru: "Обязательно укажите даты" },
  "err_room_booked": { en: "Room is booked for this period", ru: "Комната забронирована на этот период" },
  "err_invalid_dates": { en: "Invalid dates", ru: "Недопустимые даты" },
  "err_invalid_return_status": { en: "Invalid return status", ru: "Недопустимый статус возврата" },
  "err_has_bookings": { en: "Bookings are linked to this record", ru: "С этой записью связаны бронирования" },
  "err_missing_fields": { en: "Required fields are missing", ru: "Обязательные поля не заполнены" },
  "err_invalid_profile_type": { en: "Invalid profile type", ru: "Неверный тип профиля" },
  "err_missing_name": { en: "Name is required", ru: "Имя обязательно" },
  "err_possible_duplicate": { en: "Possible duplicate found", ru: "Найден возможный дубликат" },
  "err_missing_property_id": { en: "Property ID is required", ru: "ID объекта обязателен" },
  "err_max_windows_exceeded": { en: "Maximum billing windows exceeded", ru: "Превышено максимальное число окон биллинга" },
  "err_invalid_adjustment": { en: "Cannot adjust an adjustment", ru: "Нельзя скорректировать корректировку" },
  "err_night_audit_blocking_due_outs": { en: "Overdue check-outs blocking night audit", ru: "Ночной аудит заблокирован просроченными выездами" },
  "err_cashier_already_open": { en: "Cashier is already open", ru: "Касса уже открыта" },
  "err_cashier_occupied": { en: "Cashier is occupied by another user", ru: "Касса занята другим пользователем" },
  "err_unauthorized": { en: "Authorization required", ru: "Необходима авторизация" },
  "err_no_open_session": { en: "No open session", ru: "Нет открытой смены" },
  "err_package_not_found": { en: "Package not found", ru: "Пакет не найден" },
  "err_package_linked": { en: "Package is linked to rate plans", ru: "Пакет привязан к тарифам" },
  "err_link_not_found": { en: "Link not found", ru: "Связь не найдена" },
  "err_no_open_business_date": { en: "No open business date", ru: "Нет открытой бизнес-даты" },
  "err_task_not_found": { en: "Task not found", ru: "Задача не найдена" },
  "err_invalid_room_count": { en: "Invalid room count", ru: "Недопустимое количество номеров" },
  "err_room_not_ready": { en: "Room is not ready", ru: "Комната не готова" }
};

function injectDict(file, lang) {
  let content = fs.readFileSync(file, 'utf8');
  
  let newEntries = Object.entries(codes).map(([key, translations]) => {
    return `  "${key}": "${translations[lang]}",`;
  }).join('\n');
  
  // Find where to insert (before the last closing brace)
  let insertPos = content.lastIndexOf('}');
  
  let newContent = content.slice(0, insertPos) + '\n  // API Errors\n' + newEntries + '\n' + content.slice(insertPos);
  
  fs.writeFileSync(file, newContent);
  console.log('Updated ' + file);
}

injectDict('locales/en.ts', 'en');
injectDict('locales/ru.ts', 'ru');
