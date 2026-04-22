# Batch D Retrospective

**Date:** 2026-04-22
**Sections covered:** 13 cashier, 14 tape-chart, 20 configuration-guarantee-codes, 21 configuration-profiles, 23 login, 24 i18n-theme (6 sections)
**Status histogram:** broken=1 (13), partial=2 (14, 21), missing=1 (20), ok=2 (23, 24)
**Bugs filed:** 3 (BUG-015 cashier-auth-commented, BUG-016 guarantee-codes-hardcoded-enum, BUG-017 profiles-list-truncation)
**Screenshots:** 40 artefacts matching `(13|14|20|21|23|24)-`
**Iteration histogram:** one-shot (13 cashier, 23 login) = 2; two-shot (20 guarantee, 21 profiles, 24 i18n) = 3; three-shot (14 tape-chart) = 1
**Total commits:** 11 (from `7686ef4` section 13 → `8026970` section 24 fix)

Commits (`git log --oneline a6cacf6..HEAD`):
```
7686ef4 section 13 cashier — broken
d751837 section 14 tape-chart — partial
6d412c5 section 14 → fix scenario 04 tripwire + dedupe data-group-code
0593afe section 14 → correct crossref to booking-detail room-move
3e26a08 section 20 config-guarantee-codes — missing
3f697ff section 20 → fix layout-chrome api calls + tighten crud regex
4b77e98 section 21 config-profiles — ok (BUG-017)
26caa11 section 21 → flip to partial + correct /guests pagination claim
f154396 section 23 login — ok
c30129b section 24 i18n-theme — ok
8026970 section 24 → topbar-search testid + broaden chrome selectors + document tbody gap
```

## 1. Что работает (keep doing)

### 1.1 Contract-regression tripwires — первый cross-section паттерн Batch D

Batch D родил устойчивый паттерн, которого не было в предыдущих батчах: **positive-invariant tripwires** — сценарии, которые утверждают "фичи X нет" и падают в тот день, когда фича появится, форсируя re-audit.

| Section | Tripwire scenario | Invariant |
|---|---|---|
| D2 tape-chart | `scenario 04` | drag-and-drop absent; `POST /api/bookings/:id/move-room` отсутствует как UI-invoker |
| D3 guarantee-codes | `scenario 02` | no create/edit/delete affordances; page is static stub |
| D5 login | `scenario 04` | no user enumeration на неправильный email vs неправильный password |

Это **не** "skip" — это активная проверка что gap всё ещё существует. Commit `6d412c5` (D2 real endpoint probe) и `8026970` (D6 broadened chrome selectors) — примеры того, как tripwire'ы укреплялись: сначала был наивный negative-assertion, затем — конкретный endpoint probe / selector-count. Это превращает YAML'овский `partial`/`missing` статус в исполняемый контракт: день, когда продукт закрывает гап, автоматически требует обновления спеки.

### 1.2 Status enum наконец-то полностью откалиброван

