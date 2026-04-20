# Result: Фаза 7 — форма брони с полями Company / Agent / Source

## Изменённые файлы

### 1. `apps/api/src/routes/bookings.ts`
- **POST Body**: добавлены `companyProfileId`, `agentProfileId`, `sourceProfileId` (опциональные)
- **POST handler**: три новых поля передаются в `insert().values()` (с fallback `|| null`)
- **PUT Body**: добавлены `companyProfileId`, `agentProfileId`, `sourceProfileId` (опциональные)
- **GET /api/bookings/:id**: ответ теперь включает `companyProfileId`, `agentProfileId`, `sourceProfileId` из таблицы bookings

### 2. `apps/web/src/app/bookings/new/booking-form.tsx`
- Добавлен тип `Profile` и state для `companies`, `agents`, `sources`
- Добавлен state для `selectedCompanyId`, `selectedAgentId`, `selectedSourceId`
- В `loadData`: параллельная загрузка профилей `type=company`, `type=travel_agent`, `type=source`
- Три новых `<select>` поля (Company, Travel Agent, Source) после блока Guest, перед датами
- В `handleSubmit`: три новых поля добавляются в body если выбраны
- Перевод русских строк: `Гарантия` → `Guarantee`, `Не указана` → `Not specified`, `Кредитная карта` → `Credit Card`, `Депозит` → `Deposit`, `Компания` → `Company`, `Без гарантии` → `No Guarantee`, `Турагент` → `Travel Agent`

### 3. `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx`
- Тип `Booking`: добавлены `companyProfileId`, `agentProfileId`, `sourceProfileId` (nullable)
- Добавлен тип `Profile` и state для `companies`, `agents`, `sources`
- Добавлен state для `selectedCompanyId/AgentId/SourceId` с инициализацией из booking
- В `loadData`: параллельная загрузка профилей
- Три новых `<select>` поля после Guest (с disabled/locked для terminal статусов)
- В `handleSubmit`: поля отправляются в PUT если `canEditFinancials`
- Перевод всех русских строк на английский (guarantee options, status explanation, total label, nights text)

### 4. `apps/web/src/app/bookings/[id]/edit/page.tsx`
- Тип `Booking`: добавлены `companyProfileId`, `agentProfileId`, `sourceProfileId` для совместимости с формой

## Проверка

- `tsc --noEmit` для `@pms/web` — 0 ошибок
- `pnpm typecheck` — все 4 пакета прошли
