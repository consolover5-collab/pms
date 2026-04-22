# Batch B Retrospective

**Date:** 2026-04-21
**Sections covered:** 09 housekeeping, 12 night-audit, 17 rate-plans (3 sections)
**Status histogram:** ok=3 partial=0 broken=0 missing=0
**Bugs filed:** 0 (no new production bugs surfaced)
**Unblocker fixes:** assign-flow is onBlur text input (09), wizard label + sidebar card-title duplicate (12), Preview button triggers POST on click not mount (12), web rebuild + server restart required after new testids (17)
**Total subagent time:** ~100 min (30 + 35 + 35). Section 09 consumed 3 subagent iterations; 12 one-shot; 17 two iterations.

Commits (`git log --oneline 908c440..HEAD -- tools/ui-audit apps/web/src/app/housekeeping apps/web/src/app/configuration`):
`75676e1` (09 ok) → `1509d85` (09 testids) → `a843d95` (09 quality) → `5f1c16b` (12 ok) → `a8157e3` (17 ok) → `a531bc3` (17 testid).

## 1. Что работает (keep doing)

- **Revisions 1-3 compliance** (pre-flight probe, testid-first locators, reviewer reads files directly) поймали реальные проблемы, а не теоретические. Section 17 probe открыл `isDefault` vs `isBaseRate` drift ДО написания спеки — экономия на fix-loop позднее. Section 09 probe подтвердил наличие 4 статусов задач (pending/in_progress/completed/skipped) и их переходов — spec бил точно.
- **Learning transfer между секциями Batch B**. Section 12 implementer применил все паттерны из Section 09 fix-loop (testid-first locators, `toHaveCount(N)` перед `.click()`, visibility guards перед `.count()`) на первой итерации — spec reviewer одобрил без fix-loop. Это подтверждает: нит из предыдущей секции инстинктивно цитируется implementer'ом.
- **Read-only audit (Option A) для Section 12** оказался правильным выбором. Preview read-only endpoint покрыл 4 сценария (idle, preview compute, preflight checklist, run button state). Полная мутация (click Run) отложена как "intentionally untested — no DB snapshot harness", inline-комментарий в спеке + commit message эту границу зафиксировали.
- **extraAfterAll safety-net в `registerSectionHooks`** (product Phase 1.5) работает как контракт. Section 09 чистит мутированные tasks через resetTasks; Section 17 удаляет createdPlanId + ресетит BAR STD rate обратно к 4275.00. API re-probe в обеих секциях подтвердил изоляцию.
- **Serial mode + en-only mutation gate** — тот же паттерн Batch A, применён без изменений в 09 и 17. Подтверждает зрелость pattern'а.
- **Pre-flight API probe через curl/direct call** для Section 12 (вместо запуска `probe-state` script) оказался быстрее. `probe-state` покрывает broad state; конкретный endpoint (`POST /api/night-audit/preview`) даёт точные данные для спеки.

## 2. Что идёт не так (нужно исправить перед Batch C)

### 2.1 Implementer brief не всегда доносит testid-first требование

**Section 09 потребовала 3 итерации**. Breakdown:
1. `75676e1` — initial implementation, CSS-class coupling в 6 местах (`.kcard`, `.kpi .val`, `select.select`, `input.input`)
2. `1509d85` — fix после spec review: добавление 5 testid'ов в `housekeeping-client.tsx` + замена локаторов
3. `a843d95` — fix после code-quality review: dead const `TASK_ROOM_204_ID`, missing `toBeVisible()` guards перед `.count()`

**Root cause:** мой бриф implementer'у цитировал Revision 2 ("testid > role > text > CSS") формально, но не акцентировал "**если existing компонент не имеет testid, добавь его**". Implementer прочитал это как "предпочитай что есть", а не как "если нет — создавай".

**Fix для Batch C**: implementer brief должен содержать явный bullet:
> Pre-check: перед написанием спеки **прочитай** route компонент(ы). Если там нет `data-testid` на ключевых элементах (cards, lists, inputs, buttons, badges) — добавь их в том же коммите, что и спеку. Не write around отсутствующие testid'ы, CSS-классы **запрещены**.

