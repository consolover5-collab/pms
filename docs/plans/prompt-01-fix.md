Ты работаешь над open-source PMS. Прочитай AGENTS.md в корне проекта.

СИТУАЦИЯ:
pnpm db:seed работает, pnpm typecheck чист. Но pnpm db:migrate сломан потому что:
1. Таблица __drizzle_migrations не существует в БД (схема была применена напрямую через psql)
2. Файл packages/db/drizzle/meta/_journal.json повреждён — содержит записи 0,1,2,3,6
   но пропущены 4 ("0004_drop_folio_window") и 5 ("0005_opera_alignment")
3. Файл 0006_schema_update.sql содержит неверный контент (CREATE TABLE для уже
   существующих старых таблиц)

ЦЕЛЬ:
Привести систему миграций в порядок так, чтобы:
а) Текущая БД продолжала работать (не ломать seed и API)
б) На свежей БД `pnpm db:migrate` создавал всю схему корректно

РЕШЕНИЕ — следуй шагам строго по порядку:

ШАГ 1 — Проверь, что таблицы реально существуют:
  PGPASSWORD=pms_dev_password psql -h localhost -U pms -d pms_dev \
    -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"

  Убедись что есть: companies, travel_agents, booking_daily_details, cashier_sessions,
  folio_windows, packages, rate_plan_packages, hk_tasks
  И что в bookings есть company_id, в folio_transactions — folio_window_id.

ШАГ 2 — Прочитай существующие файлы для понимания контекста:
  packages/db/drizzle/0000_legal_thor.sql
  packages/db/drizzle/0004_drop_folio_window.sql
  packages/db/drizzle/0005_opera_alignment.sql
  packages/db/drizzle/0006_schema_update.sql   (сломанный файл)
  packages/db/drizzle/meta/_journal.json       (повреждённый журнал)
  packages/db/src/schema/companies.ts
  packages/db/src/schema/booking-daily-details.ts
  packages/db/src/schema/financial.ts
  packages/db/src/schema/packages.ts
  packages/db/src/schema/housekeeping.ts

ШАГ 3 — Перепиши 0006_schema_update.sql с правильным содержимым.
  Удали из него всё что создаёт СТАРЫЕ таблицы (properties, rooms, bookings и т.д.).
  Оставь ТОЛЬКО создание новых таблиц и новых колонок.
  Новые таблицы: companies, travel_agents, booking_daily_details, cashier_sessions,
  folio_windows, packages, rate_plan_packages, hk_tasks.
  Новые колонки:
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_agent_id uuid REFERENCES travel_agents(id);
    ALTER TABLE folio_transactions ADD COLUMN IF NOT EXISTS folio_window_id uuid REFERENCES folio_windows(id);
    ALTER TABLE folio_transactions ADD COLUMN IF NOT EXISTS cashier_session_id uuid REFERENCES cashier_sessions(id);
  Структуру каждой таблицы бери из TypeScript-схем (прочитанных на шаге 2).
  Используй синтаксис drizzle: --> statement-breakpoint между операторами.
  Ко всем CREATE TABLE добавь IF NOT EXISTS (чтобы migrate был идемпотентным).

ШАГ 4 — Восстанови корректный _journal.json.
  Замени содержимое packages/db/drizzle/meta/_journal.json на:
  {
    "version": "7",
    "dialect": "postgresql",
    "entries": [
      { "idx": 0, "version": "7", "when": 1770679692489, "tag": "0000_legal_thor", "breakpoints": true },
      { "idx": 1, "version": "7", "when": 1770841122822, "tag": "0001_public_wrecking_crew", "breakpoints": true },
      { "idx": 2, "version": "7", "when": 1770877016187, "tag": "0002_curious_agent_brand", "breakpoints": true },
      { "idx": 3, "version": "7", "when": 1771948800000, "tag": "0003_folio_tx_night_audit_unique", "breakpoints": true },
      { "idx": 4, "version": "7", "when": 1772000000000, "tag": "0004_drop_folio_window", "breakpoints": true },
      { "idx": 5, "version": "7", "when": 1775823000000, "tag": "0005_opera_alignment", "breakpoints": true },
      { "idx": 6, "version": "7", "when": 1775823617693, "tag": "0006_schema_update", "breakpoints": true }
    ]
  }

ШАГ 5 — Создай __drizzle_migrations таблицу и заполни историю миграций.

  Сначала создай таблицу:
    PGPASSWORD=pms_dev_password psql -h localhost -U pms -d pms_dev -c "
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );"

  Затем для каждого из 6 файлов (0000 по 0005) вычисли SHA-256 hash через Node.js:
    node -e "
      const fs = require('fs');
      const crypto = require('crypto');
      const sql = fs.readFileSync('packages/db/drizzle/FILENAME.sql', 'utf8');
      console.log(crypto.createHash('sha256').update(sql).digest('hex'));
    "
  (замени FILENAME на реальное имя каждого файла)

  Вставь 6 записей в таблицу (created_at из журнала выше, в миллисекундах):
    PGPASSWORD=pms_dev_password psql -h localhost -U pms -d pms_dev -c "
      INSERT INTO __drizzle_migrations (hash, created_at) VALUES
        ('HASH_0000', 1770679692489),
        ('HASH_0001', 1770841122822),
        ('HASH_0002', 1770877016187),
        ('HASH_0003', 1771948800000),
        ('HASH_0004', 1772000000000),
        ('HASH_0005', 1775823000000)
      ON CONFLICT DO NOTHING;"

ШАГ 6 — Примени 0006 миграцию:
  cd /home/oci/pms && pnpm db:migrate

  Drizzle должен увидеть что 0000-0005 уже применены (по hash) и запустить только 0006.
  Если ошибка "already exists" — убедись что в 0006 везде используется IF NOT EXISTS.
  Если ошибка с hash — проверь что hash в __drizzle_migrations совпадает с содержимым файлов.

ШАГ 7 — Финальная проверка:
  pnpm typecheck
  pnpm db:seed

КРИТЕРИИ ПРИЁМКИ:
- [ ] pnpm db:migrate завершается без ошибок (применяет только 0006)
- [ ] SELECT COUNT(*) FROM __drizzle_migrations; — возвращает 7
- [ ] _journal.json содержит 7 корректных записей (idx 0-6)
- [ ] 0006_schema_update.sql содержит только новые таблицы и IF NOT EXISTS
- [ ] pnpm db:seed работает без ошибок
- [ ] pnpm typecheck — чист

АБСОЛЮТНЫЕ ЗАПРЕТЫ:
- НЕ удалять существующие таблицы из БД
- НЕ трогать TypeScript-схемы в packages/db/src/schema/
- НЕ раскомментировать authPlugin в app.ts
- НЕ запускать DROP TABLE или TRUNCATE
