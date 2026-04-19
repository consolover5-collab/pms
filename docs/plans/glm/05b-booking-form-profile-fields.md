# Промт для GLM: Фаза 7 — форма брони с полями Company / Agent / Source

## Контекст

Проект: PMS на Next.js + Fastify + Drizzle. Монорепо.

Ранее была выполнена реализация Unified Profiles: три таблицы (guests/companies/travel_agents) объединены в одну `profiles` с полем `type` (individual, company, travel_agent, source).

Таблица `bookings` теперь содержит четыре FK:
- `guest_profile_id` (NOT NULL) → profiles
- `company_profile_id` (nullable) → profiles
- `agent_profile_id` (nullable) → profiles
- `source_profile_id` (nullable) → profiles

API (`apps/api/src/routes/bookings.ts`) уже принимает `guestProfileId`, `companyProfileId`, `agentProfileId`, `sourceProfileId` в теле запроса POST и PUT.

## Проблема

**Фаза 7 (Frontend: форма брони) не выполнена.**

В двух файлах отсутствуют поля Company / Travel Agent / Source:
- `apps/web/src/app/bookings/new/booking-form.tsx`
- `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx`

Также в `booking-form.tsx` (новая бронь) остались русские строки — их нужно перевести попутно.

---

## Задача

### Файл 1: `apps/web/src/app/bookings/new/booking-form.tsx`

#### 1.1 Добавить три опциональных select-поля после блока "Guest"

Добавить state для трёх новых полей:
```typescript
const [selectedCompanyId, setSelectedCompanyId] = useState("");
const [selectedAgentId, setSelectedAgentId] = useState("");
const [selectedSourceId, setSelectedSourceId] = useState("");
```

Добавить типы и state для данных:
```typescript
type Profile = { id: string; name: string };
const [companies, setCompanies] = useState<Profile[]>([]);
const [agents, setAgents] = useState<Profile[]>([]);
const [sources, setSources] = useState<Profile[]>([]);
```

В `useEffect` (в `loadData`) добавить загрузку трёх списков профилей параллельно с остальными:
```typescript
fetch(`/api/profiles?propertyId=${propertyId}&type=company`).then(r => r.json()),
fetch(`/api/profiles?propertyId=${propertyId}&type=travel_agent`).then(r => r.json()),
fetch(`/api/profiles?propertyId=${propertyId}&type=source`).then(r => r.json()),
```
Результаты: `companyRaw.data ?? []`, `agentRaw.data ?? []`, `sourceRaw.data ?? []`.

#### 1.2 Добавить три `<select>` поля в форму (после блока Guest, перед датами)

```tsx
{/* Company */}
<div>
  <label className="block text-xs text-gray-500 mb-1">Company</label>
  <select
    value={selectedCompanyId}
    onChange={(e) => setSelectedCompanyId(e.target.value)}
    className="w-full px-3 py-2 border rounded"
  >
    <option value="">— None —</option>
    {companies.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
</div>

{/* Travel Agent */}
<div>
  <label className="block text-xs text-gray-500 mb-1">Travel Agent</label>
  <select
    value={selectedAgentId}
    onChange={(e) => setSelectedAgentId(e.target.value)}
    className="w-full px-3 py-2 border rounded"
  >
    <option value="">— None —</option>
    {agents.map((a) => (
      <option key={a.id} value={a.id}>{a.name}</option>
    ))}
  </select>
</div>

{/* Source */}
<div>
  <label className="block text-xs text-gray-500 mb-1">Source</label>
  <select
    value={selectedSourceId}
    onChange={(e) => setSelectedSourceId(e.target.value)}
    className="w-full px-3 py-2 border rounded"
  >
    <option value="">— None —</option>
    {sources.map((s) => (
      <option key={s.id} value={s.id}>{s.name}</option>
    ))}
  </select>
</div>
```

#### 1.3 Добавить поля в тело запроса POST (`handleSubmit`)

В объект `body` добавить:
```typescript
if (selectedCompanyId) body.companyProfileId = selectedCompanyId;
if (selectedAgentId) body.agentProfileId = selectedAgentId;
if (selectedSourceId) body.sourceProfileId = selectedSourceId;
```

#### 1.4 Перевести оставшиеся русские строки

В этом же файле найти и заменить:
- `"Гарантия"` → `"Guarantee"`
- `"Не указана"` → `"Not specified"`
- `"Кредитная карта"` → `"Credit Card"`
- `"Депозит"` → `"Deposit"`
- `"Компания"` → `"Company"`
- `"Без гарантии"` → `"No Guarantee"`
- `"Турагент"` → `"Travel Agent"`

---

### Файл 2: `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx`

Прочитай файл полностью. Найди:
- Как объявлены существующие типы и state (Guest, RoomType и т.п.)
- Как устроен `useEffect` с загрузкой данных
- Как устроен `handleSubmit` и объект, отправляемый на PUT

Применить те же изменения, что и в booking-form.tsx:

1. Добавить типы и state для companies/agents/sources
2. В `useEffect` загрузить три новых списка профилей
3. Добавить три `<select>` поля в форму (после блока Guest)
4. В `handleSubmit` добавить `companyProfileId`, `agentProfileId`, `sourceProfileId` в тело запроса если выбраны
5. Предзаполнить select-и при загрузке существующей брони (если бронь уже имеет `companyProfileId`, `agentProfileId`, `sourceProfileId` — выставить их как начальное значение state)

Важно: посмотри какой тип используется для `booking` — скорее всего нужно добавить поля `companyProfileId`, `agentProfileId`, `sourceProfileId` в тип `Booking`.

---

## Проверка

После изменений:
```bash
cd apps/web && npx tsc --noEmit
```
Ошибок быть не должно.

Ручная проверка:
1. Открыть форму создания новой брони — увидеть поля Company / Travel Agent / Source с вариантами выбора
2. Создать бронь с выбранной компанией — API должен вернуть 201
3. Открыть созданную бронь — проверить что компания отображается (если страница брони её показывает)

---

## Сохрани отчёт

После завершения сохрани краткий отчёт в `docs/plans/glm/05b-booking-form-profile-fields-result.md`:
- Список изменённых файлов
- Что именно изменено в каждом
