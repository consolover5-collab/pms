# Batch A Retrospective

**Date:** 2026-04-21
**Sections covered:** 01 dashboard, 02 bookings-list, 04 booking-detail, 06 checkin-checkout, 10 folio (5 sections)
**Status histogram:** ok=5 partial=0 broken=0 missing=0
**Bugs filed:** 2 (BUG-003 search-form не локализована; BUG-004 "Force check-in" UI не обходит API-gate)
**Unblocker fixes:** orphan-cleanup heuristic в Section 06, lazy-init bookings (06), EARLY_CHECKOUT force-banner path (06), choice of ADJ_ROOM over ROOM (10), multi-window balance scan (10)
**Total subagent time:** ~205 min (30 + 25 + 35 + 75 + 40). Section 06 взял 2× — мутационные сценарии + discovery BUG-004.

Commits (`git log --oneline -5`): `e46a354 … 908c440 … b9ff1e5 … 2feb7a6 … 5bc040f`.

## 1. Что работает (keep doing)

- **Two-stage review (spec → code quality)** ловит разного типа проблемы: spec-ревьюер находит пропущенные требования, code-quality ревьюер — коррумпированные helper'ы и race-conditions. Ни одна секция не вышла «зелёной» без нитов — это означает, что фильтр работает.
- **Incremental nit-fixing**: Section 10 implementer прочитал nit section 06 об отсутствии `r.ok` guards и добавил их во все helper'ы section 10. Это подтверждает, что ретроспективные замечания просачиваются в следующую секцию без явного мандата.
- **Controller-level batch-prep**: я читаю route + API + i18n + runtime DB state ДО диспетча implementer'а. Economy — implementer получает бриф с реальными ID, адаптированными сценариями, known-gotchas. Section 10 выиграл благодаря rtюntime-probe'у (20 checked_in bookings, 8 multi-window, 0 zero-balance).
- **Dynamic ID resolution**: `BOOKING_ID` через `GET /bookings?status=… limit=1` (04), `PAY_CASH id` через `GET /transaction-codes` (06, 10). Ни одна секция не хардкодит mutable ID из seed.
- **Serial mode + en-only mutation gate**: Section 04 породил паттерн, 06 и 10 его расширили. Работает стабильно.

## 2. Что идёт не так (нужно исправить перед Batch B)

### 2.1 Duplicate-helper взрыв (критично)

**5 spec-файлов дублируют `beforeEach`/`afterAll` error-dump block** (01, 02, 04, 06, 10). ~20 строк copy-paste в каждом.

**Helper-дубликаты внутри bookings-мутирующих секций:**

| Функция | Секция 06 | Секция 10 | Diff |
|---|---|---|---|
| `getFolioBalance` | inline | inline | identical shape |
| `fetchCheckedInBookingWithBalance`/`WithPositiveBalance` | returns `null` on miss | **throws** on miss | divergent failure mode — опасно |
| `fetchPayCashCodeId` / `fetchTransactionCode` | hard-coded 'PAY_CASH' | generalized `(type, prefer)` | 10's лучше, 06's можно удалить |
| `createConfirmedBooking` | есть | нет (пока) | понадобится в Batch B |
| `postCashPayment` | есть | `/folio/payment` call inline | рефактор + унификация с post-charge |

Нит section 10 от code-reviewer'а: `getFolioBalance:89` — **dead code** (определён, не используется). Сигнал, что inline-копирование без DRY приводит к мусору.

### 2.2 Orphan-cleanup хрупок

Section 06 добавил heuristic `confirmationNumber suffix >= 210 → DELETE через POST /cancel`. Хрупкий:
- Дедуп через confirmationNumber зависит от monotonic counter, который может переиспользоваться после sequence-reset.
- Не различает audit-orphans от реальных бронирований с suffix ≥ 210.

**Лучше**: помечать audit-созданные bookings через `notes: "audit-section-NN"` и чистить по notes.

### 2.3 Selector coupling к CSS-классам дизайн-системы

`.folio-win .totals .v.pos`, `.btn.xs.primary[type="submit"]`, `.card-title`, `.fh .ti` — все сильно привязаны к текущим CSS-классам. Мы на ветке `feat/design-system`, где эти классы активно ревизируются. **Риск** — переименование классов в параллельной работе сделает audit silent-skipped (select возвращает null, ассерт `count >= 0` тривиально проходит).

**Возможные направления**: role-based selectors (`getByRole`), `data-testid` атрибуты, либо явный `expect(locator).toHaveCount(N)` вместо `.first()` + `.click()`.

### 2.4 Plan-vs-reality drift — паттерн, а не исключение

Каждая секция имела 2-5 отклонений от изначального плана:

| Секция | Главное отклонение |
|---|---|
| 01 | plan: "click Arrivals Today header" — нет такой ссылки; per-row click вместо |
| 02 | plan: `?arrivalsOn=…` — реально `?view=arrivals` |
| 04 | plan не упомянул state-mutation containment; invented en-only + afterAll safety |
| 06 | **3 отклонения**: OOS-booking нельзя создать через POST; force flag не читается; EARLY_CHECKOUT вместо UNPAID_BALANCE |
| 10 | ROOM не manual-post; два endpoint'а `/folio/post` + `/folio/payment`; 0 zero-balance в seed |

**Batch B risk**: секции 09 housekeeping и 12 night-audit имеют высокую вероятность drift'а — их mutation-моделии сложнее. Нужно pre-flight API-probe ПЕРЕД дispatch'ем implementer'а.

### 2.5 Server-side apiFetch invisibility

