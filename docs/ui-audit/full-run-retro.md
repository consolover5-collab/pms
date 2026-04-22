# UI Audit Full-Run Retrospective

**Dates:** 2026-04-19 – 2026-04-22 (4 календарных дня)
**Branch:** feat/design-system
**Sections completed:** 24/24 (pilot 03 + 23 full-run)
**Status histogram:** ok=20, partial=2 (14 tape-chart, 21 configuration-profiles), broken=1 (13 cashier), missing=1 (20 configuration-guarantee-codes)
**Bugs filed:** 17 (BUG-001..BUG-017, все IDs contiguous, без пропусков)
**Total commits:** 84 on `feat/design-system` since `main` (`git log --oneline main..HEAD | wc -l`)

Аудит закончен. Все 24 секции имеют terminal status. 17 багов задокументированы в `docs/ui-audit/bugs.yml` — 1 critical (deferred), 2 high, 4 medium, 10 low. Ниже — синтез за весь full-run: паттерны, методология, открытые вопросы для handoff.

## 1. Cross-section patterns

### 1.1 Recurring bug types (top 5)

**i18n gaps / hardcoded strings — 7 bugs, 41% всего bug-списка.**
- BUG-003 (bookings search form), BUG-006 (hkStatusLabels в rooms-list), BUG-008 (config-property labels), BUG-009 (room-detail `<title>` + ancillary labels), BUG-010 (group-code `<option>`s), BUG-011 (Confirmed/Clean keywords в help topics), BUG-012/013/014 (preflight серии — dashboard KPI, cashier-form, bookings-list badge-map).
- Паттерн: server-component `<title>` / top-of-file `Record<K, V>` status-map / hardcoded `<option>` text / inline literals в JSX. Эти места systematically ускользают потому, что они **не looks like UI copy** — они выглядят как внутренние structures.
- Ни один bug **не** был найден в dictionary-backed пути (`t('key')`). Gap всегда там, где разработчик не вспомнил, что нужно wrap'ить строку через `t()`.

**Double-source-of-truth антипаттерн — 3 bugs** (BUG-001 auth-plugin-disabled, BUG-015 cashier-auth-regression, BUG-016 guarantee-codes-hardcoded-enum). Один продуктовый/архитектурный concern в двух независимых местах кода — либо config-page + form оба знают один и тот же enum, либо architectural flag ("auth disabled") живёт в комментарии, а не в runtime guard. Детальный раздел — §5.

**DB constraint gaps — 1 bug** (BUG-002). API валидирует range/enum, но на DB-уровне `CHECK` отсутствует — direct-INSERT даст corrupt row. Вне UI-audit scope, но задокументирован как high-priority follow-up.

**Force-action button bypass — 1 bug** (BUG-004 "Force check-in"). UI предлагает кнопку "Force X", но API gate всё равно отклоняет. Противоречие UI-affordance и API-contract.

**List truncation / pagination gaps — 1 bug** (BUG-017 `/configuration/profiles` показывает 50 из 153). Страница опустила `limit=` query-param, API defaults к 50, нет pagination UI, count-badge вводит в заблуждение.

### 1.2 Recurring help-rewrite deltas

Все 24 секции заполнили `help_rewrite_hints` (от 5 до 86 строк, медиана ~18). Распределение topic:
- **Заполнено реальным topic ID (15 секций):** bookings (4: 02, 03, 04, 05), configuration (2: 15, 20), guests (2: 11, 21), rooms (2: 07, 08), dashboard / check-in-out / packages-configuration / room-types-configuration / transaction-codes-configuration (по 1: 01, 06, 19, 16, 18).
- **topic: null (9 секций):** 09 housekeeping, 10 folio, 12 night-audit, 13 cashier, 14 tape-chart, 17 configuration-rate-plans, 22 help (self-referential), 23 login, 24 i18n-theme.

Паттерны hints:
- **"Add workflow block"** — самый частый: секция описывает реальный user journey, в help topic описания нет. Секции 01 dashboard (58 строк hints), 04 booking-detail (73), 10 folio (86) — три самых подробных workflow hint-блока за full-run.
- **"Fix term drift"** — help topic говорит про `rooms`, секция использует `room-types`; или `guest profile` vs `individual profile` vs `company profile`. Секции 08, 11, 15, 16, 21 accumulate term-drift hints.
- **"Split topic"** — single `configuration` topic покрывает 6 sub-resources. Секции 15-20 все указывают на необходимость per-resource sub-topics. Аналогично `bookings` — 4 секции hint'ят на separate "create flow" vs "edit flow" vs "list/search" vs "detail" блоки.
- **"Correct sidebar/navigation claim"** — help topic ссылается на sidebar item, который был переименован или перемещён. Секции 12, 13, 22 поймали это.

