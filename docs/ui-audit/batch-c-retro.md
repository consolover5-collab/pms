# Batch C Retrospective

**Date:** 2026-04-21
**Sections covered:** 05 booking-edit, 07 rooms-list, 08 room-detail, 11 profiles, 15 configuration-property, 16 configuration-room-types, 18 configuration-transaction-codes, 19 configuration-packages, 22 help (9 sections)
**Status histogram:** ok=9 partial=0 broken=0 missing=0
**Bugs filed:** 5 (BUG-006, BUG-008, BUG-009, BUG-010, BUG-011 — 4 i18n, 1 seed-data mismatch)
**Screenshots:** 60 artefacts matching `(05|07|08|11|15|16|18|19|22)-`
**Iteration histogram:** one-shot (05, 08, 11, 18) = 4; two-shot (15, 16, 19, 22) = 4; three-shot (07) = 1
**Total commits:** 15 (from `430ef23` section 05 → `1bd32af` section 22 fix)

Commits:
```
430ef23 section 05 booking-edit — ok
7a32963 section 07 rooms-list — ok
4d53bac section 07 → register BUG-006 in bugs.yml
c38a5c2 section 07 → align BUG-006 description + scenario 07 nits
44d3e8b section 08 room-detail — ok
f1adba7 section 11 profiles — ok
dcd7efd section 15 config-property — ok
3a3e496 section 15 → file BUG-008 + correct stale numberOfRooms references
310a7ac section 16 config-room-types — ok
669025e section 16 → stale HAS_ROOMS refs + tighten extraAfterAll restore verify
080d2ef section 18 config-txn-codes — ok
4e38281 section 19 config-packages — ok
6b40fdb section 19 → address code-quality review (3 Importants + Nits)
e3b4a66 section 22 help — ok
1bd32af section 22 → address spec review (2 Importants + opportunistic Nits)
```

## 1. Что работает (keep doing)

### 1.1 Verdict enum enforcement (Batch B actionable окупилось)

Формализованный в Batch B retro контракт `APPROVED / APPROVED_WITH_IMPORTANTS / NEEDS_FIXES` сработал как задумывалось. Reviewers в Batch C в 5 из 9 секций возвращали `APPROVED_WITH_IMPORTANTS` или `NEEDS_FIXES` с явной ссылкой на "≥1 Important = not APPROVED" — fix-loop срабатывал без моих manual'ных интервенций. Примеры:
- **Section 19** spec reviewer: "3 Importants found — verdict: APPROVED_WITH_IMPORTANTS. Cannot approve without addressing these."
- **Section 22** spec reviewer: "2 Importants + 3 Nits — verdict: APPROVED_WITH_IMPORTANTS."
- **Section 15/16** code-quality reviewer's verbose expected-vs-actual diffs стали самим forcing function'ом для implementer'а.

Это подтверждает: формальный enum-контракт убирает self-contradiction паттерн, описанный в Batch B Section 2.2.

### 1.2 Snapshot-restore discipline для HIGH-risk секций 15 + 16

Обе high-risk секции (property mutation, room-types mutation) прошли одним паттерном:
1. **beforeAll** снимает snapshot shared-state (name, address, currency, roomTypes по id/name/sortOrder/maxOccupancy).
2. **Mutation тест** выполняет edit → assert UI/DB реально изменились.
3. **extraAfterAll** восстанавливает field-by-field + **throws CRITICAL** если что-то не восстановилось, с expected vs actual в сообщении.

Section 16 commit `669025e` добавил особенно строгую проверку: JSON-stringify sorted-tuples сравнение всего списка roomTypes. Если порядок/состав изменился — throw с двумя JSON-строками. Это даёт **детектируемый sheared-state leak** в логах, а не тихо зелёные тесты рядом с загрязнённой БД.

Никакого shared-state drift-а в следующих секциях Batch C не наблюдалось — snapshot-restore работает.

### 1.3 Learning transfer между секциями

Как и в Batch B, implementer автоматически цитирует паттерны из предыдущих секций. Примеры:

| Source | Transfer | Target |
|---|---|---|
| 15 snapshot-restore throw | Field-by-field expected vs actual | 16 room-types list-equality |
| 18 api-only adaptation | `missing_actions` + scenario.mutation_note | 19 delete + 22 missing-topic |
| 07 testid `{slug}-{role}` convention | Compound `data-room-id`, `data-topic-id` | 16, 19, 22 |
| 11 API-only scenario | Network assert via `/api/guests` GET | 19 rate-plan attach verify |