### 2.2 Reviewer self-contradiction — паттерн, который появился дважды

Оба раза headline verdict и body findings расходились:

| Секция | Stage | Headline | Body |
|---|---|---|---|
| 09 | code-quality | "APPROVED_WITH_NITS" | Two "Important" findings (dead const, missing guards) |
| 17 | spec | "APPROVED" | Notes `.t tbody tr` is "marginally acceptable but violates Revision 2" |

**Resolution**: я в обоих случаях верил содержимому, а не headline — отправлял fix-loop. **Oбa fix-loop'а были правильны**: нашли реальные issues, которые могли бы стать latent flakes.

**Причина**: reviewer'ы получают четыре категории severity (Blocker / Important / Nice-to-have / Nit), но "APPROVED" как verdict не запрещает Important findings. Контракт нечёткий.

**Fix для Batch C**: в reviewer prompt добавить явное правило:
> Если ты находишь хотя бы один **Important** — verdict не может быть APPROVED. Используй `NEEDS_FIXES` или `APPROVED_WITH_IMPORTANTS`. Nice-to-haves и Nits одобрение не блокируют.

### 2.3 Build-cache и testid invalidation

Section 17 столкнулась с build-cache issue: добавил `data-testid` в `rate-plans-list.tsx`, но playwright не видел — server.js всё ещё отдавал старый bundle (PID 4472 from pre-rebuild, global-setup ran against cached build). Fix: `pkill -f server.js && pnpm start` + `pnpm --filter web build`.

Это **не** regression — это особенность Next.js production builds. Но для Batch C+ это нужно в чеклисте:

- [ ] После изменения client-component (especially adding testids) → `pnpm --filter web build`
- [ ] Kill existing Next.js process + restart
- [ ] Ре-run `probe-state` чтобы global-setup забрал новый bundle hash

### 2.4 Plan-vs-reality drift — меньше, чем в Batch A, но всё ещё есть

Batch A имел 2-5 drifts per section. Batch B — меньше, потому что pre-flight probe был обязателен:

| Секция | Главное отклонение |
|---|---|
| 09 | plan: assign через dropdown/select; реально: плоский text input + onBlur |
| 12 | plan: "Run button disabled когда preflight не чист"; реально: preflight чист → button enabled (adapted to assert "enabled when clean") |
| 17 | **3 отклонения**: `isBaseRate` → `isDefault`; roomTypes=0 в probe (response shape artefact — в UI 6 rows); DELETE returns 400, не 409 |

**Observation**: все drift'ы оказались cosmetic — implementer мог адаптировать спеку в пределах scope. Но adaptation была документирована в `edge_cases` секции YAML'а — хороший паттерн, этому следует продолжать.

### 2.5 Section 17 orphan bookings artefact (документировано, не blocker)

Phase 1.5 Task B (`f61df81`) оставила 7 orphan bookings от Alexander Fedorov без rate plan. Section 12 probe показал `rateAmount=0` для этих 7 rows. **Не блокер**: `estimatedRevenue` их корректно исключает из суммы, UI рендерит "0 ₽". Отмечено в `edge_cases.orphan-bookings-rateAmount-zero` с `status: known_data_issue`.

**Для Batch C**: если увидим повторное появление в секциях 13 reservations / 14 financial-reports / 23 revenue-analytics — нужен seed fix. Пока стабильно документируем.

## 3. Phase 1.5 retrospective — что реально окупилось

Phase 1.5 потратила ~3 субагент-задачи (shared hooks, fixtures, probe-state). Batch B подтвердил inventment:

| Actionable | Использование в Batch B | Оценка |
|---|---|---|
| `registerSectionHooks(sectionId, {extraAfterAll})` | 09: resetTasks; 17: deleteCreatedPlan + resetBarRate | **High value** — нулевой boilerplate, afterAll контрактно вызывается |
| Canonical `fetchTransactionCode/createConfirmedBooking` fixtures | Не использовались в Batch B (нет booking-мутаций) | Deferred value — ждут Batch C (секции 05, 07, 08, 11 могут трогать bookings) |
| `probe-state` script | 09: HK tasks probe; 12: curl был быстрее; 17: rate plans probe | **Medium value** — полезен для bulk state, но point-probes иногда быстрее |
| Revisions 1-3 (preamble) | Обязательный reference во всех 3 брифах | **High value** — implementer'ы цитируют revisions как contract |
| Audit-orphan cleanup через `notes` marker | Не использовалось — ни одна Batch B секция не создавала multi-booking orphans | Deferred — Batch C секции 05 housekeeping-overview и 11 arrivals/departures могут инициировать |

**Conclusion**: Phase 1.5 окупилась примерно на 60% в Batch B, остальные 40% активируются в Batch C/D когда появятся booking-heavy секции.

## 4. Batch C scenario sniff (секции 05, 07, 08, 11, 15, 16, 18, 19, 22)

Предварительная категоризация (до детального plan-review для Batch C):

| Секция | Route | Mutation profile | Risk |
|---|---|---|---|
| 05 | /housekeeping/overview | Read-only dashboard | Low |
| 07 | /reservations/group | Group booking CRUD | Medium — multi-room |
| 08 | /guests | Guest profile CRUD | Medium — affects bookings |
| 11 | /arrivals-departures | Read-only + status transitions | Low |
| 15 | /configuration/properties | Property CRUD | **High** — property mutation shared state |
| 16 | /configuration/rooms | Room CRUD | **High** — rooms used everywhere |
| 18 | /configuration/market-segments | Config CRUD | Low |
| 19 | /configuration/transaction-codes | Config CRUD | Medium — affects folio |
| 22 | /reports | Read-only | Low |

**High-risk секции 15 + 16 требуют special handling**: создание/удаление rooms/properties влияет на ВСЕ остальные тесты. Предлагаю:
- Для 15: mutation-scope ограничить ИЗМЕНЕНИЯМИ существующего property (not create/delete)
- Для 16: создание only тестовой комнаты с unique номером (R999) + guaranteed cleanup в afterAll

### Testid convention для Batch C

Batch B ad-hoc добавляла testid'ы: `hk-task-card`, `hk-kpi-value`, `rate-plan-row`, `rate-plan-default-badge`, `rate-matrix-row`. Паттерн стихийно: `{feature}-{purpose}`.

**Рекомендация**: formalize convention ДО Batch C start:
```
{route-slug}-{element-role}
```
Примеры:
- `/housekeeping/overview` → `hk-overview-kpi-value`
- `/reservations/group` → `group-booking-row`
- `/configuration/rooms` → `room-row`, `room-status-badge`
- `/reports` → `report-card`, `report-metric-value`

Это даст возможность grep'ать testid'ы по feature и не столкнуться с collision (`rate-plan-row` vs `room-rate-row`).

### Reviewer verdict contract

Формализовать как часть implementer-prompt / reviewer-prompt:
```
VERDICT_ENUM:
  APPROVED                  — 0 Blockers, 0 Importants (Nits ok)
  APPROVED_WITH_IMPORTANTS  — 0 Blockers, ≥1 Important (requires fix loop)
  NEEDS_FIXES               — ≥1 Blocker
```

## 5. Ready for Batch C?

- [ ] **Testid convention formalized** — `{route-slug}-{element-role}` + добавить в `docs/superpowers/plans/2026-04-21-ui-audit-full-run.md` preamble
- [ ] **Reviewer verdict contract** — explicit enum в reviewer-prompt.md
- [ ] **Section 15 + 16 mutation strategy** — user decision: создавать test-property/test-room или только editing existing
- [ ] **Seed-reset strategy для booking-heavy секций** — формализовать "marker + cleanup" pattern ДО секции 07 (group reservations)
- [ ] **User gate approved** — пользователь видит retro и решает идти Batch C или pause

Batch C включает 9 секций (втрое больше чем Batch B) и 3 high-risk раздела (15, 16 и частично 07). Рекомендую short plan-revision + user approval перед запуском.