`topic: null` на 9 секциях означает: для этой функциональности help topic либо не был написан, либо был deferred. §4 классифицирует по priority, §6 — open questions.

## 2. Methodology refinements (beyond pilot)

### 2.1 Phase 1 (pilot → Batch A harness, 2026-04-19..20)

- `src/shared.ts` — `loginAsAdmin`, `setLocaleAndGoto`, `setNativeValue`, `pickFirstSelectOption`.
- `src/seed-refs.ts` — canonical seed UUIDs.
- `src/build-gate.ts` — ловит stale `.next/` cache.
- `src/api-probe.ts` — ловит API-drift между планом и реальностью.
- `src/fixtures.ts` — profile-type fixtures + confirmation-number generator.
- `scripts/aggregate.ts` + `scripts/validate-yaml.ts` — index.yml + schema validation.

### 2.2 Phase 1.5 (после Batch A retro, 2026-04-21)

- `registerSectionHooks(sectionId, {extraAfterAll})` — заменил 5 копий `beforeEach`/`afterAll` error-dump boilerplate'а. Контрактно зовёт `extraAfterAll` даже если тесты падают — обеспечивает snapshot-restore.
- Unified booking/folio fixtures: `createConfirmedBooking`, `fetchCheckedInBooking`, `fetchTransactionCode`, `postFolioCharge`, `postFolioPayment`, `getFolio`, `cleanupAuditBookings` — один failure-contract (nullable return), канонические сигнатуры.
- `scripts/probe-state.ts` — runtime state snapshot (rooms by HK×OCC, checked_in bookings histogram, transaction codes, business-date). Используется controller'ом при подготовке брифов.

### 2.3 Revisions (incremental, накапливались между батчами)

| Rev | Источник | Правило |
|---|---|---|
| Rev 1 | Batch B retro | Mandatory pre-flight `probe-state` ПЕРЕД написанием спеки |
| Rev 2 | Batch B retro | `data-testid` > `getByRole` > text > CSS; `toHaveCount(N)` перед `.first()`; CSS-классы запрещены для design-system элементов |
| Rev 3 | Batch B retro | Spec reviewer читает файлы напрямую, не доверяет self-report implementer'а |
| Rev 4 | Batch C retro | Комментарии синхронно обновляются с кодом в fix-loop'ах |

### 2.4 Verdict enum formalisation (Batch C)

До Batch C reviewer'ы могли писать "APPROVED" с двумя Important findings в body. После Batch C:

```
APPROVED                  — 0 Blockers, 0 Importants (Nits ok)
APPROVED_WITH_IMPORTANTS  — 0 Blockers, ≥1 Important (requires fix-loop)
NEEDS_FIXES               — ≥1 Blocker
```

Batch C сразу показал эффект — 5 из 9 секций получили `APPROVED_WITH_IMPORTANTS` от reviewer'а без моих manual'ных интервенций. Batch D — тот же паттерн устоялся.

### 2.5 Tooling (preflight + Batch D)

- `scripts/sync-backlog.ts` — `bugs.yml` → `backlog.json` single-source-of-truth mirror. Убирает "mirror drift" антипаттерн, описанный в Batch C retro 2.3.
- Testid convention `{route-slug}-{element-role}` (+ `config-{slug}-page` wrapper для scoped queries) formalized в Batch C, применялся без drift'а в Batch D.
- Dev-harness ritual (`pnpm --filter @pms/web build` + `kill next-server` + `pnpm start`) стал механическим — ни один Batch D implementer не застрял на "тест не видит testid, который я только что добавил".

### 2.6 Contract-regression tripwires (Batch D discovery)

Batch D родил новый паттерн, которого не было в предыдущих батчах: **positive-invariant tripwires** — сценарии, которые утверждают "фичи X нет" и падают в день, когда фича появится, форсируя re-audit. Примеры: D2 tape-chart scenario 04 (drag-and-drop absent), D3 guarantee-codes scenario 02 (no CRUD affordances), D5 login scenario 04 (no user enumeration). Это превращает YAML'овский `partial` / `missing` статус в исполняемый контракт, а не декоративную строчку.

## 3. Time spent (commit distribution)

Часы не инструментировали; календарь + commit-counts вместо:

