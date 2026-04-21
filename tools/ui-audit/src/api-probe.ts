import { SEED } from './seed-refs.ts';

const API = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
const PROPERTY = `?propertyId=${SEED.property.GBH}`;

const REQUIRED_ENDPOINTS: { path: string; expectMinTotal?: number }[] = [
  { path: '/health' },
  { path: '/api/properties' },
  { path: `/api/business-date${PROPERTY}` },
  { path: `/api/room-types${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/rooms${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/rate-plans${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/profiles${PROPERTY}&type=individual`, expectMinTotal: 0 },
  { path: `/api/profiles${PROPERTY}&type=company`, expectMinTotal: 1 },
  { path: `/api/profiles${PROPERTY}&type=travel_agent`, expectMinTotal: 1 },
  { path: `/api/profiles${PROPERTY}&type=source`, expectMinTotal: 1 },
  { path: `/api/transaction-codes${PROPERTY}`, expectMinTotal: 1 },
];

export default async function apiProbe(): Promise<void> {
  const failures: string[] = [];
  for (const ep of REQUIRED_ENDPOINTS) {
    try {
      const res = await fetch(`${API}${ep.path}`);
      if (!res.ok) {
        failures.push(`${ep.path} → ${res.status}`);
        continue;
      }
      if (ep.expectMinTotal !== undefined) {
        const body = (await res.json()) as { total?: number } | unknown[];
        const count = Array.isArray(body)
          ? body.length
          : (body.total ?? 0);
        if (count < ep.expectMinTotal) {
          failures.push(`${ep.path} → only ${count} items (need ≥ ${ep.expectMinTotal})`);
        }
      }
    } catch (e) {
      failures.push(`${ep.path} → threw: ${(e as Error).message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `api-probe failed:\n  - ${failures.join('\n  - ')}\n\nFix seed or API before continuing.`,
    );
  }
  console.log(`[api-probe] ${REQUIRED_ENDPOINTS.length} endpoints OK`);
}
