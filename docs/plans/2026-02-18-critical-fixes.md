# Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 critical business logic gaps: balance check before checkout, transaction code CRUD, and taxRate in property settings.

**Architecture:** Minimal changes to existing files following established patterns. API routes in `apps/api/src/routes/`, UI in `apps/web/src/app/configuration/`.

**Tech Stack:** Fastify 5, Next.js 15 App Router, Drizzle ORM, TypeScript, Tailwind CSS

---

### Task 1: Balance check before checkout

**Files:**
- Modify: `apps/api/src/routes/bookings.ts` — POST `/api/bookings/:id/check-out` (строки 481-554)

**Step 1: Add folio query and balance check in check-out endpoint**

После строки 515 (после проверки позднего выезда), перед `app.db.transaction(...)`, добавить:

```typescript
// Проверка баланса фолио: нельзя выезжать с положительным балансом
const folioTxs = await app.db
  .select({ debit: folioTransactions.debit, credit: folioTransactions.credit })
  .from(folioTransactions)
  .where(eq(folioTransactions.bookingId, request.params.id));

const balance = calculateFolioBalance(folioTxs);
if (balance > 0) {
  return reply.status(400).send({
    error: `Нельзя выехать: у гостя открытый баланс ${balance.toFixed(2)} руб. Примите оплату перед выездом.`,
    code: "UNPAID_BALANCE",
    balance,
  });
}
```

Также добавить импорты вверху файла:
- `folioTransactions` из `@pms/db`
- `calculateFolioBalance` из `@pms/domain`

**Step 2: Run typecheck**

```bash
cd /home/oci/pms && pnpm --filter @pms/api typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
cd /home/oci/pms && git add apps/api/src/routes/bookings.ts && git commit -m "fix: require zero folio balance before checkout"
```

---

### Task 2: Transaction codes CRUD — API

**Files:**
- Modify: `apps/api/src/routes/transaction-codes.ts`

**Step 1: Add POST, PUT, DELETE endpoints**

Добавить после существующего GET-эндпоинта (строка 32):

```typescript
// Create transaction code
app.post<{
  Body: {
    propertyId: string;
    code: string;
    description: string;
    groupCode: string;
    transactionType?: string;
    isManualPostAllowed?: boolean;
    sortOrder?: number;
  };
}>("/api/transaction-codes", async (request, reply) => {
  const { propertyId, code, description, groupCode, transactionType, isManualPostAllowed, sortOrder } = request.body;
  if (!propertyId || !code || !description || !groupCode) {
    return reply.status(400).send({ error: "propertyId, code, description, groupCode — обязательные поля" });
  }
  const [created] = await app.db
    .insert(transactionCodes)
    .values({
      propertyId,
      code: code.toUpperCase(),
      description,
      groupCode,
      transactionType: transactionType || "charge",
      isManualPostAllowed: isManualPostAllowed ?? true,
      sortOrder: sortOrder ?? 0,
    })
    .returning();
  return reply.status(201).send(created);
});

// Update transaction code
app.put<{
  Params: { id: string };
  Body: {
    code?: string;
    description?: string;
    groupCode?: string;
    transactionType?: string;
    isManualPostAllowed?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  };
}>("/api/transaction-codes/:id", async (request, reply) => {
  if (!isValidUuid(request.params.id)) {
    return reply.status(400).send({ error: "Invalid id format" });
  }
  const [existing] = await app.db
    .select({ id: transactionCodes.id })
    .from(transactionCodes)
    .where(eq(transactionCodes.id, request.params.id));
  if (!existing) return reply.status(404).send({ error: "Not found" });

  const body: Record<string, unknown> = { ...request.body };
  if (body.code) body.code = (body.code as string).toUpperCase();

  const [updated] = await app.db
    .update(transactionCodes)
    .set(body)
    .where(eq(transactionCodes.id, request.params.id))
    .returning();
  return updated;
});

// Delete (soft-delete: set isActive = false)
app.delete<{
  Params: { id: string };
  Querystring: { propertyId: string };
}>("/api/transaction-codes/:id", async (request, reply) => {
  const { id } = request.params;
  const { propertyId } = request.query;
  if (!isValidUuid(id)) return reply.status(400).send({ error: "Invalid id" });
  if (!propertyId) return reply.status(400).send({ error: "propertyId is required" });

  // Check for folio transaction usage
  const { folioTransactions: ft } = await import("@pms/db");
  const { count } = await import("drizzle-orm");
  const [usage] = await app.db
    .select({ cnt: count() })
    .from(ft)
    .where(eq(ft.transactionCodeId, id));
  if (usage.cnt > 0) {
    return reply.status(400).send({
      error: `Нельзя удалить: код используется в ${usage.cnt} транзакциях фолио`,
      code: "HAS_FOLIO_TRANSACTIONS",
    });
  }

  const [deleted] = await app.db
    .update(transactionCodes)
    .set({ isActive: false })
    .where(and(eq(transactionCodes.id, id), eq(transactionCodes.propertyId, propertyId)))
    .returning({ id: transactionCodes.id });
  if (!deleted) return reply.status(404).send({ error: "Not found" });
  return reply.status(204).send();
});
```

**Step 2: Run typecheck**

```bash
cd /home/oci/pms && pnpm --filter @pms/api typecheck
```

**Step 3: Commit**

```bash
cd /home/oci/pms && git add apps/api/src/routes/transaction-codes.ts && git commit -m "feat: add POST/PUT/DELETE endpoints for transaction codes"
```

---

### Task 3: Transaction codes — UI (форма + страницы)

