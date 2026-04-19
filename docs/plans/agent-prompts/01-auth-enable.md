# Задача 01: Включить auth middleware

## Контекст
Auth middleware уже написан (`apps/api/src/plugins/auth.ts`), но закомментирован в `app.ts`.
Все API эндпоинты доступны без аутентификации. Это первый шаг — без него невозможны кассиры и аудит-трейл.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `apps/api/src/app.ts` — здесь раскомментировать auth
- `apps/api/src/plugins/auth.ts` — логика auth middleware
- `apps/api/src/routes/auth.ts` — login/logout/me endpoints
- `packages/db/src/schema/users.ts` — users + sessions таблицы
- `apps/api/src/routes/health.ts` — public route (не трогать)
- `tools/seed.ts` — seed пользователей (нужно проверить пароли)

## Что сделать

### Шаг 1: Раскомментировать auth в app.ts
В файле `apps/api/src/app.ts` найди строку:
```typescript
// await app.register(authPlugin);
```
Замени на:
```typescript
await app.register(authPlugin);
```

### Шаг 2: Добавить secure cookie в production
В файле `apps/api/src/routes/auth.ts`, в POST /api/auth/login, найди `reply.setCookie` и добавь `secure`:
```typescript
reply.setCookie(SESSION_COOKIE, token, {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_MS / 1000,
});
```

### Шаг 3: Ограничить CORS
В файле `apps/api/src/app.ts`, замени:
```typescript
await app.register(cors, { origin: true, credentials: true });
```
на:
```typescript
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:3000"];
await app.register(cors, { origin: allowedOrigins, credentials: true });
```

### Шаг 4: Rate limit на login
Установи пакет:
```bash
cd apps/api && pnpm add @fastify/rate-limit
```
В файле `apps/api/src/routes/auth.ts`, добавь rate-limit на login:
```typescript
import rateLimit from "@fastify/rate-limit";

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Rate limit только для login
  await app.register(rateLimit, {
    max: 5,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    hook: "preHandler",
  });

  // ... остальной код без изменений
```
ВАЖНО: rate-limit регистрируй ВНУТРИ authRoutes (scope), не глобально.

### Шаг 5: Обновить тесты
В файле `apps/api/src/lib/validation.test.ts` и любых integration tests:
Тесты используют `app.inject()` без cookie. Нужен helper для авторизованных запросов.

Создай файл `apps/api/src/test-helpers.ts`:
```typescript
import { buildApp } from "./app";

export async function buildTestApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

/** Логинится как admin и возвращает cookie для последующих запросов */
export async function loginAsAdmin(app: any): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", password: "admin123" },
  });
  const cookie = res.headers["set-cookie"];
  if (!cookie) throw new Error("Login failed — no cookie returned");
  // Извлечь значение cookie из set-cookie header
  const match = String(cookie).match(/pms_session=([^;]+)/);
  if (!match) throw new Error("Cookie parse failed");
  return `pms_session=${match[1]}`;
}
```

В каждом integration test файле, где есть `app.inject()`, добавь cookie:
```typescript
import { loginAsAdmin } from "../test-helpers";

// В начале describe:
let cookie: string;
before(async () => {
  cookie = await loginAsAdmin(app);
});

// В каждом запросе:
const res = await app.inject({
  method: "POST",
  url: "/api/bookings",
  payload: { ... },
  headers: { cookie },
});
```

### Шаг 6: Проверить seed пароли
Прочитай `tools/seed.ts` и найди раздел где создаются users. Убедись что:
- Есть пользователь `admin` с паролем `admin123` и role `admin`
- Пароли хешируются через `bcrypt.hash(password, 10)`
- Seed выполняется до тестов

## НЕ ДЕЛАЙ
- НЕ меняй логику ролей в auth.ts (hasAccess function)
- НЕ добавляй новые роли
- НЕ меняй структуру таблиц users/sessions
- НЕ добавляй middleware для отдельных routes — auth уже глобальный через preHandler
- НЕ удаляй `(request as any).user?.id || "system"` из folio — это будет работать теперь

## Проверка
```bash
# 1. TypeScript
cd /home/oci/pms && pnpm exec tsc --noEmit

# 2. Тесты
cd /home/oci/pms && pnpm test

# 3. Ручная проверка
cd /home/oci/pms/apps/api && pnpm exec tsx src/server.ts &
sleep 2

# Без cookie — должно быть 401:
curl -s http://localhost:3001/api/rooms?propertyId=test | head -1
# Ожидаемый ответ: {"error":"Authentication required"}

# Login:
curl -s -c /tmp/cookies.txt http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Ожидаемый ответ: {"id":"...","username":"admin","role":"admin"}

# С cookie — должно работать:
curl -s -b /tmp/cookies.txt http://localhost:3001/api/rooms?propertyId=... | head -1
# Ожидаемый ответ: JSON с данными

# Health без cookie — должно работать (public route):
curl -s http://localhost:3001/health
# Ожидаемый ответ: {"status":"ok"}

kill %1
```

## Критерии приёмки
- [ ] Auth middleware раскомментирован и работает
- [ ] Запросы без cookie возвращают 401
- [ ] /health и /api/auth/login доступны без cookie
- [ ] Login возвращает cookie, с ней запросы работают
- [ ] CORS ограничен allowedOrigins
- [ ] Cookie имеет `secure: true` только в production
- [ ] Rate limit: 6-й login за минуту → 429
- [ ] Все тесты проходят (unit + integration)
- [ ] TypeScript typecheck чистый