Это подтверждает: **первый брифинг в Batch задаёт тон**, остальные implementer'ы добывают паттерны из уже закоммиченного кода.

### 1.4 API-only scenario adaptation pattern

Секции 11, 18, 19, 22 все столкнулись с "в плане UI-действие, в реальности UI нет". Паттерн adaptation теперь стабилен:
1. Implementer документирует в YAML: `missing_actions:` block с `ui_surface: absent`, `api_coverage: present`, `test_strategy: api_only`.
2. Scenario ставит `mutation: true` + `mutation_note: "Transient — net-zero persistent change..."` если API вызывается.
3. Assert через `apiFetch` или `page.request.get('/api/...')` — скриншот остаётся но показывает UI-state без кнопки.

Это корректно кодифицирует реальность вместо того, чтобы требовать фичу, которой нет. YAML становится продуктовым артефактом — "что мы тестируем и что не тестируем" — не просто тест-планом.

### 1.5 Phase 1.5 `registerSectionHooks` полностью окупился

Batch B retro отмечал окупаемость ~60%. Batch C добил до **~100%**:
- 15 использовал `extraAfterAll` для property rollback
- 16 использовал для roomTypes list-equality
- 19 использовал для BAR/RACK/CORP rate-plan link restore
- 22 не использовал (read-only) — но helper не блокировал

Нигде boilerplate afterAll не писался руками. Contract между Phase 1.5 helper и section specs стал зрелым.

## 2. Что идёт не так (нужно исправить перед Batch D)

### 2.1 i18n-patchy coverage — systemic, не incidental

**Главное открытие Batch C.** Из 9 секций 4 родили i18n-багов: BUG-006, BUG-009, BUG-010, BUG-011. Секции 18 (tx codes) бы тоже сгенерировала, просто в ней было более широкое покрытие — выплыло как "часть" BUG-010. Если экстраполировать на весь проект, значит **каждая 2-я конфигурационная страница имеет минимум один hardcoded English fallback**.

Паттерны гапов одинаковые:

| Локация | Тип гапа | Пример bug |
|---|---|---|
| Status/badge labels | Record-map с en-значениями | BUG-006 hkStatusLabels, BUG-011 "Confirmed"/"Clean" keywords |
| Action buttons не через t() | Literal string в JSX | BUG-006 "Set Out of Order" |
| `<title>` / default page metadata | Server-rendered, no i18n | BUG-009 detail page title |
| Dict-options в `<select>` | Hardcoded `<option>text</option>` | BUG-010 group-code options |

**Root cause**: i18n добавлялась incrementally, feature by feature. Когда разработчик добавлял NEW feature, он кидал новые строки в dictionary, но SHARED UI-кусочки (status-map в top-of-file, formatCurrency locale, enum-badges) переустанавливались без t(). Нет централизованного enforce'а — lint не ловит.

**Fix для Batch D и beyond** — две опции, на выбор пользователя:
- **Tactical** (быстрее): перед Batch D выделить 1 subagent-задачу "scan-all-i18n-gaps" — grep по паттернам `const.*Labels.*Record` и `'Clean'|'Dirty'|'Confirmed'|'Checked'` в `/apps/web/src/app/**/*.tsx`. Зарегистрировать все оставшиеся гапы как единую серию BUG-XXX одним batch'ом ДО Batch D test-runs. Это отфильтрует большую часть повторяющихся фишей.
- **Systemic** (дольше): добавить ESLint rule `no-hardcoded-status-labels` который ловит pattern `Record<string, string>` с domain-specific ключами без wrapped t(). Закрывает root cause.

Рекомендую tactical — гапы и так все registered как BUG'и (P1+P2 backlog), ESLint требует отдельного плана.

### 2.2 Stale-comment fix-loop pattern

**Pattern observed twice** в Batch C (section 15 and section 16):
1. Initial implementation использует `HAS_ROOMS` или `numberOfRooms` константу.
2. Fix-loop заменяет термин на более точный (`HAS_DEPENDENCIES`, убирает числовую привязку).
3. Fix-loop меняет код, но **комментарии, описывающие `HAS_ROOMS`, остаются**.
4. Code-quality reviewer ловит comment-vs-code drift, возвращает Important.
5. Ещё один round — implementer обновляет комментарии.

