# Opera PMS Help — Анализ для архитектуры Free PMS

> Внутренний документ. Источник: Oracle Hospitality Opera PMS V5.6 Online Help
> https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/index.htm
> DB: OPERA1.HELP_FILE_MAPPING — 2490 записей, 2002 темы, 1271 форма

---

## 1. Модули Opera PMS (полный список)

1. **Reservations** — бронирование, multi-property поиск
2. **Front Desk** — check-in/check-out, room blocking
3. **Cashiering** — транзакции, платежи, фолио
4. **Night Audit / End of Day** — закрытие дня, бизнес-дата
5. **Rooms Management** — HK статусы, задачи горничных
6. **Rate Management** — тарифы, yield стратегии
7. **Guest Profiles** — CRM, история
8. **Group & Block Management** — групповые бронирования
9. **Accounts Receivable** — дебиторка
10. **Commission Processing** — агентские комиссии
11. **Packages** — пакеты услуг
12. **Reporting** — отчёты
13. **Communications** — сообщения, traces
14. **International** — мульти-валюта, мульти-язык

---

## 2. Business Date — ключевая концепция

**Факт из Help**: "OPERA has its own system date that is NOT automatically changed at midnight but AFTER finishing the End of Day sequence."

### Правила бизнес-даты:
- Бизнес-дата НЕ = системное время
- Переключается ТОЛЬКО после завершения Night Audit (End of Day)
- Все транзакции до End of Day относятся к текущему бизнес-дню
- Поздние check-in (после полуночи) = текущий бизнес-день
- Максимум 5 открытых бизнес-дат одновременно
- Бизнес-даты закрываются строго хронологически

### Что это значит для Free PMS:
- Нужна таблица `business_dates` с состоянием (open/closed)
- Текущая бизнес-дата = последняя открытая
- Все API endpoints должны использовать бизнес-дату, а не `new Date()`
- Night Audit = процедура закрытия бизнес-даты

---

## 3. End of Day (Night Audit) — полная последовательность

### Подготовка:
1. Обработать все Due Outs (выселить или продлить)
2. Пометить не приехавших как no-show
3. Убедиться что все приехавшие зачекинены
4. Закрыть все кассы
5. Все пользователи кроме аудитора выйти из системы

### Процедуры End of Day (в порядке выполнения):

#### Обязательные (Final):
1. **hkpkg.update_room_status_proc** — обновление HK статусов:
   - OOO/OOS комнаты возвращаются в inventory если дата возврата = бизнес-дата
   - Occupied rooms → выбранный статус (dirty/clean)
   - Vacant rooms → выбранный статус
   - No-show assigned rooms → обновление статуса
   - HK иерархия (высший → низший): Inspected > Clean > Pickup > Dirty

2. **reservation.no_show** — пометить неприехавших как no-show

3. **synchronize_fo_status** — синхронизация кол-ва гостей и occupancy между таблицами reservations и rooms

4. **refresh_fin_summary.populate_trial_balance** — trial balance по transaction codes

5. **refresh_fin_summary.refresh_resv_summary** — обновление баланса каждого гостя

6. **update_statistics** — статистика: кол-во номеров, гостей, revenue

#### Опциональные:
- **night_audit_authorization** — доавторизация кредитных карт
- **pms_grgrid.night_allotment_cutoff** — релиз невыкупленных квот
- **rate_strategy_pkg.set_rate_strategy** — активация/деактивация тарифных стратегий
- **delete_waitlist** — удаление waitlist прошлой даты
- **hk_maint.purge_room_maintenance** — чистка старых заявок maintenance

### После закрытия бизнес-даты:
- **Никакие корректировки невозможны** для закрытой даты
- Можно работать с текущей датой при нескольких открытых
- Room and Tax posting происходит ПОСЛЕ roll business date

---

## 4. Cashiering — архитектура

### Ключевые концепции:

#### Transaction Codes (коды транзакций)
- Каждая операция = transaction code
- Типы: Revenue (дебет), Payment (кредит), Wrapper (пакет)
- Manual vs Non-Manual (Night Audit only)
- Generates — автоматические дочерние транзакции (налоги)
- Adjustment codes — для корректировки non-manual кодов

#### Folio (фолио = счёт гостя)
- До 8 окон (windows) на бронирование
- Window 8 зарезервировано для auto-settlement transfers
- Каждое окно — отдельная группировка начислений
- Routing — автоматическая маршрутизация транзакций между окнами

#### Billing Screen — центральный экран кассира:
- Показывает полный счёт гостя
- Операции: Post, Payment, Settlement, Check Out, Folio print
- Drag & Drop транзакций между окнами
- Right-click меню: Delete, Edit, Transfer, Adjust, Split