**Files:**
- Create: `apps/web/src/app/configuration/transaction-codes/transaction-code-form.tsx`
- Create: `apps/web/src/app/configuration/transaction-codes/new/page.tsx`
- Create: `apps/web/src/app/configuration/transaction-codes/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/configuration/transaction-codes/page.tsx`

**Step 1: Create transaction-code-form.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GROUP_CODES = [
  "room_charge", "tax", "minibar", "restaurant", "spa",
  "laundry", "phone", "parking", "misc",
];

type TransactionCodeForm = {
  id?: string;
  code: string;
  description: string;
  groupCode: string;
  transactionType: string;
  isManualPostAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function TransactionCodeForm({
  code,
  propertyId,
  isEdit = false,
}: {
  code?: TransactionCodeForm;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TransactionCodeForm>({
    code: code?.code || "",
    description: code?.description || "",
    groupCode: code?.groupCode || "room_charge",
    transactionType: code?.transactionType || "charge",
    isManualPostAllowed: code?.isManualPostAllowed ?? true,
    sortOrder: code?.sortOrder ?? 0,
    isActive: code?.isActive ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/transaction-codes/${code?.id}`
        : `/api/transaction-codes`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, propertyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      router.replace("/configuration/transaction-codes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Code *</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            maxLength={20}
            className="w-full border rounded px-3 py-2"
            placeholder="ROOM"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          className="w-full border rounded px-3 py-2"
          placeholder="Room Charge"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Transaction Type *</label>
          <select
            value={form.transactionType}
            onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="charge">Charge</option>
            <option value="payment">Payment</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Group Code *</label>
          <select
            value={form.groupCode}
            onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            {GROUP_CODES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="payment">payment</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isManualPostAllowed}
            onChange={(e) => setForm({ ...form, isManualPostAllowed: e.target.checked })}
          />
          Allow manual posting
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Update" : "Create"}
        </button>
        <a
          href="/configuration/transaction-codes"
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
```

**Step 2: Create new/page.tsx**

```tsx
import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { TransactionCodeForm } from "../transaction-code-form";

export default async function NewTransactionCodePage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id || "";
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <BackButton fallbackHref="/configuration/transaction-codes" label="Back to Transaction Codes" />
      <h1 className="text-2xl font-bold mt-2 mb-6">New Transaction Code</h1>
      <TransactionCodeForm propertyId={propertyId} />
    </main>
  );
}
```

**Step 3: Create [id]/edit/page.tsx**

```tsx
import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { TransactionCodeForm } from "../../transaction-code-form";
import { notFound } from "next/navigation";

type TC = {
  id: string; code: string; description: string; groupCode: string;
  transactionType: string; isManualPostAllowed: boolean;
  sortOrder: number; isActive: boolean; propertyId: string;
};

export default async function EditTransactionCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id || "";
  // Fetch all codes and find by id (no single-item endpoint yet)
  const allCodes = propertyId
    ? await apiFetch<TC[]>(`/api/transaction-codes?propertyId=${propertyId}`)
    : [];
  const tc = allCodes.find((c) => c.id === id);
  if (!tc) notFound();
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <BackButton fallbackHref="/configuration/transaction-codes" label="Back to Transaction Codes" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Transaction Code</h1>
      <TransactionCodeForm code={tc} propertyId={propertyId} isEdit />
    </main>
  );
}
```

**Step 4: Add Create button + Edit links to list page**

В `transaction-codes/page.tsx` добавить:
- Кнопку "New Transaction Code" рядом с заголовком
- Ссылки "Edit" в каждой строке таблицы

**Step 5: Run typecheck**

```bash
cd /home/oci/pms && pnpm --filter @pms/web typecheck
```

**Step 6: Commit**

```bash
cd /home/oci/pms && git add apps/web/src/app/configuration/transaction-codes/ && git commit -m "feat: add transaction code create/edit UI"
```

---

### Task 4: Property taxRate — API + UI

**Files:**
- Modify: `apps/api/src/routes/properties.ts` — добавить `taxRate` в Body PUT
- Modify: `apps/web/src/app/configuration/property/property-form.tsx` — добавить поле

**Step 1: Add taxRate to PUT endpoint**

В `properties.ts` в Body типе добавить `taxRate?: string;`. Drizzle автоматически передаст через `...request.body`.

**Step 2: Add taxRate field in property-form.tsx**

Добавить `taxRate` в тип `Property`:
```typescript
taxRate: string | null;
```

В `form` state добавить:
```typescript
taxRate: property.taxRate || "0",
```

В JSX в секцию Operations добавить поле:
```tsx
<div>
  <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
  <input
    type="number"
    value={form.taxRate}
    onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
    min={0}
    max={100}
    step={0.01}
    className="w-full border rounded px-3 py-2"
    placeholder="20"
  />
  <p className="text-xs text-gray-500 mt-1">VAT/НДС rate applied to room charges</p>
</div>
```

**Step 3: Typecheck + build**

```bash
cd /home/oci/pms && pnpm typecheck && pnpm build
```

**Step 4: Commit**

```bash
cd /home/oci/pms && git add apps/api/src/routes/properties.ts apps/web/src/app/configuration/property/property-form.tsx && git commit -m "feat: add taxRate to property settings"
```

---

### Task 5: Final verification

**Step 1: Full typecheck + lint + build**

```bash
cd /home/oci/pms && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all pass ✅

**Step 2: Restart API (if running)**

```bash
pkill -f "tsx src/server.ts" 2>/dev/null; cd /home/oci/pms/apps/api && tsx src/server.ts &
```

**Step 3: Final commit if needed**

```bash
cd /home/oci/pms && git log --oneline -5
```
