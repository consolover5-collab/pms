# Промт для GLM5.1: Баг — companies.map / travelAgents.map is not a function

## Контекст
Проект: PMS на Next.js 16 (App Router) + React 19 + Fastify 5.
Монорепо: `apps/web/` (фронтенд), `apps/api/` (бэкенд, порт 3001).

## Проблема
Две страницы крашатся с Runtime TypeError:

**Страница 1:** `/configuration/companies`
```
TypeError: companies.map is not a function
  at CompaniesList (src/app/configuration/companies/companies-list.tsx:90:26)
  at CompaniesPage (src/app/configuration/companies/page.tsx:39:7)
```

**Страница 2:** `/configuration/travel-agents`
```
TypeError: travelAgents.map is not a function
  at TravelAgentsList (src/app/configuration/travel-agents/travel-agents-list.tsx:88:29)
  at TravelAgentsPage (src/app/configuration/travel-agents/page.tsx:38:7)
```

Обе страницы ломаются на `.map()` — значит переменная не является массивом.

## Задача для исследования
1. Изучи `apps/api/src/routes/companies.ts` и соответствующий роут для travel-agents — что возвращает API: массив или объект с обёрткой `{ data: [...] }` или что-то другое?
2. Изучи `apps/web/src/app/configuration/companies/page.tsx` — как происходит fetch данных, что присваивается в `companies`.
3. Проверь: может API возвращает `{ companies: [...] }` а фронт ожидает просто `[...]`, или наоборот.
4. Проверь также `apps/web/src/app/configuration/travel-agents/page.tsx` — аналогичная ли проблема?

## Ожидаемый результат
Markdown-документ с:
- Точным диагнозом: что API возвращает vs что фронт ожидает
- Конкретными строками кода (file:line)
- Минимальным фиксом (1-2 строки кода)
- Как проверить: curl-запрос к API + ожидаемый ответ
