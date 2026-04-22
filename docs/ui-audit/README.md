# UI Audit — PMS

**Начат:** 2026-04-21
**Статус:** pending (0/24 секций)
**План:** [../ui-audit-plan.md](../ui-audit-plan.md)

## Быстрые ссылки

- [index.yml](index.yml) — карта секций и их статусы
- [bugs.yml](bugs.yml) — сводная таблица найденных багов
- [features/](features/) — детальный YAML по каждой секции
- [screenshots/](screenshots/) — PNG-артефакты
- [scripts/](scripts/) — Playwright test-specs

## Как читать

Один YAML на одну секцию UI (см. `features/01-dashboard.yml` и далее). Каждый файл даёт:

- реальные лейблы кнопок/полей на ru и en
- перечень шагов happy path + edge cases
- наблюдаемые API-вызовы, console/network ошибки
- ссылки на скриншоты
- `help_rewrite_hints` — прямые подсказки для переписывания соответствующего help-топика

## После завершения аудита

Этот README будет дополнен:
- итоговой сводкой (ok/partial/broken/missing)
- топ-5 найденных багов
- приоритизированным списком help-топиков к переписыванию
