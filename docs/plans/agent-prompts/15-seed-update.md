# Задача 15: Обновление seed data

## Контекст
После всех предыдущих задач появились новые таблицы. Seed должен создавать реалистичные тестовые данные.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл)
- `tools/seed.ts` — ВЕСЬ файл

## Что добавить в seed

### 1. Компании (2-3 шт)
```typescript
const companiesData = [
  { name: "ООО Газпром Трансгаз", shortName: "Газпром", taxId: "3906000001", paymentTermDays: 14, creditLimit: "500000" },
  { name: "ПАО Лукойл", shortName: "Лукойл", taxId: "7708004767", paymentTermDays: 30, creditLimit: "300000" },
  { name: "Балтийский федеральный университет", shortName: "БФУ", taxId: "3906019067", paymentTermDays: 60, creditLimit: "100000" },
];
```

### 2. Турагенты (1-2 шт)
```typescript
const travelAgentsData = [
  { name: "Coral Travel", iataCode: "01-2 3456", commissionPercent: "10" },
  { name: "TEZ Tour", iataCode: "01-2 7890", commissionPercent: "12" },
];
```

### 3. Пакеты + transaction codes
```typescript
// Transaction code для завтрака (если нет):
{ code: "BREAKFAST", description: "Завтрак", groupCode: "food_beverage", transactionType: "charge" }
{ code: "PARKING", description: "Парковка", groupCode: "misc", transactionType: "charge" }

// Packages:
{ code: "BKFST", name: "Завтрак", transactionCodeId: breakfastCodeId, calculationRule: "per_person_per_night", amount: "800", postingRhythm: "every_night" }
{ code: "PARK", name: "Парковка", transactionCodeId: parkingCodeId, calculationRule: "per_night", amount: "500", postingRhythm: "every_night" }
```

### 4. Привязка пакетов к rate plans
Привязать "Завтрак" к первому rate plan с `includedInRate: true`.

### 5. companyId для 2-3 бронирований
Привязать Газпром к 2 бронированиям, Лукойл к 1.

### 6. Folio windows для существующих бронирований
Для каждого бронирования — создать Window 1 (default).
Для бронирований с companyId — создать Window 2 (company).

### 7. Daily details для ВСЕХ бронирований
Если задача 05 уже добавила это — проверить что данные корректны.

## ВАЖНО
- Seed должен быть ИДЕМПОТЕНТНЫЙ — повторный запуск не должен дублировать данные
- Используй существующий propertyId из seed
- Русские названия для компаний

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsx tools/seed.ts
cd /home/oci/pms && pnpm test
```

Проверить данные:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM companies;"
psql $DATABASE_URL -c "SELECT count(*) FROM travel_agents;"
psql $DATABASE_URL -c "SELECT count(*) FROM packages;"
psql $DATABASE_URL -c "SELECT count(*) FROM folio_windows;"
psql $DATABASE_URL -c "SELECT count(*) FROM booking_daily_details;"
```

## Критерии приёмки
- [ ] Seed создаёт 3 компании, 2 TA, 2 пакета
- [ ] 2-3 бронирования привязаны к компаниям
- [ ] Folio windows созданы для всех бронирований
- [ ] Daily details существуют для всех бронирований
- [ ] Повторный seed не дублирует данные
- [ ] Все тесты проходят