Это **два лишних round'а** на секциях 15 и 16.

**Root cause**: когда implementer пишет fix-loop, он фокусируется на "заменить магическое число на set-equality", но комментарий не включается в diff'а reviewer не сказал явно.

**Fix для Batch D** — добавить в implementer-prompt явный bullet:
> Когда меняешь имя константы / семантику mutation / field names в restore — grep for references в comments. Обновляй комментарии в том же diff'е. Reviewer будет искать `/XXX.*comment.*/` references.

### 2.3 bugs.yml ↔ backlog.json mirror drift

**Pattern observed twice** (section 07 → BUG-006 и section 22 → BUG-011):
1. Bug заносится в обa файла одновременно.
2. В bugs.yml — полное описание, severity, steps_to_reproduce, affected_files, fix с деталями.
3. В backlog.json — условно "condensed" описание, с 1-2 sentence fix.
4. Code-quality reviewer ловит "fix в backlog.json менее actionable чем в bugs.yml".
5. Fix-loop копирует verbatim.

**Root cause**: нет contract'а о том, что backlog.json — это **mirror** bugs.yml (строгий копипаст), а не "executive summary". Implementer делает summary потому что файлы выглядят как разные audiences.

**Fix для Batch D**:
- Option A (процесс): в implementer-prompt явно сказать "backlog.json — строгий mirror bugs.yml, fix секция копируется verbatim без summarization".
- Option B (tooling): script `bugs-sync.mjs` который читает bugs.yml и генерирует backlog.json entries под ключом `open_bugs`. Убирает manual sync.

Рекомендую **Option B** — mirror drift будет возникать снова иначе. Script занимает ~30 мин одному subagent'у, еденовременная стоимость.

### 2.4 Plan-vs-reality drift — 4 отклонения, меньше чем в Batch A/B

В Batch C drift'ы были, но **все 4 — cosmetic adaptation**, не architectural. Implementer добавлял `edge_cases`/`missing_actions` блок и продолжал:

| Секция | План говорил | Реально | Adaptation |
|---|---|---|---|
| 15 | HAS_ROOMS флаг для "нельзя удалить property" | HAS_DEPENDENCIES (broader) — includes bookings, not just rooms | Переименована константа, spec обновлена |
| 16 | numberOfRooms seed=50 | seed=54 | Убрана жёсткая привязка, set-equality |
| 19 | "Edit by adding component" | Package имеет monolithic schema, no components | Переименован scenario 02 в "edit-existing" |
| 19 | Verify via rate-plan detail UI | UI detail route отсутствует | `GET /api/rate-plans/:id/packages` API-probe |
| 22 | `response.status() === 404` для missing-topic | Next.js 15 RSC возвращает 200 на notFound() | Content-assertion `body.toContainText('could not be found')` |

**Observation**: drift'ы появляются когда план писался ДО pre-flight probe. Revisions 1 (mandatory probe) уменьшает drift, но не убирает — некоторые детали видимы только после реального запуска UI (например, Next.js 15 RSC 404 behavior виден только из DevTools).

**No action needed** — паттерн работает, adaptation документируется правильно.

### 2.5 Screenshot artefact — нужен re-baseline?

60 скриншотов (по 6-7 на секцию в среднем) — тестовый output теперь занимает много места. Git status показывает `M` на многих screenshot'ах из предыдущих batch'ей (значит, pixel drift между runs). Не блокер, но:

**Для финального PR**: нужно решить — коммитить ли snapshot-файлы или они ignored (text-first audit). Если ignored — добавить в `.gitignore`. Если committed — `git add -A docs/ui-audit/screenshots/` перед финализацией.

**Рекомендация**: пользователь решает после Batch D (не блокирует Batch D start).

## 3. Phase 1.5 retrospective — полная окупаемость достигнута

Batch B retro обещал что оставшиеся 40% Phase 1.5 helpers "активируются в Batch C/D когда появятся booking-heavy секции". Verification:

