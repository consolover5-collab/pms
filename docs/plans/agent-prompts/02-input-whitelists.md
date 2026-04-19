# Задача 02: Explicit field whitelists на все PUT/POST endpoints

## Контекст
Сейчас несколько route файлов используют `...request.body` spread при UPDATE.
Это позволяет отправить `{"status":"checked_in"}` на PUT /bookings/:id и обойти state machine.
Нужно заменить spread на explicit field picks.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `apps/api/src/routes/guests.ts` — строка 120: `{ ...request.body, updatedAt: new Date() }`
- `apps/api/src/routes/bookings.ts` — ищи `...request.body`
- `apps/api/src/routes/rate-plans.ts` — ищи `...request.body`
- `apps/api/src/routes/room-types.ts` — ищи `...request.body`
- `apps/api/src/routes/properties.ts` — ищи `...request.body`

## Что сделать

### Паттерн замены

БЫЛО (ОПАСНО):
```typescript
const [updated] = await app.db
  .update(guests)
  .set({ ...request.body, updatedAt: new Date() })
  .where(eq(guests.id, request.params.id))
  .returning();
```

СТАЛО (БЕЗОПАСНО):
```typescript
const { firstName, lastName, email, phone, documentType, documentNumber, nationality, gender, language, dateOfBirth, vipStatus, notes } = request.body;
const [updated] = await app.db
  .update(guests)
  .set({ firstName, lastName, email, phone, documentType, documentNumber, nationality, gender, language, dateOfBirth, vipStatus, notes, updatedAt: new Date() })
  .where(eq(guests.id, request.params.id))
  .returning();
```

### Файл: guests.ts

В PUT /api/guests/:id (около строки 117-125):
Тип Body уже определён — используй его поля:
```
firstName, lastName, email, phone, documentType, documentNumber, nationality, gender, language, dateOfBirth, vipStatus, notes
```

### Файл: guests.ts — POST тоже

В POST /api/guests (около строки 92): `const { force: _force, ...guestData } = request.body;`
Замени на explicit:
```typescript
const { propertyId, firstName, lastName, email, phone, documentType, documentNumber, nationality, gender, language, dateOfBirth, vipStatus, notes } = request.body;
const [guest] = await app.db
  .insert(guests)
  .values({ propertyId, firstName, lastName, email, phone, documentType, documentNumber, nationality, gender, language, dateOfBirth, vipStatus, notes })
  .returning();
```

### Файл: bookings.ts

Найди ВСЕ места где используется `...request.body` или spread body.
Для каждого — замени на explicit pick ТОЛЬКО тех полей, которые пользователь должен менять.

ВАЖНО: `status` НИКОГДА не должен приходить из body на PUT /bookings/:id.
Статус меняется ТОЛЬКО через check-in/check-out/cancel endpoints.

Поля для PUT /bookings/:id:
```
guestId, roomId, roomTypeId, ratePlanId, checkInDate, checkOutDate, adults, children, rateAmount, paymentMethod, notes, guaranteeCode, marketCode, sourceCode, channel
```

### Файл: rate-plans.ts

Прочитай файл, найди spread. Поля для update:
```
name, code, description, isActive
```

### Файл: room-types.ts

Прочитай файл, найди spread. Поля для update:
```
name, code, maxOccupancy, baseRate, description, sortOrder
```

### Файл: properties.ts

Прочитай файл, найди spread. Поля для update:
```
name, code, address, city, country, timezone, currency, checkInTime, checkOutTime, numberOfRooms, numberOfFloors, taxRate
```

## НЕ ДЕЛАЙ
- НЕ меняй логику валидации (validateBookingDates и т.д.)
- НЕ меняй порядок проверок в routes
- НЕ добавляй новые поля
- НЕ удаляй существующую валидацию
- НЕ трогай GET и DELETE endpoints
- НЕ добавляй JSON Schema — это отдельная задача

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

Проверь что нигде в route файлах не осталось `...request.body`:
```bash
grep -rn "\.\.\.request\.body" apps/api/src/routes/
```
Должно быть 0 результатов.

## Критерии приёмки
- [ ] 0 вхождений `...request.body` в apps/api/src/routes/
- [ ] Все PUT/POST используют explicit field picks
- [ ] `status` не принимается через PUT /bookings/:id
- [ ] Все тесты проходят
- [ ] TypeScript typecheck чистый