| Phase | Calendar | Commits | Notes |
|---|---|---|---|
| Pilot (03 booking-create) | pre-branch (on main) | — | Harness baseline |
| Batch A + Phase 1 harness | 2026-04-19..20 | ~25 | Section 01, 02, 04, 06, 10 + shared.ts, probe-state, fixtures |
| Phase 1.5 + Batch B | 2026-04-20..21 | ~15 | Section 09, 12, 17 + registerSectionHooks, canonical fixtures |
| Batch C | 2026-04-21 | 15 | Section 05, 07, 08, 11, 15, 16, 18, 19, 22 |
| Preflight (post-Batch-C) | 2026-04-21 | 3 | dbd1563 P1 scan → BUG-012/013/014; a6cacf6 Rev 4; d146fa4 sync-backlog |
| Batch D | 2026-04-22 | 11 | Section 13, 14, 20, 21, 23, 24 (7686ef4 → 8026970) |
| F1 preparation | 2026-04-22 | 3 | 8f39703 BUG-001/002 migration; 5f60696 YAML backfill секций 16/18/19/22; 1c86796 screenshot refresh |
| **Total** | **4 calendar days** | **84 commits** | |

## 4. Handoff to help-rewrite initiative

**Sections with `help_rewrite_hints` filled:** 24/24 (100%). Минимум 5 строк (секции 13, 14, 23, 24 — короткие read-only или gated-on-bug), максимум 86 строк (секция 10 folio).

**Sections where `topic: null`:** 9 (09, 10, 12, 13, 14, 17, 22, 23, 24). Разбиение по necessity:

| Priority | Sections | Rationale |
|---|---|---|
| **HIGH** — написать help topic после фикса bug'а | 13 cashier | Shift management — реальный feature. После BUG-015 fix писать topic с нуля |
| **MEDIUM** — полезный topic, но overlap с соседями | 10 folio, 12 night-audit, 14 tape-chart, 17 configuration-rate-plans | 10 частично covered через `check-in-out` + `bookings`; 12 — single-button workflow, 1-page topic хватит; 14 — timeline перекрывается с `rooms`/`bookings`; 17 — `configuration` split решит |
| **LOW** — edge-case или cross-cut | 09 housekeeping, 23 login, 24 i18n-theme | 09 overlaps с `rooms`; 23 — стандартный auth flow, help rare; 24 — settings cross-cut |
| **Deferred** | 22 help (self-referential) | Rewrite itself will update it |

**Sections with existing topic that should be revisited:**
- `configuration` — single topic покрывает 6 resources (15 property, 16 room-types, 17 rate-plans, 18 txn-codes, 19 packages, 20 guarantee-codes). Все 6 секций hints-блоков указывают на split.
- `bookings` — 4 секции (02, 03, 04, 05) hinted на отдельные "create flow" vs "edit flow" vs "list/search" vs "detail" блоки.

Help-rewrite initiative получает: 24 раздела hints, 9 topic-gaps, 2 split-candidates. Full-run audit — single-source-of-truth input для этой работы.

## 5. Продуктовые наблюдения вне scope багов

**Double-source-of-truth антипаттерн** surface'ился в 3 независимых местах full-run'а и **заслуживает product-level attention beyond individual BUG ID'ов:**