| Actionable | Использование в Batch C | Оценка |
|---|---|---|
| `registerSectionHooks` + `extraAfterAll` | 15, 16, 19 — все 3 HIGH/MEDIUM mutation секции | **High value** — продолжает работать |
| `createConfirmedBooking` / `cleanupAuditBookings` | 05 booking-edit ✓, 08 room-detail (through booking link) ✓ | **High value** — окупился |
| `fetchTransactionCode` | Не использовался — tx codes секция (18) читала через `/api/transaction-codes` напрямую | **Low value** — deferred до folio-write секций (D: 13, 14) |
| `probe-state` script | 15 probe property, 16 probe roomTypes, 19 probe packages | **High value** — 3/3 high-risk секций probed |
| Revisions 1-3 (preamble) | Обязательный reference во всех 9 брифах | **High value** — устойчивый контракт |

**Conclusion**: Phase 1.5 окупилась на ~95% в Batch C. Оставшийся `fetchTransactionCode` активируется в Batch D (folio write-path секции 13 reservations-list и 14 financial-reports).

## 4. Batch D scenario sniff (секции 13, 14, 20, 21, 23, 24)

Предварительная категоризация (до детального plan-review для Batch D):

| Секция | Route | Mutation profile | Risk |
|---|---|---|---|
| 13 | /reservations | Read-only list + filters | Low |
| 14 | /reports/financial | Read-only dashboard | Low |
| 20 | /configuration/meal-plans | Config CRUD | Medium |
| 21 | /configuration/company-profiles | Company profile CRUD | Medium |
| 23 | /reports/revenue | Read-only aggregation | Low |
| 24 | /login | Auth boundary | Low (single page) |

**Risk assessment**: Batch D — **lowest-risk batch**. Нет HIGH-risk секций (15 + 16 уже закрыты в C). Основная сложность — финальный retro + PR handoff.

### Testid convention для Batch D

Pattern `{route-slug}-{element-role}` устоялся. Новые testid'ы для Batch D:
- `/configuration/meal-plans` → `meal-plan-row`, `meal-plan-code`, `meal-plan-form-*`
- `/configuration/company-profiles` → `company-profile-row`, `company-profile-name` (если нет — добавить)
- `/reports/financial` → `financial-report-card`, `financial-metric-value`
- `/reports/revenue` → `revenue-chart-bar`, `revenue-summary-card`
- `/login` → `login-form`, `login-email-input`, `login-password-input`, `login-submit`

### Seed-reset strategy для Batch D

Все Batch D секции — либо read-only (13, 14, 23, 24), либо config-CRUD (20, 21) с существующим snapshot-restore pattern. **Новых seed стратегий не требуется**.

## 5. Готовность к Batch D

- [ ] **Tactical i18n scan** — subagent-задача "grep-all-hardcoded-status-labels" ДО Batch D start (пункт 2.1). Даёт batch-регистрацию оставшихся гапов.
- [ ] **Stale-comment bullet в implementer-prompt** — добавить в preamble плана (пункт 2.2).
- [ ] **`bugs-sync.mjs` script** — generate backlog.json из bugs.yml (пункт 2.3). Опционально — если не делаем, добавить явный verbatim-copy bullet.
- [ ] **Screenshot commit policy decision** — пользователь решает ignore vs commit (пункт 2.5).
- [ ] **User gate approved** — пользователь видит retro и решает идти Batch D или pause.

Batch D включает 6 секций (меньше всех предыдущих батчей), 0 high-risk. Это финальный production batch перед общим retro + PR handoff.

## 6. Статистика по всему full-run на 2026-04-21

| Stage | Sections | Iterations (one-shot / multi-shot) | Bugs filed | Phase 1.5 coverage |
|---|---|---|---|---|
| Pilot (03) | 1 | one-shot | 0 | N/A (pre-1.5) |
| Batch A | 5 | 1 one / 4 multi | 2 (003, 004) | 40% |
| Phase 1.5 | — | 3 tasks | — | self |
| Batch B | 3 | 1 one / 2 multi | 0 | 60% |
| **Batch C** | **9** | **4 one / 5 multi** | **5 (006, 008, 009, 010, 011)** | **95%** |
| Batch D (pending) | 6 | — | — | expected 100% |
| Finalization | — | retro + PR | — | — |

**Текущий прогресс**: **18/24 секций green (75%)**, 7 bugs filed total (003, 004, 006, 008, 009, 010, 011). Batch D остаётся — и финализация.
