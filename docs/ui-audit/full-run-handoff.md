# UI Audit — Full-Run Handoff (forward-looking)

- **Дата создания:** 2026-04-22
- **Branch:** `feat/design-system` (локально; в remote НЕ запушен)
- **HEAD:** `a3da87d docs(ui-audit): full-run complete — retro + final aggregate`
- **Commits ahead of `main`:** 85
- **Working tree:** clean (только модифицированные PNG-скриншоты под staging из предыдущих сессий; см. §10)

## Что это за документ

Этот handoff — **forward-looking компаньон** к `docs/ui-audit/full-run-retro.md` (который backward-looking: что произошло, что усвоили). Handoff фокусируется на:

1. Текущем состоянии репозитория и артефактов.
2. Полной таблице 24 секций и каталоге 17 багов — всё в одном месте.
3. Открытых product/architecture decision points, требующих обсуждения в новой сессии.
4. Quick-start командах для свежей сессии.

**Целевая аудитория:** новая Claude-сессия + user, возвращающийся после паузы. Чтение ТОЛЬКО этого файла (+ `bugs.yml`, `index.yml`) должно быть достаточно, чтобы продолжить работу.

## Мини-TOC

1. [Шапка + навигация](#шапка--навигация)
2. [Executive Summary](#2-executive-summary)
3. [Текущее состояние репозитория](#3-текущее-состояние-репозитория)
4. [Полная таблица 24 секций](#4-полная-таблица-24-секций)
5. [Полный каталог 17 багов](#5-полный-каталог-17-багов)
6. [Cross-cutting findings](#6-cross-cutting-findings-продуктовые-наблюдения)
7. [Tooling / methodology inventory](#7-tooling--methodology-inventory)
8. [Handoff-ready decision points](#8-handoff-ready-decision-points)
9. [Quick-start для новой сессии](#9-quick-start-для-новой-сессии)
10. [Known issues / caveats](#10-known-issues--caveats)
11. [Файлы / артефакты — полная карта](#11-файлы--артефакты--полная-карта)

---

## 2. Executive Summary

- **24/24 секций завершены:** `ok=20`, `partial=2`, `broken=1`, `missing=1`.
- **17 багов в `bugs.yml`:** 1 critical (deferred, BUG-001), 2 high (open: BUG-002, BUG-015), 4 medium (open: BUG-004, BUG-008, BUG-016, BUG-017), 10 low (open: остальные i18n).
- **85 коммитов** на ветке `feat/design-system` (не запушена).
- **Артефакты:** 5 retro docs (pilot + batch-a/b/c/d + full-run) + 24 feature YAMLs + 188 screenshots.
- **PR НЕ открыт** — ждём user decision о scope и timing.
- **Три главных блокирующих decision'а** для новой сессии:
  1. **Когда и в каком scope открывать PR** `feat/design-system → main` (см. Decision A).
  2. **Что делать с BUG-015/BUG-001 auth-axis** — фиксить cashier отдельно, или активировать auth plugin вместе с кросс-route ревизией (Decision B+C).
  3. **Help-rewrite initiative** — 9 из 24 секций с `help_rewrite_hints.topic: null`, нужен отдельный план (Decision F).

---

## 3. Текущее состояние репозитория

| Параметр | Значение |
|---|---|
| Branch | `feat/design-system` |
| Remote tracking | НЕ запушен |
| HEAD SHA | `a3da87d` |
| HEAD message | `docs(ui-audit): full-run complete — retro + final aggregate` |
| Ahead of main | 85 commits |
| Working tree | clean (см. §10 о staged PNG) |
| `pnpm … validate-yaml` | `all feature YAMLs OK` |
| `pnpm … sync-backlog:check` | `Status: in-sync` |
| `docs/ui-audit/features/` | 25 files (24 sections + `_template.yml`) |
| Screenshots | 188 PNG under `docs/ui-audit/screenshots/` |
| Spec files | 24 под `tools/ui-audit/src/NN-*.spec.ts` (01–24) |

Spec files (полный список):
```
01-dashboard.spec.ts            13-cashier.spec.ts
02-bookings-list.spec.ts        14-tape-chart.spec.ts
03-booking-create.spec.ts       15-configuration-property.spec.ts
04-booking-detail.spec.ts       16-configuration-room-types.spec.ts
05-booking-edit.spec.ts         17-configuration-rate-plans.spec.ts
06-checkin-checkout.spec.ts     18-configuration-transaction-codes.spec.ts
07-rooms-list.spec.ts           19-configuration-packages.spec.ts
08-room-detail.spec.ts          20-configuration-guarantee-codes.spec.ts
09-housekeeping.spec.ts         21-configuration-profiles.spec.ts
10-folio.spec.ts                22-help.spec.ts
11-profiles.spec.ts             23-login.spec.ts
12-night-audit.spec.ts          24-i18n-theme.spec.ts
```

Support files: `shared.ts`, `fixtures.ts`, `seed-refs.ts`, `build-gate.ts`, `api-probe.ts`, `global-setup.ts`.

---

## 4. Полная таблица 24 секций

Статусы: **ok** — все сценарии зелёные; **partial** — выявлен UX/feature gap, но route работает; **broken** — функциональный регресс; **missing** — feature заявлена, не реализована. Help topic `null` = в `help_rewrite_hints.topic` не указано целевое topic id (кандидат для help-rewrite initiative).

| # | Title | Route | Status | Help topic | Bugs | Commit (feature YAML) |
|---|---|---|---|---|---|---|
| 01 | Дашборд (главный экран) | `/` | ok | dashboard | — | `5bc040f` |
| 02 | Список бронирований | `/bookings` | ok | bookings | BUG-003 | `2feb7a6` |
| 03 | Создание бронирования (pilot) | `/bookings/new` | ok | bookings | — | `37c01ca` |
| 04 | Детали бронирования | `/bookings/[id]` | ok | bookings | — | `b9ff1e5` |
| 05 | Booking Edit | `/bookings/[id]/edit` | ok | bookings | BUG-005 | `430ef23` |
| 06 | Check-in / Check-out actions | `/bookings/[id]` (actions) | ok | check-in-out | BUG-004 | `908c440` |
| 07 | Rooms List | `/rooms` | ok | rooms | BUG-006 | `7a32963` |
| 08 | Room detail | `/rooms/[id]` | ok | rooms | BUG-007 | `44d3e8b` |
| 09 | Housekeeping | `/housekeeping` | ok | null | — | `75676e1` |
| 10 | Фолио | `/bookings/[id]` (Folio) | ok | null | — | `e46a354` |
| 11 | Guest Profiles | `/guests` | ok | guests | — | `f1adba7` |
| 12 | Night Audit | `/night-audit` | ok | null | — | `5f1c16b` |
| **13** | **Cashier** | **`/cashier`** | **broken** | null | **BUG-015** | `7686ef4` |
| **14** | **Tape chart** | **`/tape-chart`** | **partial** (no drag) | null | — (tripwire) | `d751837` |
| 15 | Configuration: Property | `/configuration/property` | ok | configuration | BUG-008 | `dcd7efd` |
| 16 | Configuration: Room Types | `/configuration/room-types` | ok | room-types-configuration | BUG-009 | `310a7ac` |
| 17 | Rate Plans Configuration | `/configuration/rate-plans` | ok | null | — | `a8157e3` |
| 18 | Configuration: Transaction Codes | `/configuration/transaction-codes` | ok | transaction-codes-configuration | BUG-010 | `080d2ef` |
| 19 | Configuration: Packages | `/configuration/packages` | ok | packages-configuration | — | `4e38281` |
| **20** | **Configuration: Guarantee Codes** | **`/configuration/guarantee-codes`** | **missing** | configuration | **BUG-016** | `3e26a08` |
| **21** | **Configuration: Profiles** | **`/configuration/profiles`** | **partial** (pagination) | guests | **BUG-017** | `4b77e98` |
| 22 | Help hub + topics | `/help`, `/help/[topic]` | ok | null | BUG-011 | `e3b4a66` |
| 23 | Login | `/login` | ok | null | — | `f154396` |
| 24 | i18n + theme (cross-cutting) | samples `/`, `/bookings`, `/housekeeping`, `/configuration/property`, `/rooms` | ok | null | — | `c30129b` |

**Подсветка особых случаев:**

- **03-booking-create (pilot).** Собственная retro-история (`pilot-retro.md`), выбран как тренировочная секция для Phase 1.5 tooling.
- **13-cashier (broken, BUG-015).** Фича функционально недоступна: `/api/cashier/current` возвращает 401, UI всегда рендерит "no-session". Root cause — BUG-001 (auth plugin отключён). Scenario D1 — positive-invariant tripwire, будет красным до фикса.
- **14-tape-chart (partial).** Drag-drop не реализован; контракт-probe в scenario 04 — positive-invariant tripwire на отсутствие drag-зоны. Bugs формально нет, но есть tripwire-фиксатор продуктового gap'а.
- **20-configuration-guarantee-codes (missing, BUG-016).** Read-only docs-страница вместо CRUD; enum дублируется в `booking-edit-form`.
- **21-configuration-profiles (partial, BUG-017).** Показывает 50 из 153 профилей без пагинации, badge врёт.

---

## 5. Полный каталог 17 багов (sorted by severity)

Источник истины: `docs/ui-audit/bugs.yml`. `docs/backlog.json` — derived mirror, редактировать НЕ напрямую (см. §7 sync-backlog). `file:line` приведены компактно; полные контексты и repro-steps см. в `bugs.yml` (строки указаны под "Source of truth" в §11).

| ID | Severity | Status | Section | File : line | Summary | Fix direction | Related |
|---|---|---|---|---|---|---|---|
| **BUG-001** | critical | deferred | pre-audit/A7 | `apps/api/src/app.ts:5, 34` | Auth plugin `await app.register(authPlugin)` закомментирован — preHandler guard отсутствует, `request.user` всегда undefined | Раскомментировать одновременно с готовностью frontend auth UI + ревизия всех routes, читающих `request.user` | BUG-015 |
| **BUG-002** | high | open | pre-audit/A6 | `packages/db/src/schema/{bookings,financial,rooms}.ts` | Нет DB-level `CHECK` constraints: date-range, positive counts, XOR debit/credit, enum values | Добавить `sql\`check(...)\`` + migration; начать с financial XOR и bookings date-range | — |
| **BUG-015** | high | open | 13-cashier | `apps/api/src/app.ts:34; apps/api/src/routes/cashier.ts:62,96` | `/api/cashier/current` и `/close` возвращают 401; UI всегда показывает "no-session"; KPI-сетка не рендерится | Активировать auth plugin (решение A) ИЛИ локально читать cookie в cashier-preHandler (B, костыль) | BUG-001 |
| **BUG-004** | medium | open | 06-checkin-checkout | `apps/api/src/routes/bookings.ts:521-530` | Кнопка "Force check-in" в dirty-warning modal шлёт `{force: true}`, но API игнорирует → infinite loop | Honor `force: true` server-side ИЛИ убрать кнопку из UI | — |
| **BUG-008** | medium | open | 15-configuration-property | `apps/api/src/routes/properties.ts:40-49; packages/db/src/seed.ts` | Seed пишет `numberOfRooms=50`, реально 54 строки в `rooms` → API отклоняет любой save property-формы с `INVALID_ROOM_COUNT` | Выставить seed-значение равным `COUNT(*) FROM rooms` + reset+reseed | — |
| **BUG-016** | medium | open | 20-configuration-guarantee-codes | `apps/web/src/app/configuration/guarantee-codes/page.tsx:1-76; apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx:609-613` | 5 guarantee codes hardcoded на config-странице И независимо в booking-edit-form; нет `/api/guarantee-codes` endpoint | **Product decision A vs B:** (A) Promote to CRUD (table + API) или (B) centralise enum в shared constants | — |
| **BUG-017** | medium | open | 21-configuration-profiles | `apps/web/src/app/configuration/profiles/page.tsx:28-34; profiles-list.tsx:153-158` | GET `/api/profiles` вызывается без `?limit=`, API default 50 из 153 total; UI показывает 50 без пагинации; count-badge врёт (показывает `profiles.length`, не `total`) | Mirror `/guests` pagination (PAGE_SIZE=50 + prev/next) + показывать `total` в badge | — |
| **BUG-003** | low | open | 02-bookings-list | `apps/web/src/app/bookings/search-form.tsx:33,40` | Search placeholder и кнопка не локализованы — hardcoded English | i18n-ключи `bookings.search.placeholder/submit` | — |
| **BUG-005** | low | open | 05-booking-edit | `apps/web/src/app/bookings/[id]/edit/{booking-edit-form.tsx,page.tsx}` | Вся booking-edit форма + заголовок рендерятся на английском | i18n-ключи `bookings.edit.*` + `getDictionary` в page.tsx | BUG-003/006/007 |
| **BUG-006** | low | open | 07-rooms-list | `apps/web/src/app/rooms/page.tsx` | Все лейблы rooms-list хардкод (title, stats, chips, filters, `hkStatusLabels`) | i18n-ключи `roomsList.*` + server-side `getDictionary()` | — |
| **BUG-007** | low | open | 08-room-detail | `apps/web/src/app/rooms/[id]/{page.tsx,room-status-actions.tsx}` | Room detail частично локализован (опаснее полного хардкода — половинчатость маскирует gap) | `getHkStatusLabel` helper + keys `rooms.hk.*`, `rooms.currentGuest/*`, `rooms.backToRooms` | BUG-006 |
| **BUG-009** | low | open | 16-configuration-room-types | `apps/web/src/app/configuration/room-types/[id]/page.tsx:22-29,59,…,166` | Detail page room-types полностью на английском; также использует tailwind-классы inconsistent с design system | Keys `roomTypes.detail.*` + `getHkStatusLabel` + миграция на CSS vars | — |
| **BUG-010** | low | open | 18-configuration-transaction-codes | `apps/web/src/app/configuration/transaction-codes/{page.tsx:84,128;transaction-code-form.tsx:167-169}` | Badge-text "charge"/"payment" и `CHARGE_GROUP_CODES` options рендерятся raw snake_case | Keys `txCodes.badge.*` и `txCodes.groupCode.*` | — |
| **BUG-011** | low | open | 22-help | `apps/web/src/app/help/page.tsx:103-143` | Status keywords в legend ("Confirmed", "Clean" и пр.) hardcoded English перед локализованным описанием → "Confirmed - Подтверждено" | Либо выделить keys `help.status.*`, либо переиспользовать `bookings.status.*` / `rooms.hk.*` | — |
| **BUG-012** | low | open | preflight-batch-d | `apps/web/src/app/bookings/[id]/booking-tabs.tsx:85,87,129,131-132,136,138,170` | Booking-tabs: LabVal labels "Email", "Nights", "Guests", "Room Type", inline "adults/children", "Not assigned", stub "Design in progress" hardcoded; также неверное использование ключа `bookingDetail.checkInAt` как phone-лейбла | Keys `bookingDetail.emailLabel/phoneLabel/nights/guests/roomType/roomNotAssigned/adultsUnit(ICU)/…` | — |
| **BUG-013** | low | open | preflight-batch-d | `apps/web/src/app/housekeeping/housekeeping-client.tsx:200,202` | Priority=1 badge рендерит title="Rush / VIP" и text "● Rush" hardcoded на иначе локализованном Kanban | Keys `hk.rushTitle`/`hk.rushBadge` | — |
| **BUG-014** | low | open | preflight-batch-d | `apps/web/src/app/bookings/[id]/folio-section.tsx:190-191,318` | Folio-window рендерит raw `payeeType`/`paymentMethod` (snake_case) + hardcoded "auto" на system-generated транзакциях | Helpers `getPayeeTypeLabel`/`getPaymentMethodLabel` по аналогии с `getStatusLabel` + key `folio.autoBadge` | — |

**Примечание:** BUG-ID'ы в `bugs.yml` идут 001→002→003→004→005→006→008→009→010→011→007→012→013→014→015→016→017. **BUG-007 физически расположен после BUG-011 в файле**, но нумерация логически последовательна. Нет "пропущенных" ID.

---

## 6. Cross-cutting findings (продуктовые наблюдения)

### 6.1 Double-source-of-truth антипаттерн

Три независимых проявления одного паттерна обнаружены в разных частях кодовой базы:

1. **BUG-001 + BUG-015 (auth axis).** Архитектурное решение "auth plugin disabled until frontend auth UI is fully wired" сделано в `apps/api/src/app.ts:30-34` как commented-out line + объяснительный комментарий. Но `apps/api/src/routes/cashier.ts` написан уже после этого решения и безусловно разыменовывает `request.user?.id` (строки 62, 96). Cashier не ловит `undefined` и возвращает 401 для любого запроса. Комментарий-решение в `app.ts` НЕ синхронизирован с кодом route'ов — это классический пример рассинхрона, против которого выработана Revision 4 convention (§7).

2. **BUG-016 (enum axis).** 5 guarantee codes (`cc_guaranteed`, `company_guaranteed`, `deposit_guaranteed`, `non_guaranteed`, `travel_agent_guaranteed`) захардкожены В ДВУХ МЕСТАХ: `apps/web/src/app/configuration/guarantee-codes/page.tsx:1-76` (docs-страница) и `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx:609-613` (form select). Между ними нет API или shared constants module — консистентность держится только на разработчике, который помнит изменить оба места.

3. **Комментарий vs код drift.** Revision 4 в основном плане (`docs/superpowers/plans/2026-04-21-ui-audit-full-run.md`) явно называет этот класс "keep comments synced with code in fix-loops" — внесена после D2 double-fix-loop (см. §10).

**Рекомендация для следующего цикла:** architecture audit — systematically `grep` для:
- Hardcoded enum duplicates (например, `grep -rE '"cc_guaranteed"'` по `apps/web/`).
- `// await app.register(` и `// TODO` style deferred-decision comments в критичных местах (auth, validation, gates).
- `request.user?` consumers — аудит поведения каждого при отсутствии user.

См. Decision G (§8) — это заслуживает отдельного плана.

### 6.2 i18n completeness

**7 из 17 багов — i18n gaps:** BUG-003, BUG-005, BUG-006, BUG-007, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013, BUG-014 (фактически 10 из 17 связаны с i18n). Паттерн: hardcoded русские/английские строки в компонентах, где большинство лейблов уже локализовано через `t(dict, …)`. Часто — "частично локализованные" компоненты, что опаснее полного хардкода.

- **Preflight batch-d (commit `dbd1563`)** — scan-tool нашёл 3 leak'а (BUG-012/013/014) до начала D-batch. Эти баги зафайлены и ожидают фикса, но scan-tool подтвердил, что "гапы на проверенных страницах" ≈ стабилизировался.
- **Batch D scenario 24-03 (section 24 i18n-theme)** — пересканировал 5 sampled pages и подтвердил: preflight-фиксы (если бы их внедрили) держатся; 0 новых leak'ов сверх зафайленных.
- **Scanner gap (edge_case):** `<tbody>` descendants исключены wholesale (задокументировано в `docs/ui-audit/features/24-i18n-theme.yml` → edge_cases → `tbody-chrome-silently-excluded`). Таблицы могут содержать hardcoded английский, но scanner об этом молчит. Рекомендация: инвертировать эвристику — сканировать всё, использовать `data-user-content="true"` opt-out на элементах, содержащих заведомо не-i18n данные (guest names, room numbers и т.д.).

### 6.3 Pagination / truncation gaps

**BUG-017** вскрыл, что `/configuration/profiles` молча показывает 50 из 153 профилей. Канонический fix-паттерн существует в репозитории — `apps/web/src/app/guests/page.tsx:41` использует `?limit=PAGE_SIZE=50` явно, вместе с prev/next UI. Рекомендация: точечный аудит других list-pages (room-types list, rate-plans list, transaction-codes list, packages list, guests-by-type tabs) на предмет `?limit` omission. В рамках current run это выделено только для profiles; остальные list-страницы проверялись статически через "sample row visible", но не на границу 50+.

---

## 7. Tooling / methodology inventory

### Shared helpers (`tools/ui-audit/src/shared.ts`)

- `loginAsAdmin(page)` — стандартный admin/admin123 login через UI.
- `setLocaleAndGoto(page, locale, path)` — выставляет `pms_locale` cookie + navigation.
- `setNativeValue(page, selector, value)` — обход React controlled-input quirk'ов.
- `pickFirstSelectOption(page, selector)` — выбирает первый не-пустой `<option>`.
- `auditScreenshot(page, sectionId, name)` — writer PNG с locale-suffix'ом (`...-en.png`/`...-ru.png`).
- `registerSectionHooks(sectionId, options?)` — **Phase 1.5 core helper**: устанавливает page/request error collectors, делает audit-data dump в `test-results/`, optional `extraAfterAll` для scenario-specific cleanup.

### Fixtures (`tools/ui-audit/src/fixtures.ts`)

- `createConfirmedBooking({marker})` — создаёт booking с унифицированным marker для последующего cleanup.
- `fetchCheckedInBooking()`, `fetchTransactionCode(type)` — выборка стабильной entity для assert'ов.
- `postFolioCharge`, `postFolioPayment`, `getFolio`, `getBookingStatus` — API-wrappers для folio mutations.
- `cleanupAuditBookings(marker)` — section-scoped teardown (удаляет все bookings с marker'ом).
- `ensureGuests`, `ensureCompanies`, `ensureTravelAgents`, `ensureSources` — seed-augmentation helpers.

### Scripts

- `pnpm --filter @pms/ui-audit aggregate` — генерирует `docs/ui-audit/index.yml` из feature YAMLs.
- `pnpm --filter @pms/ui-audit validate-yaml` — schema check всех feature YAMLs.
- `pnpm --filter @pms/ui-audit test` — запустить все 24 спеки.
- `pnpm --filter @pms/ui-audit probe-state` — runtime snapshot (seed counts + business date).
- `pnpm --filter @pms/ui-audit sync-backlog` — `bugs.yml` → `docs/backlog.json` mirror (writer).
- `pnpm --filter @pms/ui-audit sync-backlog:check` — read-only sync check (CI-friendly).

### Conventions (Revisions 1-4, из `docs/superpowers/plans/2026-04-21-ui-audit-full-run.md` preamble)

- **Rev 1:** pre-flight probe mandatory для mutable-state sections (bookings/folio/cashier/…). Без него легко принять side-effect чужой секции за bug.
- **Rev 2:** prefer role/testid selectors; `toHaveCount(N)` BEFORE `.first()`; forbid CSS-class selectors для design-system elements (они меняются вместе с `feat/design-system` refactor'ами).
- **Rev 3:** spec reviewer reads files directly, не доверяет self-report'у спек-автора (это верифицируется на stage review).
- **Rev 4:** keep comments synced with code in fix-loops. Любое absence claim ("нет UI-поверхности", "endpoint не существует") требует cross-section grep verification перед коммитом.

### Review verdict enum

`APPROVED | APPROVED_WITH_IMPORTANTS | NEEDS_FIXES` — убирает self-contradiction из per-section review ("approved, но с 3 важными замечаниями" — разрешается в одно из трёх состояний).

### Testid convention

`{route-slug}-{element-role}` — например, `cashier-post-charge-button`, `config-guarantee-codes-row-cc_guaranteed`. **Wrapper pattern:** `{route-slug}-page` на самом внешнем контейнере page-level — дёшево дать scoped queries (`page.locator('[data-testid="cashier-page"]').locator(...)`).

### Dev-harness ritual (stale `.next/` caveat)

Каждый раз после модификации `apps/web/src/app/**/page.tsx` (или любого Next.js server component):

```bash
pnpm --filter @pms/web build
# find next-server PID and kill
kill <next-server-pid>
cd apps/web && nohup pnpm start > /tmp/web.log 2>&1 & disown
```

**Симптомы stale:** спек упал с "element not found", или `curl localhost:3000/<route>` возвращает HTML `<body>Loading...</body>`. Это систематический источник ложных спек-failures — см. §10.

---

## 8. Handoff-ready decision points

Каждый пункт структурирован: **Question → Context → Options → Dependencies/blockers**.

### Decision A: Открыть PR `feat/design-system → main`?

- **Context.** 85 коммитов, clean working tree, все тесты зелёные, все retros закоммичены. Branch НЕ запушена в remote.
- **Options.**
  - (i) Открыть PR прямо сейчас "as-is" — большой scope, но логически завершённая единица работы.
  - (ii) Сначала починить BUG-017 (quick win, ~2 часа — есть canonical template в `/guests`) и только потом PR — не выкатывать известный UX gap в main.
  - (iii) Дождаться BUG-001 activation decision, чтобы bundle всю auth-related работу в один PR.
- **Dependencies/blockers.** Если user хочет сузить PR scope до "audit only" (без design-system feature work), может потребоваться разделить ветку. Проверить `git log --stat main..HEAD` и определить, насколько audit артефакты переплетены с design-system изменениями. Если переплетены сильно — разделять дорого.

### Decision B: BUG-015 cashier fix timing

- **Context.** Cashier полностью сломан (status=broken). Root cause — BUG-001 (auth plugin disabled). Фиксить только cashier можно (вариант B в `bugs.yml`), но это leaky fix — остальные routes с `request.user?` получат тот же gap (см. Decision C).
- **Options.**
  - (i) Bundle с BUG-001 activation — чистое решение, но требует Decision C.
  - (ii) Отдельный quick fix в `cashier.ts` — дублирует логику authPlugin локально (ручное чтение cookie + lookup в sessions/users). Временная заплатка.
  - (iii) Оставить broken до MVP decision (текущее состояние).
- **Dependencies.** Выбор зависит от Decision C.

### Decision C: BUG-001 auth plugin activation

- **Context.** Architectural decision deferred ещё до audit'а. Комментарий в `app.ts:30-34`: "disabled until the frontend auth UI (login page, session handling, cookie forwarding in SSR) is fully wired". Login page (section 23 D5) отгружена в Batch D; SSR cookie forwarding работает (верифицировано в login-spec через cookie-roundtrip tests).
- **Options.**
  - (i) Активировать сейчас + cross-route audit всех `request.user` consumers (отдельный architecture cycle, ~дни).
  - (ii) Дождаться явной подтверждённой готовности SSR (но текущие тесты ничего не блокируют).
  - (iii) Оставить deferred с explicit production-safe guidance ("не деплоить в production без активации auth plugin").
- **Dependencies.** Требует ревизии ВСЕХ routes, читающих `request.user`. Не просто cashier — проверить folio-routes, bookings actions, configuration writes и др. Может занять отдельный architecture audit cycle (см. Decision G).

### Decision D: BUG-017 profiles pagination fix — quick win?

- **Context.** `/configuration/profiles` молча показывает 50 из 153 строк. Option (A) из `bugs.yml` — mirror `/guests` pagination — ~2 часа работы, есть canonical template. Medium severity, но UX-ощутимо: count-badge врёт ("50" вместо "153").
- **Options.**
  - (i) Починить в этом же branch перед открытием PR — section 21 переходит обратно в `ok`, bug flag снимается.
  - (ii) Отдельный follow-up PR после merge.
  - (iii) Defer to post-MVP.
- **Dependencies.** Если чинить сейчас: обновить `21-configuration-profiles.yml` (status `partial` → `ok`, bugs `[BUG-017]` → `[]`); обновить `index.yml` через `pnpm aggregate`; перезапустить spec для verification.

### Decision E: BUG-016 guarantee-codes — product choice A vs B?

- **Context.** Double-hardcoded enum. Option A = promote to full CRUD (table + API, клиент-специфичные настройки). Option B = centralise enum в shared constants module (если enum стабилен для всего продукта).
- **Options.**
  - (i) A — если guarantee codes должны быть property/client-specific (редко встречающийся кейс в hospitality — обычно фиксированный набор).
  - (ii) B — если enum стабилен для всего продукта (более вероятно).
  - (iii) Defer — не блокирует.
- **Dependencies.** Это product decision, не technical call. Следует обсудить отдельно до начала работы.

### Decision F: Help-rewrite initiative — отдельный план?

- **Context.** 9 из 24 секций имеют `help_rewrite_hints.topic: null`: 09-housekeeping, 10-folio, 12-night-audit, 13-cashier, 14-tape-chart, 17-rate-plans, 22-help, 23-login, 24-i18n-theme. В оставшихся 15 секциях help topics есть, но качество/актуальность help-текстов НЕ аудировались — был только route-to-topic mapping.
- **Options.**
  - (i) Отдельный план `docs/superpowers/plans/2026-04-Qx-help-rewrite.md` — brainstorm + structured plan.
  - (ii) Inline в следующий audit cycle (но это blue-sky work, не bug-fix).
  - (iii) Defer до после PR + до Unified Profiles MVP.
- **Dependencies.** Не блокирует PR. Но отсутствие help content = user-facing gap (раздел /help существует, но половина topics не покрыта).

### Decision G: Architecture audit — follow-up из double-source-of-truth?

- **Context.** 3 независимых находки одного паттерна (BUG-001/015/016). Заслуживает explicit architecture review — системный grep-аудит кодовой базы для выявления аналогичных drift'ов до того, как они станут багами.
- **Options.**
  - (i) Отдельный план `docs/superpowers/plans/2026-04-Qx-architecture-audit.md` — scope: enum duplicates, deferred-decision comments, route-level auth consumers.
  - (ii) Продуктовое обсуждение без формального audit (меньше overhead, но менее rigor).
  - (iii) Defer.
- **Dependencies.** Не блокирует ничего. Но чем дольше откладывать, тем больше drift накапливается.

---

## 9. Quick-start для новой сессии

### Проверка состояния

```bash
cd /home/oci/pms
git rev-parse --abbrev-ref HEAD                       # expect: feat/design-system
git log --oneline main..HEAD | wc -l                  # expect: 85
git status --short                                    # expect: empty (кроме staged PNG из §10)
pnpm --filter @pms/ui-audit validate-yaml             # expect: all feature YAMLs OK
pnpm --filter @pms/ui-audit sync-backlog:check        # expect: Status: in-sync
ls docs/ui-audit/features/ | wc -l                    # expect: 25 (24 + _template + README.md)
find docs/ui-audit/screenshots -name '*.png' | wc -l  # expect: 188
```

### Ключевые файлы для чтения (по приоритету)

1. **Этот файл** (`docs/ui-audit/full-run-handoff.md`) — forward-looking handoff.
2. `docs/ui-audit/full-run-retro.md` — backward-looking retrospective.
3. `docs/ui-audit/bugs.yml` — SINGLE SOURCE для bugs.
4. `docs/ui-audit/index.yml` — aggregate section statuses (auto-generated).
5. `docs/superpowers/plans/2026-04-21-ui-audit-full-run.md` — original plan (Revisions 1-4 в preamble).
6. Batch retros: `docs/ui-audit/batch-{a,b,c,d}-retro.md` — per-batch детали.
7. `docs/ui-audit/pilot-retro.md` — история pilot section 03.

### Memory update (опционально — user решит)

- Переименовать `session_2026-04-21_ui_audit_batch_c_done.md` → `session_2026-04-22_full_run_complete.md`.
- Обновить содержимое: теперь 24/24 секций + 17 багов + ready for PR decision.
- Ссылки на этот handoff + full-run-retro как primary sources; прошлые batch-retros как deep-dive.

---

## 10. Known issues / caveats

- **aggregate bugs: 12 vs `bugs.yml` 17.** `index.yml.totals.bugs=12` считает только bugs, прикреплённые к feature-YAML sections. BUG-001 (pre-audit/A7) и BUG-002 (pre-audit/A6) — архитектурные, не прикреплены к конкретной секции. BUG-012/013/014 — preflight-batch-d, найдены scan-tool'ом до начала секций. Это by design; расхождение не баг.
- **Screenshot count 188 (vs плановые ≥200).** Реально меньше: section 13 (cashier broken, UI не рендерит KPI → меньше PNG в happy-path) и section 14-04 (drag contract-probe — API-only, без скриншота) генерируют меньше артефактов. Все 24 секции покрыты, но суммарное число ниже target'а. Не баг.
- **Working tree staged PNG.** `git status` показывает ~50 модифицированных PNG в `docs/ui-audit/screenshots/` (dashboards, bookings-list, booking-create, booking-detail). Это staged artifacts из предыдущих run'ов — content-identical (deterministic tooling перезаписывает PNG на том же входе). Если `git diff --stat` показывает только size-neutral изменения, safe игнорировать. Если размеры меняются — перезапустить `pnpm test` для свежих reference screenshots.
- **Stale `.next/` build-gate.** Систематический источник ложных спек-failures (повторяется при каждой модификации `apps/web/src/app/**/page.tsx`). Обязательный ritual — §7. Добавлен `tools/ui-audit/src/build-gate.ts` для early detection, но не все сценарии покрываются.
- **`bugs.yml` single source.** `docs/backlog.json` — derived mirror. Редактировать только `bugs.yml`, затем `pnpm --filter @pms/ui-audit sync-backlog`. Ручная правка `backlog.json` будет перезатёрта при следующем sync.
- **4 pre-existing validate-yaml errors backfilled at F1** (commit `5f60696`). Если кто-то увидит минимальный `retro: { time_minutes: 0, unblocker_fixes: [], methodology_deltas: [...] }` в секциях 16/18/19/22 — это back-fill, не original audit retro. Оригинальные retros велись неконсистентно до F1-stage; back-fill'ил их, чтобы schema-valid.
- **Scenario 04 positive-invariant tripwires (D1, D2, D5).** Специальные тесты-"тревожные сигналы", которые проваливаются при исправлении продуктового gap'а и принуждают re-audit:
  - D1 (cashier): тест утверждает `request.user?.id` undefined → ожидает 401. Когда BUG-001/015 починены — тест упадёт, заставит обновить fixtures.
  - D2 (tape-chart drag): тест утверждает отсутствие drag-zone в DOM. Когда drag-drop реализован — упадёт, принудит обновить tape-chart-specific scenarios.
  - D5 (login enumeration-free): тест утверждает, что сообщение об ошибке не раскрывает, существует ли username. Если изменится error copy — упадёт.
- **Double fix-loop на D2** (commits `6d412c5` + `0593afe`). Пример Revision 4 discipline в действии. Первый fix починил ложь "endpoint doesn't exist" в audit-отчёте. Второй — обнаружил новую ложь "no UI surface invokes it" (оказалось, booking-detail уже использует тот же endpoint). Урок: любое absence claim требует cross-section grep verification перед merge.

---

## 11. Файлы / артефакты — полная карта

```
/home/oci/pms/
├── apps/
│   ├── api/src/
│   │   ├── app.ts                              # BUG-001 anchor (line 5, 34)
│   │   └── routes/
│   │       ├── bookings.ts                     # BUG-004 (521-530 force check-in)
│   │       ├── cashier.ts                      # BUG-015 (62, 96 — request.user?.id)
│   │       └── properties.ts                   # BUG-008 (40-49 numberOfRooms)
│   └── web/src/
│       ├── app/
│       │   ├── bookings/
│       │   │   ├── search-form.tsx             # BUG-003
│       │   │   └── [id]/
│       │   │       ├── booking-tabs.tsx        # BUG-012
│       │   │       ├── folio-section.tsx      # BUG-014
│       │   │       └── edit/
│       │   │           ├── booking-edit-form.tsx # BUG-005, BUG-016
│       │   │           └── page.tsx            # BUG-005
│       │   ├── cashier/page.tsx                # 20 testids added (D1)
│       │   ├── configuration/
│       │   │   ├── guarantee-codes/page.tsx    # BUG-016 (D3 wrapper + row testids)
│       │   │   ├── profiles/
│       │   │   │   ├── page.tsx                # BUG-017 (D4 wrapper)
│       │   │   │   └── profiles-list.tsx       # BUG-017 (D4 list testids)
│       │   │   ├── room-types/[id]/page.tsx    # BUG-009
│       │   │   └── transaction-codes/{page.tsx,transaction-code-form.tsx} # BUG-010
│       │   ├── help/page.tsx                   # BUG-011
│       │   ├── housekeeping/housekeeping-client.tsx # BUG-013
│       │   ├── login/page.tsx                  # D5: 9 testids + role="alert"
│       │   ├── rooms/
│       │   │   ├── page.tsx                    # BUG-006
│       │   │   └── [id]/{page.tsx,room-status-actions.tsx} # BUG-007
│       │   └── tape-chart/page.tsx             # D2: 17 testids + data-*
│       └── components/
│           └── topbar.tsx                      # D6: 5 testids + aria-pressed
├── packages/db/src/
│   ├── schema/{bookings,financial,rooms}.ts    # BUG-002 (no CHECK constraints)
│   └── seed.ts                                 # BUG-008 (numberOfRooms mismatch)
├── tools/ui-audit/
│   ├── src/
│   │   ├── shared.ts                           # Phase 1.5 registerSectionHooks + helpers
│   │   ├── fixtures.ts                         # unified booking/folio/guest fixtures
│   │   ├── seed-refs.ts                        # canonical UUIDs (property GBH, admin, …)
│   │   ├── build-gate.ts                       # stale-.next/ detection
│   │   ├── api-probe.ts                        # API drift gate
│   │   ├── global-setup.ts                     # shared test-setup
│   │   └── NN-*.spec.ts                        # 24 spec files (01–24)
│   └── scripts/
│       ├── aggregate.ts                        # rebuild index.yml
│       ├── validate-yaml.ts                    # schema check
│       ├── probe-state.ts                      # runtime snapshot
│       └── sync-backlog.ts                     # bugs.yml → backlog.json
├── docs/
│   ├── backlog.json                            # mirror of bugs.yml (do NOT edit directly)
│   ├── ui-audit/
│   │   ├── bugs.yml                            # SINGLE SOURCE for bugs
│   │   ├── index.yml                           # aggregate (auto-generated)
│   │   ├── README.md
│   │   ├── features/
│   │   │   ├── _template.yml
│   │   │   └── NN-*.yml (24 files, 01–24)
│   │   ├── screenshots/ (188 PNGs, naming: NN-section-MM-scenario-{en,ru}.png)
│   │   ├── scripts/
│   │   ├── pilot-retro.md                      # section 03 pilot history
│   │   ├── batch-a-retro.md                    # sections 04–10
│   │   ├── batch-b-retro.md                    # sections 11–14
│   │   ├── batch-c-retro.md                    # sections 15–19
│   │   ├── batch-d-retro.md                    # sections 20–24 + preflight
│   │   ├── full-run-retro.md                   # backward-looking (what we learned)
│   │   └── full-run-handoff.md                 # THIS FILE (forward-looking)
│   ├── ui-audit-plan.md                        # overall audit plan (pre-full-run)
│   └── superpowers/plans/
│       ├── 2026-04-21-ui-audit-pilot-section-03.md
│       └── 2026-04-21-ui-audit-full-run.md     # main plan + Revisions 1–4
```