Batch A, B, C все отправили исключительно `ok`. Batch D — первый батч, где 4-значный enum `broken / partial / missing / ok` был упражнён полностью:
- **broken** — D1 cashier (auth plugin закомментирован → все handler'ы 500)
- **partial** — D2 tape-chart (grid рендерится, но drag недоступен), D4 profiles (показывает 50 из 153)
- **missing** — D3 guarantee-codes (static stub, нет CRUD, нет API)
- **ok** — D5 login, D6 i18n-theme

Controller judgment call на D4 (`ok → partial` после code-quality challenge, commit `26caa11`) зафиксировал порог: **"ok + bug filed" уместно для polish-bug'ов; "happy path молча показывает 50 из 153 строк" — это `partial` territory**. Это первый батч где reviewer (не pipeline) инициировал status-flip, и controller его принял — сигнал, что enum больше не декоративный.

### 1.3 `api_calls_observed` precedent из D2 правильно распространился

D2 commit `6d412c5` установил паттерн: layout-chrome калы (`/api/auth/me`, `/api/properties`, `/api/business-date`) перечисляются **явно** с `note: "layout chrome: ..."`, а не `[]` с misleading комментарием. Распространение:
- D3 — caught up через fix-loop `3f697ff`
- D4 / D5 / D6 — получили правильно с первой итерации

Это classic "first section in batch sets the tone" паттерн из Batch B, но впервые применённый к `api_calls_observed` полю — которое раньше было в диапазоне от пустой строки до `[]` до full endpoint list без системы.

### 1.4 Phase 1.5 helpers + Batch D testid convention

`registerSectionHooks(sectionId)` использовался единообразно во всех 6 секциях. Testid convention `config-{slug}-{role}` + `config-{slug}-page` wrapper для scoped queries применилась в D3/D4/D6 без вариаций. Все добавленные testid'ы — **pure-additive** edits в app-компоненты, ноль изменений behaviour / style / className. Это то, что Batch C retro формализовал в Section 1.5 ("Phase 1.5 окупаемость ~100%") — Batch D продолжил без drift'а.

### 1.5 Evidence-first triage каждого bug'а

Все три bug'а в Batch D родились из прямого inspection'а исходников, не из предположений:
- **BUG-015 cashier-auth-commented** — `apps/api/src/app.ts:34` (комментарий над `app.register(authPlugin)`) + `cashier.ts:62,96` (`request.user?.id` deref)
- **BUG-016 guarantee-codes-hardcoded-enum** — grep `booking-edit-form.tsx:609-613` нашёл второй источник 5 кодов
- **BUG-017 profiles-list-truncation** — сравнение `profiles.length=50` из UI vs `GET /api/profiles?limit=1000 → total:153`

Каждый bug цитирует `file:line` и имеет concrete repro-steps. Это планка: к моменту F1 retro всем 12 открытым bug'ам надо соответствовать этому формату.

### 1.6 Dev-harness ritual стал механическим

Все 6 секций Batch D модифицировали `apps/web/src/app/**/page.tsx` или клиентские компоненты; все 6 потребовали `pnpm --filter @pms/web build` + `kill next-server` + `pnpm start` чтобы спек увидел новые testid'ы. Stale-next-cache паттерн теперь **предсказуем** и закодирован в каждом брифе; диагностическая сигнатура ("Loading..." в returned HTML) известна implementer'ам. Ни один Batch D сабагент не застрял на "тест не видит testid, который я только что добавил".

## 2. Что не сработало / стоило цикла (stop / change)

### 2.1 Rev 4 prose-claim chain хрупок в `broken` / `missing` секциях

D2 прошла через **два fix-loop'а** (`6d412c5` + `0593afe`). Первый fix починил одно false-claim ("endpoint doesn't exist") и в процессе **ввёл другой** ("no UI surface invokes it") — в реальности секция 04 booking-detail уже invoke'ит тот endpoint через room-move surface. Второй fix-loop (`0593afe`) скорректировал crossref.

**Root cause**: prose-claims про absence (`"no X exists"`) не grep-verified перед landing'ом. Rev 4 говорит "keep comments synced with code" — но cross-section reference "section 04 covers that surface" не попадает в `validate-yaml`.

**Fix для Phase 6 F1**: промоутнуть sub-step в Rev 4 — "для каждого negative / absence claim, grep the repo for the referenced API/feature name before committing". Это недорогая проверка (литералный `rg '/api/bookings/:id/move-room'` в `apps/web/src/app/**/*.tsx`), и она предотвратила бы оба D2 fix-loop'а.

### 2.2 CSS-class selector slip в D6 — silent dead-entry

D6 первоначальный commit (`c30129b`) содержал `CHROME_SELECTORS` array с entry `data-testid=topbar-search` — но testid'а с таким именем в `apps/web/src/**` не было (использовался `.searchbox` CSS-class). `.searchbox` работал, тесты проходили, а testid-запись была phantom. Fix `8026970` добавил реальный testid + broadened selectors.

**Root cause**: даже при Rev 2 discipline (testid > role > text > CSS), dead entry в selector array не ловится никаким автомат'ом — он просто silent no-op.

**Fix для Phase 6 F1**: code-quality reviewer checklist должен включать **"grep for testid strings в selector arrays against actual testids в app source to catch dead entries"**. Опционально — CI-линтер, который фейлит build при наличии `data-testid=X` ссылки без соответствующего `data-testid="X"` в `apps/web/src/**`. Это один из трёх dev-harness wins, рекомендованных Section 6.

### 2.3 Controller misdiagnosed "pre-existing spec failure" в D2

Когда implementer второго D2 fix-loop'а отрепортил, что спек падает, мой первоначальный диагноз — "pre-existing bug" — был **неверен**. Реальная причина: первый fix-loop модифицировал `page.tsx` для `data-group-code` dedupe, `.next/` кэш устарел, и тест отдавал старый HTML. Rebuild + restart — пропавший round.

**Lesson**: implementer instructions **уже** включают dev-harness ritual (Section 1.6); когда спек падает ПОСЛЕ `page.tsx` edit, default assumption должен быть stale build, не pre-existing bug. Сохранить в controller playbook как диагностическую эвристику.

### 2.4 Implementer scope-escalation в D3 — exemplary, сохранить

Первый dispatch D3 вернулся с `NEEDS_CONTEXT` ("this feature is a static stub, not CRUD — please confirm approach") **вместо** того, чтобы выдумать fake CRUD и писать спек против несуществующих affordances. Controller подтвердил `missing` status + BUG-016 path.

Это **образцовый паттерн**, и бриф должен продолжать содержать explicit "if feature is missing/duplicate/different from plan — ASK, не invent" guidance. Без этого D3 легко деградировал бы в `ok` статус со спекой, которая тестирует фиктивные элементы.

## 3. Открытия и новые паттерны (new discoveries)

### 3.1 Double-source-of-truth как systemic антипаттерн

Batch D — самый маленький батч, но **две независимые секции** surface'или один и тот же тип проблемы:

| Секция | Первый источник | Второй источник |
|---|---|---|
| D1 cashier | `apps/api/src/app.ts:34` (auth plugin registration — commented) | `apps/api/src/routes/cashier.ts:62,96` (handlers всё ещё deref'ают `request.user.id`) |
| D3 guarantee-codes | `apps/web/src/app/configuration/guarantee-codes/page.tsx:1-76` (docs stub с 5 кодами) | `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx:609-613` (form `<option>`s с теми же 5 кодами) |

**Паттерн**: product `/configuration/*` UI обещает configurability, но backend / data-model path либо broken, либо hardcoded в втором месте. Ни BUG-015, ни BUG-016 по отдельности не ловят этот product-level concern — они фиксируют симптом. Phase 6 F1 full-run retro должен вынести это в **product-observation раздел** (отдельно от bug listings), потому что fix требует совместного ревью API + UI + data-model, не просто patches в одном файле.

### 3.2 Batch D — самый "NEEDS_CONTEXT / status-flip" батч за весь full-run

- **D3** NEEDS_CONTEXT → status=missing
- **D4** code-review challenge on ok-vs-partial classification → flipped to partial
- **D2** controller misdiagnosed "pre-existing failure" → mid-flight correction

Предыдущие батчи (A, B, C) отправили clean `ok` статусы и редко триггерили status debates. Это **ожидаемо**: Batch D — P2, меньший scope, часто surface'ит edge-of-spec features (cashier сидит на broken backend; guarantee-codes — docs stub; login не имеет user enumeration). Это калибровка batch-size-vs-judgment-load tradeoff: small batch с high-variance outcomes требует более частой controller-level adjudication, чем large homogeneous batch.

**Observation для F1**: full-run нарратив должен включать "Batch D surfaced 3/3 gaps that earlier batches structurally couldn't have found" — это не regression, это evidence что audit scope был right-sized.

### 3.3 P1 preflight regression gate validated свой собственный purpose

Batch C retro (Section 2.1) commissioned preflight работу, которая закрыла BUG-012 / 013 / 014 в commit `dbd1563` ДО старта Batch D. Scenario 03 секции D6 (i18n-theme) **явно re-сканировал** те же самые sites (dashboard, bookings-list, booking-detail badges) + 5 новых страниц — результат: **zero i18n leaks**.

Это **первый раз в full-run'е**, когда retro action-item'а effect провряется в subsequent батча test output'е. Паттерн для будущих audit-циклов: retro → preflight task → следующий батч явно re-tests ту же surface. Это замыкает цикл "observed gap → fixed gap → verified fixed in automated regression".

## 4. Bugs — контекст и приоритизация

Три bug'а в Batch D, все medium / high severity:

### BUG-015 cashier-auth-commented (HIGH, blocks primary operation)
- `apps/api/src/app.ts:34` — `await app.register(authPlugin)` закомментирован.
- `apps/api/src/routes/cashier.ts:62,96` — handlers всё равно deref'ают `request.user?.id`, что приводит к 500 на любом cashier-операции, требующей auth.
- **Fix option A (recommended)**: uncomment registration. Section 13 остаётся `broken` до фикса — scenario 04 contract tripwire флипнется зелёным и форсирует re-audit сценариев 01-03.
- **Fix option B**: закоммитить middleware по-другому (e.g., fastify-preHandler scope) — более hазваначная переработка.

### BUG-016 guarantee-codes-hardcoded-enum (MEDIUM, consistency footgun)
- 5 guarantee codes хардкожены **дважды**: `configuration/guarantee-codes/page.tsx:1-76` (docs stub) + `bookings/[id]/edit/booking-edit-form.tsx:609-613` (form `<option>`s).
- Нет API — оба хардкода independent'но рендерят один и тот же список.
- **Fix option A**: promote to CRUD table + API (закрывает и BUG-016, и `missing` status секции D3).
- **Fix option B**: centralise в shared constants module, import в обоих местах. Фикс консистентности, но не закрывает "configurability".

### BUG-017 profiles-list-truncation (MEDIUM, UX gap on happy path)
- `/configuration/profiles` омит `?limit=` на `GET /api/profiles`; API дефолтит к 50; страница показывает 50 из 153 rows; count badge misleading; нет pagination UI.
- **Fix option A (canonical)**: pagination UI как на `/guests`. Commit `26caa11` fixлил false-claim что `/guests` страдает от того же — `/guests` имеет pagination корректно, это disambiguation было важно.
- **Fix option B**: bump default limit с 50 → 1000 (не решает пагинацию для real-scale data, но убирает immediate UX gap).

### Total full-run bug yield на 2026-04-22

**12 bugs total**:
- Pilot (03): BUG-003
- Batch A: BUG-004
- Batch C: BUG-006, BUG-008, BUG-009, BUG-010, BUG-011
- Preflight (post-Batch-C): BUG-012, BUG-013, BUG-014
- Batch D: BUG-015, BUG-016, BUG-017

Bug yield per batch: **A=2, B=0, C=5, preflight=3, D=3**. Batch D имеет highest bug/section ratio full-run'а (3/6 = 0.5), при том, что scope был меньше всех остальных. Это consistent с Section 3.2 (small batch, high-variance).

## 5. Metrics

| Metric                           | Batch A | Batch B | Batch C | Batch D |
|----------------------------------|---------|---------|---------|---------|
| Sections                         | 5       | 3       | 9       | 6       |
| Bugs filed                       | 2       | 0       | 5       | 3       |
| Total commits                    | 5       | 6       | 15      | 11      |
| Status histogram                 | ok=5    | ok=3    | ok=9    | broken=1, partial=2, missing=1, ok=2 |
| Iteration: 1-shot/2-shot/3-shot  | 1/4/0   | 1/1/1   | 4/4/1   | 2/3/1   |

Key Batch D numbers:
- **40 screenshots** в Batch D suite (40 matching `(13|14|20|21|23|24)-*`); **18 новых скриншотов в секции 24 одна** (5 sampled pages × 2 locales + дополнительные сценарий-01/02 pairs) — самая большая single-section artefact generation в full-run.
- **BUG-015 в секции 13 — первый `broken` status** за весь full-run.
- **Секция 20 — первый `missing` status** за весь full-run.
- **Самая длинная fix-chain: D2** с 2 fix-loop'ами (3 commits total для секции 14).
- **`/configuration/guarantee-codes` — первая секция, где `api_calls_observed` легитимно пустой** (static stub, ноль network traffic beyond layout chrome).

## 6. Actionable для Phase 6 finalization

### 6.1 Pre-F1 housekeeping

- **Cross-reference validation перед F1 full-run retro**: scenario 04 секции D2 утверждает "section 04 covers the room-move surface" — F1 должна подтвердить, что это держится в `04-booking-detail.yml` (там есть scenario / assertion, которая exercise'ит `POST /api/bookings/:id/move-room`). Если нет — либо обновить D2 crossref, либо добавить scenario в 04.
- **`validate-yaml` — 6 pre-existing errors в секциях 16/18/19/22** (missing `retro`/`api_calls_observed`/`help_rewrite_hints` fields). **Не вызваны Batch D.** F1 должна решить:
  - (a) sweep'нуть в dedicated `chore(ui-audit): validate-yaml cleanup` commit **до** F1,
  - (b) задокументировать как known technical debt (например, потому что YAML schema нужно relax'ить вместо того, чтобы каждую read-only секцию заставлять иметь `retro` field).
- **`docs/backlog.json` orphan entries BUG-001 / BUG-002** — pre-audit legacy; `sync-backlog:check` флажит их как warnings. Решить: retire, migrate в `bugs.yml`, или keep as warnings.
- **Screenshot drift (60+ modified PNG's из Batch A-C re-runs)** до сих пор uncommitted. User call на F1/F2: batch screenshot refresh commit, или roll up в `chore(ui-audit): refresh screenshots from full-run` single commit.

### 6.2 Three dev-harness quality-of-life wins для future audit cycle

- **Auto-rebuild скрипт на page.tsx changes** — watch + rebuild + restart. Уберёт dev-harness ritual Section 1.6 как manual step.
- **Testid-reference линтер** — fail CI если `CHROME_SELECTORS` или similar arrays ссылаются на testid'ы, которых нет в `apps/web/src/**`. Закрывает Section 2.2 dead-entry footgun.
- **Rev 4 pre-commit hook** — grep для absence claims ("no X exists") в YAML diff'ах, verify они passes codebase grep. Закрывает Section 2.1 prose-claim chain.

### 6.3 Phase 6 F1 retro должен явно вынести "double-source-of-truth" паттерн

Section 3.1 выше — это **не** просто two individual bugs, это cross-cutting product observation, которое заслуживает product-level attention beyond individual BUG ID'ев. F1 retro должна иметь dedicated раздел "Product observations across full-run", и "configuration UI promises configurability, but data path is broken or duplicated" должно быть первым пунктом. Audience F1 retro включает product owner / tech lead, не только maintainers — поэтому системные наблюдения нужно surface'ить явно.

### 6.4 Финальная подготовка к PR handoff

- [ ] Все 24 секции closed с terminal status (sum должен быть 24, current: 20 ok + 2 partial + 1 broken + 1 missing = 24 ✓)
- [ ] 12 bugs в `bugs.yml` consistent с `backlog.json` (`sync-backlog:check` clean, modulo BUG-001/002 orphan decision)
- [ ] Retro chain complete: pilot → A → B → C → D → F1 full-run
- [ ] Screenshot policy решена (Section 6.1)
- [ ] F2: единый PR (`feat/design-system` → `main`) с описанием, indexnющим все 4 batch retro + 12 bugs + product observations.

Batch D завершает audit production phase. Phase 6 — финализация + handoff.