| Локация | Первый источник | Второй источник | Bug ID |
|---|---|---|---|
| Cashier auth | `apps/api/src/app.ts:34` (auth plugin registration закомментирован) | `apps/api/src/routes/cashier.ts:62,96` (handlers всё равно deref'ают `request.user?.id`) | BUG-001 + BUG-015 |
| Guarantee codes | `apps/web/src/app/configuration/guarantee-codes/page.tsx:1-76` (docs stub с 5 кодами) | `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx:609-613` (form `<option>`s с теми же 5 кодами) | BUG-016 |
| Architectural flag "auth disabled" | `app.ts:34` (комментарий-only) | Нет runtime guard — regression поймали только через UI-audit | BUG-001 |

Ни BUG-015, ни BUG-016 по отдельности не ловят этот product-level concern — они фиксируют симптом. Fix требует совместного ревью API + UI + data-model, не просто patches в одном файле.

**Рекомендация для follow-up architecture audit:**
- `grep` repo для hardcoded enums, которые должны быть shared constants module.
- `grep` middleware registrations на consistency (зарегистрированы ли all protected route handlers).
- Любой feature flag, живущий в комментарии, должен быть превращён в runtime guard или удалён вместе со всем зависимым кодом.

Это отдельная задача, не UI-audit scope, но audit-данные делают её actionable.

## 6. Open questions / deferred work

- **BUG-001 activation** (critical, deferred). Once frontend auth UI полностью wired, uncommenting `app.register(authPlugin)` в `app.ts:34` требует cross-route audit (see BUG-015 для cashier-specific пример). Скорее всего потребуется повтор Batch A full-run после активации.
- **BUG-002 DB CHECK constraints** (high). Не UI-audit scope — нужен dedicated schema-migration task.
- **BUG-004 force check-in bypass** (low). Продуктовое решение: UI должен скрыть "Force" кнопку, или API должен её respect'ить? Сейчас — противоречие.
- **BUG-016 guarantee-codes** (medium). Fix option A (full CRUD + API) vs option B (shared constants module + import). Продуктовое решение: нужна ли реальная configurability или достаточно consistency?
- **BUG-017 profiles list truncation** (medium). Canonical fix — pagination UI как на `/guests`. Простой implement.
- **Section 22 (help) shipped перед section 20 (guarantee-codes)**. `help` index не упоминает guarantee-codes topic, потому что его ещё не писали. Follow-up: когда 20 получит CRUD, добавить topic.
- **Screenshot snapshot policy.** 60+ PNG'ов modified в git status от re-runs Batch A-C. В F1 был включён один `chore(ui-audit): refresh screenshots` commit (1c86796). Долгосрочная policy (commit vs gitignore) остаётся на пользователе.
- **ESLint rule `no-hardcoded-status-labels`** (Batch C retro Section 2.1, tactical fix применён). Systemic fix — добавить custom rule, ловящую `Record<string, string>` с domain-specific ключами без wrapped `t()`. Опционально, отдельный task.
- **Auto-rebuild скрипт на page.tsx changes** (Batch D Section 6.2). Уберёт dev-harness ritual как manual step. Эргономика, не blocker.
- **Testid-reference линтер** (Batch D Section 6.2). Ловит dead entries в selector arrays — symptom D6 `topbar-search` silent-skip.
- **Full-run retro addendum.** Этот документ закрывает audit production phase. Если в future sections (после фиксов) проявится systemic pattern, не called out here — report как `docs(ui-audit): full-run retro addendum`, не override этот документ.

## 7. Metrics — full-run summary

| Metric | Pilot | Batch A | Batch B | Batch C | Preflight | Batch D | Total |
|---|---|---|---|---|---|---|---|
| Sections | 1 | 5 | 3 | 9 | — | 6 | 24 |
| Bugs filed | 0 | 2 | 0 | 5 | 3 | 3 | 13 (+ 4 legacy/cross-batch) |
| Commits | — | ~25 | ~15 | 15 | 3 | 11 | 84 (incl. harness + F1 prep) |
| Status: ok | 1 | 5 | 3 | 9 | — | 2 | 20 |
| Status: partial | 0 | 0 | 0 | 0 | — | 2 | 2 |
| Status: broken | 0 | 0 | 0 | 0 | — | 1 | 1 |
| Status: missing | 0 | 0 | 0 | 0 | — | 1 | 1 |

Notes:
- Bug count split: 13 filed during audit batches, plus 4 cross-batch (BUG-001/BUG-002 pre-audit migrated в F1; BUG-005/BUG-007 filed в Batch C retrospectively против pilot+Batch-A sections).
- Bug `bugs.yml` total: 17. Aggregate script counts per-section `bugs` field в feature YAML'ах → 12 (не включает pre-audit и retrospectively-filed против уже-closed section'ов).
- Batch D имеет highest bug/section ratio (3/6 = 0.5) и full status-enum exercise — evidence, что audit scope был right-sized (small late batch surface'ит edge-of-spec gaps, которые earlier batches structurally не могли).

## 8. Closing notes

- **24/24 terminal status** — ни одной `pending` секции; histogram polished через Batch D status-flip discipline.
- **17 bugs with contiguous IDs BUG-001..BUG-017** — никаких пропусков. Все имеют `file:line` cite + concrete repro steps + fix options A/B где применимо.
- **Retro chain complete:** pilot → Batch A → Batch B → Batch C → Batch D → full-run. Каждый retro читал предыдущий и ссылался на actionable items (Rev 1-4, verdict enum, sync-backlog — все родились из cross-retro feedback).
- **`validate-yaml`** — green на 24/24 после F1 backfill (8f39703 + 5f60696).
- **Aggregate** — `sections=24, ok=20, partial=2, broken=1, missing=1, pending=0, bugs=12` (per-section count; см. §7 notes о расхождении с total=17).
- **Screenshots** — 170+ артефактов для 24 секций × 2 локалей. Refresh commit 1c86796 закрыл drift от re-runs.

Full-run завершён. Phase 6 F2 (PR handoff) — следующий шаг.
