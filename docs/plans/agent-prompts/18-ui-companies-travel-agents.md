# Задача 18: UI — Companies и Travel Agents (CRUD)

## Контекст

API готово:
- `GET/POST /api/companies`, `GET/PUT/DELETE /api/companies/:id`
- `GET/POST /api/travel-agents`, `GET/PUT/DELETE /api/travel-agents/:id`

Оба API возвращают `{ data: [...], total: N }` для списков. propertyId передаётся как query param.

Образец UI-паттерна: `apps/web/src/app/configuration/rate-plans/` — server page + client list + client form.

## Файлы для создания

### 1. Companies — список

Создай `apps/web/src/app/configuration/companies/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { CompaniesList } from "./companies-list";

type Company = {
  id: string;
  name: string;
  shortName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  isActive: boolean;
};

export default async function CompaniesPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id;
  const result = propertyId
    ? await apiFetch<{ data: Company[]; total: number }>(`/api/companies?propertyId=${propertyId}`)
    : { data: [], total: 0 };

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <BackButton fallbackHref="/configuration" label="Back to Configuration" />
          <h1 className="text-2xl font-bold mt-2">Companies</h1>
          <p className="text-sm text-gray-500">{result.total} total</p>
        </div>
        <Link
          href="/configuration/companies/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Company
        </Link>
      </div>
      <CompaniesList companies={result.data} propertyId={propertyId ?? ""} />
    </main>
  );
}
```

### 2. Companies — client list

Создай `apps/web/src/app/configuration/companies/companies-list.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Company = {
  id: string;
  name: string;
  shortName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  isActive: boolean;
};

export function CompaniesList({ companies, propertyId }: { companies: Company[]; propertyId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Удалить компанию? Она будет деактивирована.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/companies/${id}?propertyId=${propertyId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка удаления");
      }
    } finally {
      setDeleting(null);
    }
  }

  if (companies.length === 0) {
    return <div className="text-center py-12 text-gray-500">Нет компаний. Добавьте первую.</div>;
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tax ID</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {companies.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium">{c.name}</div>
                {c.shortName && <div className="text-xs text-gray-500">{c.shortName}</div>}
              </td>
              <td className="px-4 py-3 text-sm">{c.taxId || "—"}</td>
              <td className="px-4 py-3 text-sm">{c.contactPerson || "—"}</td>
              <td className="px-4 py-3 text-sm">{c.phone || "—"}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded ${c.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {c.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <a href={`/configuration/companies/${c.id}/edit`} className="text-blue-600 hover:underline text-sm">Edit</a>
                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="text-red-600 hover:underline text-sm disabled:opacity-50">
                  {deleting === c.id ? "..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Companies — form (shared new/edit)

Создай `apps/web/src/app/configuration/companies/company-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CompanyForm = {
  name: string;
  shortName: string;
  taxId: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  creditLimit: string;
  paymentTermDays: string;
  notes: string;
  isActive: boolean;
};

export function CompanyForm({
  company,
  propertyId,
  isEdit = false,
}: {
  company?: any;
  propertyId: string;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CompanyForm>({
    name: company?.name || "",
    shortName: company?.shortName || "",
    taxId: company?.taxId || "",
    registrationNumber: company?.registrationNumber || "",
    email: company?.email || "",
    phone: company?.phone || "",
    address: company?.address || "",
    contactPerson: company?.contactPerson || "",
    creditLimit: company?.creditLimit || "",
    paymentTermDays: company?.paymentTermDays?.toString() || "",
    notes: company?.notes || "",
    isActive: company?.isActive ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = isEdit ? `/api/companies/${company.id}` : `/api/companies`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyId,
          creditLimit: form.creditLimit || null,
          paymentTermDays: form.paymentTermDays ? Number(form.paymentTermDays) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }
      router.replace("/configuration/companies");
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
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Short Name</label>
          <input type="text" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tax ID (ИНН)</label>
          <input type="text" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Registration #</label>
          <input type="text" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address</label>
        <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contact Person</label>
        <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="w-full border rounded px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Credit Limit</label>
          <input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} min={0} step={0.01} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment Term (days)</label>
          <input type="number" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} min={0} className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border rounded px-3 py-2" />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
          Active
        </label>
      )}

      <div className="flex gap-3 pt-4">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Saving..." : isEdit ? "Update" : "Create"}
        </button>
        <a href="/configuration/companies" className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</a>
      </div>
    </form>
  );
}
```

### 4. Companies — new page

Создай `apps/web/src/app/configuration/companies/new/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { CompanyForm } from "../company-form";

export default async function NewCompanyPage() {
  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id ?? "";

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration/companies" label="Back to Companies" />
      <h1 className="text-2xl font-bold mt-2 mb-6">New Company</h1>
      <CompanyForm propertyId={propertyId} />
    </main>
  );
}
```

### 5. Companies — edit page

Создай `apps/web/src/app/configuration/companies/[id]/edit/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { CompanyForm } from "../../company-form";
import { notFound } from "next/navigation";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let company;
  try {
    company = await apiFetch<any>(`/api/companies/${id}`);
  } catch {
    notFound();
  }

  const properties = await apiFetch<{ id: string }[]>("/api/properties");
  const propertyId = properties[0]?.id ?? "";

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BackButton fallbackHref="/configuration/companies" label="Back to Companies" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Edit Company</h1>
      <CompanyForm company={company} propertyId={propertyId} isEdit />
    </main>
  );
}
```

### 6–10. Travel Agents — аналогично

Создай те же 5 файлов для Travel Agents по паттерну Companies:

**`apps/web/src/app/configuration/travel-agents/page.tsx`** — server page, `apiFetch<{ data: TravelAgent[]; total: number }>(\`/api/travel-agents?propertyId=\${propertyId}\`)`.

Type:
```ts
type TravelAgent = {
  id: string;
  name: string;
  iataCode: string | null;
  commissionPercent: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  isActive: boolean;
};
```

Колонки таблицы: Name, IATA Code, Commission %, Phone, Status, Actions.

**`apps/web/src/app/configuration/travel-agents/travel-agents-list.tsx`** — client list, delete через `DELETE /api/travel-agents/:id`.

**`apps/web/src/app/configuration/travel-agents/travel-agent-form.tsx`** — form fields: name*, iataCode, commissionPercent, email, phone, address, contactPerson, notes, isActive (edit only). API: `POST/PUT /api/travel-agents[/:id]`.

**`apps/web/src/app/configuration/travel-agents/new/page.tsx`** — new page.

**`apps/web/src/app/configuration/travel-agents/[id]/edit/page.tsx`** — edit page.

## Проверка

```bash
cd /home/oci/pms && pnpm -r run typecheck
```

## Запреты

- НЕ трогай API routes
- НЕ трогай navbar.tsx и configuration/page.tsx (это в следующем промте)
- НЕ добавляй auth, rate-limit
- НЕ создавай файлы за пределами `apps/web/src/app/configuration/`
