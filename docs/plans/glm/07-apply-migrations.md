# Промт для GLM: применить миграции и пересидировать БД

## Ситуация

База данных отстала от кода. Применены миграции 0000–0005, ожидают применения:
- `0006_schema_update`
- `0007_unified_profiles`
- `0008_folio_profile_id`

Из-за этого API возвращает 500 на `/api/profiles`, `/api/bookings`, `/api/night-audit`.

## DATABASE_URL

```
postgresql://pms:pms_dev_password@localhost:5432/pms_dev
```

## Задача

Выполни последовательно в терминале из директории `/home/oci/pms`:

### Шаг 1 — Применить миграции

```bash
cd /home/oci/pms/packages/db
DATABASE_URL="postgresql://pms:pms_dev_password@localhost:5432/pms_dev" npx drizzle-kit migrate
```

Ожидание: все три миграции применены без ошибок.

Если миграция завершилась с ошибкой — сообщи точный текст ошибки и остановись. Не пытайся чинить SQL вручную.

### Шаг 2 — Пересидировать данные

```bash
cd /home/oci/pms
DATABASE_URL="postgresql://pms:pms_dev_password@localhost:5432/pms_dev" pnpm db:seed
```

Ожидание: seed завершился без ошибок, данные вставлены.

### Шаг 3 — Проверить API

```bash
curl -s "http://localhost:3001/api/profiles?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&limit=3" | head -c 200
curl -s "http://localhost:3001/api/bookings?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&limit=3" | head -c 200
```

Ожидание: оба возвращают данные (не ошибку 500).

## Отчёт

Сохрани результат в `docs/plans/glm/07-apply-migrations-result.md`:
- вывод `drizzle-kit migrate`
- вывод `db:seed`
- ответы двух curl-запросов
