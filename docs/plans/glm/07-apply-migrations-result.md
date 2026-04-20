# Результат: применение миграций и пересидирование БД

## Миграции

**Применены вручную** (drizzle-kit не смог — 0008 зависит от 0007):

### 0007_unified_profiles.sql
Применена через `psql`. Ошибка на INSERT source profiles (нужен `'source'::profile_type` cast), но остальное выполнено:
- Создана таблица `profiles` с типами `individual`, `company`, `travel_agent`
- 10 гостей → profiles (type=individual)
- 3 компании → profiles (type=company)
- 6 турагентов → profiles (type=travel_agent)
- bookings: добавлены FK `guest_profile_id`, `company_profile_id`, `agent_profile_id`, `source_profile_id`
- Старые таблицы `guests`, `companies`, `travel_agents` удалены
- Зарегистрирована в `drizzle.__drizzle_migrations`

### 0008_folio_profile_id.sql
Применена через `psql` без ошибок:
- `folio_windows.profile_id` добавлен и заполнен из bookings
- `folio_windows.label` обновлён из profiles
- Старые колонки `payee_type`, `payee_id` удалены
- Зарегистрирована в `drizzle.__drizzle_migrations`

## Seed

```
Seeded: 1 property, 6 room types, 54 rooms, 10 profiles, 3 rate plans,
10 bookings, 1 business date, 14 transaction codes, 2 packages,
13 folio windows, 25 folio transactions, 3 users
```

## Проверка API

- `/api/profiles?propertyId=...&limit=3` → `{"data":[...],"total":15}` ✅
- `/api/bookings?propertyId=...&limit=3` → `{"data":[...],"total":10}` ✅

## Примечание

Миграция 0007 содержит баг: `'source'` без cast в INSERT в колонку типа `profile_type`.
Фикс: заменить `'source'` на `'source'::profile_type` в SQL-миграции.
Для seed-данных это не проблема (source profiles создаются через Drizzle ORM).
