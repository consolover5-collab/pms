## Файлы с кириллицей в UI

### apps/web/src/app/bookings/[id]/booking-actions.tsx
- Тип: Client
- Строк: 1
- Строки: 
  - "№{r.roomNumber}{r.floor ? ` · эт.${r.floor}` : ""} · {r.housekeepingStatus} / {r.occupancyStatus}"

### apps/web/src/app/bookings/[id]/folio-section.tsx
- Тип: Client
- Строк: 1
- Строки: 
  - "setError("Выберите код и укажите сумму больше 0");"

### apps/web/src/app/bookings/[id]/page.tsx
- Тип: Server
- Строк: 2
- Строки: 
  - "label="Расч. сумма""
  - "<Field label="Гарантия" value={booking.guaranteeCode} />"

### apps/web/src/app/bookings/date-filter.tsx
- Тип: Client
- Строк: 6
- Строки: 
  - "<span className="text-gray-500">Даты:</span>"
  - "Применить"
  - "Сегодня"
  - "Неделя"
  - "Месяц"
  - "Сбросить"

### apps/web/src/app/bookings/page.tsx
- Тип: Server
- Строк: 2
- Строки: 
  - "label = "Заселён сегодня";"
  - "label = "Выехал сегодня";"

### apps/web/src/app/configuration/guarantee-codes/page.tsx
- Тип: Server
- Строк: 16
- Строки: 
  - "label: "Гарантия кредитной картой","
  - ""Бронь обеспечена кредитной картой гостя. При no-show возможно списание с карты.","
  - "label: "Гарантия компании","
  - ""Счёт выставляется компании. При no-show счёт выставляется компании.","
  - "label: "Гарантия депозитом","
  - ""Гость внёс предоплату. При no-show депозит удерживается полностью или частично.","
  - "label: "Без гарантии","
  - ""Бронь не обеспечена. При no-show финансовые претензии невозможны.","
  - "label: "Гарантия турагента","
  - ""Турагент несёт финансовую ответственность. При no-show счёт выставляется агенту.","
  - "<h1 className="text-2xl font-bold mt-2 mb-2">Коды гарантии</h1>"
  - "Код гарантии определяет чем обеспечена бронь и влияет на обработку"
  - "no-show и отмены бронирования."
  - "Код"
  - "Название"
  - "Описание"

### apps/web/src/app/configuration/page.tsx
- Тип: Server
- Строк: 2
- Строки: 
  - "title: "Коды гарантии","
  - "description: "Типы гарантий бронирования и обработка no-show","

### apps/web/src/app/configuration/property/property-form.tsx
- Тип: Client
- Строк: 1
- Строки: 
  - "НДС/VAT — ставка налога, применяемая к начислениям за проживание"

### apps/web/src/app/configuration/rate-plans/[id]/edit/page.tsx
- Тип: Server
- Строк: 2
- Строки: 
  - "<h2 className="text-base font-semibold mb-4 text-gray-700">Настройки тарифного плана</h2>"
  - "<h2 className="text-base font-semibold mb-4 text-gray-700">Цены по типам комнат</h2>"

### apps/web/src/app/configuration/rate-plans/room-rates-matrix.tsx
- Тип: Client
- Строк: 7
- Строки: 
  - "Нет типов комнат. Добавьте типы комнат в разделе{" "}"
  - "<th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Тип комнаты</th>"
  - "<th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Цена / ночь</th>"
  - "<span className="text-xs text-green-600">✓ Сохранено</span>"
  - "{isSaving ? "..." : "Сохранить"}"
  - "Удалить"
  - "Enter или кнопка «Сохранить» — сохранить цену для типа комнаты"

### apps/web/src/app/configuration/transaction-codes/[id]/edit/page.tsx
- Тип: Server
- Строк: 1
- Строки: 
  - "<h1 className="text-2xl font-bold mt-2 mb-6">Редактировать код транзакции</h1>"

### apps/web/src/app/configuration/transaction-codes/new/page.tsx
- Тип: Server
- Строк: 1
- Строки: 
  - "<h1 className="text-2xl font-bold mt-2 mb-6">Новый код транзакции</h1>"

### apps/web/src/app/guests/[id]/edit/guest-edit-form.tsx
- Тип: Client
- Строк: 1
- Строки: 
  - "<option value="">Нет</option>"

### apps/web/src/app/guests/new/guest-form.tsx
- Тип: Client
- Строк: 1
- Строки: 
  - "<option value="">Нет</option>"

### apps/web/src/app/login/page.tsx
- Тип: Client
- Строк: 3
- Строки: 
  - "Логин"
  - "Пароль"
  - "{submitting ? "Вход..." : "Войти"}"

### apps/web/src/app/night-audit/page.tsx
- Тип: Client
- Строк: 3
- Строки: 
  - "<th className="pb-1">Бронь</th>"
  - "<th className="pb-1">Заезд</th>"
  - "<th className="pb-1">Гарантия</th>"

### apps/web/src/app/rooms/[id]/edit/page.tsx
- Тип: Client
- Строк: 11
- Строки: 
  - "setError(data.error || "Ошибка сохранения");"
  - "setError("Ошибка сети");"
  - "return <main className="p-8"><p className="text-gray-500">Загрузка…</p></main>;"
  - "← Назад к комнате"
  - "<h1 className="text-2xl font-bold mt-4 mb-6">Редактировать комнату</h1>"
  - "<label className="block text-xs text-gray-500 uppercase mb-1">Номер комнаты *</label>"
  - "<label className="block text-xs text-gray-500 uppercase mb-1">Этаж</label>"
  - "<label className="block text-xs text-gray-500 uppercase mb-1">Тип номера *</label>"
  - "<option value="">— выберите тип —</option>"
  - "{saving ? "Сохранение…" : "Сохранить"}"
  - "Отмена"

### apps/web/src/app/rooms/[id]/page.tsx
- Тип: Server
- Строк: 1
- Строки: 
  - "Настройки комнаты"

### apps/web/src/app/rooms/[id]/room-status-actions.tsx
- Тип: Client
- Строк: 12
- Строки: 
  - "<h2 className="text-sm font-semibold mb-3">Статус уборки</h2>"
  - "Период: {oooFromDate} → {oooToDate}"
  - "{returnStatus && <span className="ml-2">| После: {returnStatus}</span>}"
  - "Вернуть в работу (dirty)"
  - "<p className="text-sm font-medium text-gray-700">Установить Out of Order</p>"
  - "<label className="block text-xs text-gray-500 mb-1">С даты *</label>"
  - "<label className="block text-xs text-gray-500 mb-1">По дату *</label>"
  - "<label className="block text-xs text-gray-500 mb-1">Статус после OOO</label>"
  - "<option value="dirty">Dirty (требует уборки)</option>"
  - "{loading ? "..." : "Подтвердить OOO"}"
  - "Отмена"
  - "Комната занята. Out of Order недоступен до выезда гостя."

## Паритет словарей

Ключи только в en.ts: нет
Ключи только в ru.ts: нет

## Итог

Всего файлов: 19
Всего строк кириллицы в UI: 74
