# Баг: companies.map / travelAgents.map is not a function

## Диагноз

API возвращает `{ data: [...], total: N }`, а фронтенд ожидает plain-массив.

| Слой | Файл | Строка | Что происходит |
|---|---|---|---|
| API | `apps/api/src/routes/companies.ts` | 54 | `return { data, total: totalResult.count }` |
| API | `apps/api/src/routes/travel-agents.ts` | 53 | `return { data, total: totalResult.count }` |
| Фронт | `apps/web/src/app/configuration/companies/page.tsx` | 22 | `apiFetch<Company[]>(url)` — ожидает `[...]`, получает `{ data, total }` |
| Фронт | `apps/web/src/app/configuration/travel-agents/page.tsx` | 21 | `apiFetch<TravelAgent[]>(url)` — аналогично |

`apiFetch` (`apps/web/src/lib/api.ts:20`) делает `res.json()` без преобразований — переменная получает объект `{ data, total }`. Вызов `.map()` на объекте → TypeError.

### Дополнительный баг: неправильный query-параметр поиска

Обе страницы отправляли `?search=...`, а API ожидает `?q=...`.

| Файл | Было | Стало |
|---|---|---|
| `companies/page.tsx:21` | `?search=${encodeURIComponent(q)}` | `?q=${encodeURIComponent(q)}` |
| `travel-agents/page.tsx:20` | `?search=${encodeURIComponent(q)}` | `?q=${encodeURIComponent(q)}` |

## Фикс

### `apps/web/src/app/configuration/companies/page.tsx`

```diff
-  const url = q ? `/api/companies?search=${encodeURIComponent(q)}` : "/api/companies";
-  const companies = await apiFetch<Company[]>(url);
+  const url = q ? `/api/companies?q=${encodeURIComponent(q)}` : "/api/companies";
+  const result = await apiFetch<{ data: Company[]; total: number }>(url);
+  const companies = result.data;
```

### `apps/web/src/app/configuration/travel-agents/page.tsx`

```diff
-  const url = q ? `/api/travel-agents?search=${encodeURIComponent(q)}` : "/api/travel-agents";
-  const travelAgents = await apiFetch<TravelAgent[]>(url);
+  const url = q ? `/api/travel-agents?q=${encodeURIComponent(q)}` : "/api/travel-agents";
+  const result = await apiFetch<{ data: TravelAgent[]; total: number }>(url);
+  const travelAgents = result.data;
```

## Как проверить

```bash
# API-ответ (ожидается { data: [...], total: N })
curl -s http://localhost:3001/api/companies?propertyId=GBH | head -c 200
curl -s http://localhost:3001/api/travel-agents?propertyId=GBH | head -c 200

# Страницы должны открываться без TypeError
# http://localhost:3000/configuration/companies
# http://localhost:3000/configuration/travel-agents
```