### Операции над транзакциями:
| Операция | Когда | Детали |
|----------|-------|--------|
| **Post** | Ручное начисление | Transaction code + amount + qty |
| **Delete** | Только текущий день | Нельзя для Night Audit processed |
| **Edit** | Только текущий день | Цена, кол-во, сумма |
| **Adjust** | Любой день | Создаёт встречную транзакцию |
| **Transfer** | Любой день | Между гостями/окнами, частичные суммы |
| **Split** | Любой день | Деление на 2 с пересчётом налогов |

### Payment Methods (методы оплаты):
- Cash (с расчётом сдачи)
- Credit Card (авторизация, EFT, Chip & PIN)
- Direct Bill (перенос на AR)
- Check
- Loyalty Points Redemption
- Foreign Currency

### Surcharges (наценки):
- Credit Card Surcharge — % от суммы CC платежа
- Cash Surcharge — % или фикс от cash платежа

### Deposit Handling:
- Pre-stay deposits (до заезда)
- Auto deposit cancellation refund
- Deposit ledger → guest ledger transfer при check-in

---

## 5. Room and Tax Posting (начисление за номер)

**Когда**: Во время Night Audit, ПОСЛЕ roll business date
**Что**: Автоматическое начисление стоимости номера + налогов
- Rate code → transaction code → generates (налоги)
- Один раз за ночь (за бизнес-дату)
- Non-manual transaction codes (нельзя вручную)
- Adjustment codes для корректировок

---

## 6. Folio Structure (структура счёта)

### Минимальная модель для Free PMS:

```
folio_transactions:
  id, booking_id, business_date,
  transaction_code, description,
  amount (decimal), quantity,
  is_debit (bool),
  window_number (1-8),
  reference, supplement,
  posted_by (user),
  created_at, reversed_by (nullable)
```

### Transaction Code Categories для MVP:
1. **Room Charge** (auto, Night Audit)
2. **Tax** (auto, generates)
3. **Payment — Cash**
4. **Payment — Card**
5. **Payment — Direct Bill**
6. **Adjustment**
7. **Minibar / F&B** (manual)

---

## 7. Маппинг Opera Help Topics → DB Tables

Ключевые связки из HELP_FILE_MAPPING:

| Help Topic | Связанные таблицы Opera |
|------------|------------------------|
| cashiering_overview | FINANCIAL_TRANSACTIONS, CASHIER_* |
| billing | FOLIO_*, FINANCIAL_TRANSACTIONS |
| posting_transactions | FINANCIAL_TRANSACTIONS, TRN_CODES |
| payment | PAYMENT_*, CC_* |
| end_of_day_sequence | NIGHT_AUDIT_*, BUSINESS_DATE |
| reservation.no_show | RESERVATION_NAME (status update) |
| folio_history | FOLIO_*, FOLIO_TAX_* |
| cashier_functions | CASHIER_*, GENERAL_CASHIER |
| night_process | NIGHT_AUDIT_YN, BUSINESS_DATE |

---

## 8. Что нужно для MVP Free PMS (приоритеты)

### Must Have (без этого система не работает):
1. **Business Date** — таблица + API + использование везде
2. **Folio / Transactions** — таблица начислений/платежей
3. **Night Audit v2** — roll date + room charge posting + no-show
4. **Transaction Codes** — справочник кодов операций
5. **Payment processing** — минимум cash + card

### Should Have (следующий этап):
6. Routing между окнами фолио
7. Tax generates (автоналоги)
8. Folio printing / export
9. Cashier open/close
10. Deposit handling

### Nice to Have (позже):
11. Multi-currency
12. Direct Bill / AR
13. Articles (детализация minibar)
14. Commission processing
15. Surcharges

---

## 9. Ссылки на Help для каждого модуля

### Cashiering:
- [Cashiering Overview](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/cashiering_overview.htm)
- [Billing Screen](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/billing.htm)
- [Posting Transactions](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/posting_transactions.htm)
- [Payment](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/payment.htm)
- [Cashier Functions](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/cashier_functions.htm)

### Night Audit:
- [End of Day Sequence](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/about_end_of_day_sequence.htm)
- [End of Day Overview](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/end_of_day_overview.htm)

### Front Desk:
- [Getting Started](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/getting_started_with_pms.htm)
- [Welcome to PMS](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/welcome_to_pms.htm)

### DB Reference:
- OPERA1.HELP_FILE_MAPPING — 2002 уникальных тем
- Полный список topic_id доступен через MCP query