Persistent methodology note (секции 01 и 02): Next.js server-component `apiFetch` не виден через `page.on('response')`, только client-side вызовы. В YAML это отмечается через `note: server-side` на соответствующих entries в `api_calls_observed`. Не фиксится на нашей стороне — просто надо помнить для всех section'ов с server components.

### 2.6 Divergent failure contracts

Section 10 review нашёл: один и тот же по имени helper (`fetchCheckedInBookingWithBalance`) в секциях 06 vs 10 ведёт себя по-разному (null vs throw). При promotion нужно выбрать **один** контракт.

## 3. Mandatory pre-Batch-B actions (Phase 1.5)

Предлагаю короткую фазу перед Batch B:

### 3.1 Extract `shared.ts::createSectionHooks(sectionId)`

Единая функция возвращает `{beforeEach, afterAll}` пару с error-collectors + API-call JSON dump logic. Убирает 5 дубликатов beforeEach/afterAll блоков → каждая секция теряет ~20 строк boilerplate.

Сигнатура (предварительно):
```ts
export function createSectionHooks(sectionId: string): {
  beforeEach: (ctx: BeforeEachCtx) => Promise<void>;
  afterAll: () => Promise<void>;
  getCollectors: (projectName: string) => { console: ConsoleError[]; network: NetworkError[]; apiCalls: ApiCall[] };
}
```

### 3.2 Extract `fixtures.ts::booking*` + `folio*` helpers

Канонические сигнатуры (объединение 06 + 10 с унифицированным контрактом):

```ts
export async function createConfirmedBooking(opts: {
  roomId: string | null;
  bizDate: string;
  nights?: number;
  guestProfileId?: string;  // auto-picks first individual if absent
  marker?: string;           // goes into booking.notes for cleanup
}): Promise<string>;

export async function fetchCheckedInBooking(opts?: {
  minWindows?: number;
  balancePredicate?: 'positive' | 'zero' | 'any';
  excludeIds?: string[];
}): Promise<{ bookingId: string; balance: number; windows: FolioWindow[] } | null>;

export async function fetchTransactionCode(
  propertyId: string,
  type: 'charge' | 'payment',
  preferCode?: string,
): Promise<{ id: string; code: string }>;

export async function postFolioCharge(bookingId: string, opts: {...}): Promise<void>;
export async function postFolioPayment(bookingId: string, opts: {...}): Promise<void>;

export async function getFolio(bookingId: string): Promise<FolioData>;
export async function getBookingStatus(bookingId: string): Promise<{ status: string; roomId: string | null }>;

export async function cleanupAuditBookings(markerPrefix: string): Promise<number>;
```

Все с `r.ok` guards на всех fetch'ах. Убрать divergent failure modes (решаем: return nullable, не throw — контроллеру легче читать).

### 3.3 Formalize audit-orphan cleanup

Заменить heuristic на `notes` marker:
- `createConfirmedBooking({..., marker: 'audit-section-06'})` → notes содержит этот префикс.
- `cleanupAuditBookings('audit-')` в shared beforeAll или как one-shot script.
- В Section 06 оставить fallback на старую эвристику только если marker пустой.

### 3.4 Runtime API-probe script

Наблюдение: контроллер делал ad-hoc probe'ы перед каждой секцией (rooms state, bookings state, transaction codes). Имеет смысл formalize в `tools/ui-audit/scripts/probe-state.ts`:

```bash
pnpm --filter @pms/ui-audit probe-state > /tmp/probe-$(date +%s).json
```

Вывод содержит: rooms by HK×OCC, checked_in bookings count + balances + windows histogram, transaction codes with `isManualPostAllowed`, active business date. Обновляется на каждом запуске session'а; используется controller'ом при подготовке бриф'ов Batch B секций.

## 4. Batch B scenarios — что пересматривать

Предварительный взгляд на Batch B (секции 09 housekeeping, 12 night-audit, 17 rate-plans) до детального plan-review:

### Section 09 — Housekeeping

Multi-resource mutation (HK task + room status). Потенциальные сюрпризы:
- Сколько HK-tasks в seed? Probe нужен.
- Какие переходы статусов (clean → dirty → inspected → clean): нужен actual state-machine, план содержит только идею.
- Are there auto-generated tasks on check-out? Section 06 отметил, что при check-out room → `dirty` — т.е. task может автогенериться или это раздельная механика.

### Section 12 — Night Audit

**Самый рискованный раздел.** NA advances `businessDate` и создаёт room-charges для checked_in — это **irreversible без seed-reset**. Варианты:

- **A: Read-only audit** — observe UI кнопки и preview, не нажимаем "Run Night Audit". Низкий риск, покрытие частичное.
- **B: Spinning up throwaway property** — создать отдельный property GBH-test через POST /api/properties, гонять NA там. Высокая полезность, но может потребовать новых fixture'ов.
- **C: Accept mutation, reset seed after** — ran NA, записать delta, сделать rollback через `pnpm db:seed` в afterAll. Непредсказуемо для параллельных тестов.

Нужно решение пользователя до start.

### Section 17 — Rate Plans

Низкий mutation-footprint (CRUD configuration). Должно быть straightforward после extraction phase 1.5.

## 5. Ready for Batch B?

- [ ] **Phase 1.5 extraction completed** — shared hooks + fixtures.ts helpers + probe-state script
- [ ] **Section 09 probe run** — HK task state, room transition map empirically verified
- [ ] **Section 12 mutation strategy decided** — A/B/C выше
- [ ] **User gate approved**

Рекомендую короткий phase 1.5 (~2-3 субагент-задачи, 1 час) + short plan-revision для Batch B секций перед их реальным execution'ом. Это обойдётся дешевле, чем тянуть дубликаты ещё через 3+ секции.
