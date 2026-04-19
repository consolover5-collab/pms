# Задача 16: Обновление integration tests

## Контекст
После всех изменений (auth, daily details, folio windows, cashiers) integration tests могут сломаться.
Нужно обновить и добавить новые тесты.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- ВСЕ файлы `*.test.ts` в `apps/api/src/` — найди через `find apps/api -name "*.test.ts"`
- `apps/api/src/test-helpers.ts` — helper для auth (создан в задаче 01)

## Что проверить и починить

### 1. Auth в тестах
Каждый integration test должен:
- Логиниться через `loginAsAdmin()` (из test-helpers.ts)
- Передавать cookie в каждый `app.inject()` вызов
- `/health` тестировать БЕЗ cookie (public route)

### 2. Bookings create → daily details
Добавить тест:
```typescript
it("creates daily details when booking is created", async () => {
  // POST /api/bookings с 3-ночным бронированием
  // GET /api/bookings/:id → проверить dailyDetails.length === 3
});
```

### 3. Night Audit → из daily details
Существующий night audit test должен работать если seed содержит daily details.
Если нет — добавить seed с daily details в test setup.

### 4. Folio windows
Добавить тест:
```typescript
it("creates default folio window with new booking", async () => {
  // POST /api/bookings
  // GET /api/bookings/:bookingId/folio/windows → length === 1, windowNumber === 1
});
```

### 5. Companies/TA
Добавить базовые тесты:
```typescript
it("CRUD companies", async () => { ... });
it("prevents deleting company with bookings", async () => { ... });
```

### 6. HK Tasks
```typescript
it("generates housekeeping tasks", async () => { ... });
it("updates room status on task completion", async () => { ... });
```

## Правила тестирования
- Каждый test файл импортирует `buildTestApp` и `loginAsAdmin` из test-helpers
- Тесты НЕ зависят друг от друга — каждый создаёт свои данные
- Cleanup: если тест создаёт данные — удалить в afterEach (или использовать уникальные имена)
- Используй `assert` из `node:assert` (не jest, не chai)

## Проверка
```bash
cd /home/oci/pms && pnpm test
```

ВСЕ тесты должны быть зелёными.

## Критерии приёмки
- [ ] Все существующие тесты обновлены и проходят
- [ ] Новые тесты для: daily details, folio windows, companies, HK tasks
- [ ] Auth cookie в каждом integration test
- [ ] `pnpm test` — 0 failures
- [ ] `pnpm exec tsc --noEmit` — 0 errors
