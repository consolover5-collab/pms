import { API_URL, GBH_PROPERTY_ID } from './shared.ts';

/**
 * Minimal fixture helpers. Used by pre-flight remediation when seed data is short.
 * Each function is idempotent-ish: it creates only if counts are insufficient.
 */

type ProfilesPage = { data: unknown[]; total: number };

export async function ensureGuests(minCount = 3): Promise<number> {
  const res = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=individual`,
  );
  const page = (await res.json()) as ProfilesPage;
  if (page.total >= minCount) return page.total;

  const toCreate = minCount - page.total;
  const names = [
    { firstName: 'Audit', lastName: 'Fixture-A' },
    { firstName: 'Audit', lastName: 'Fixture-B' },
    { firstName: 'Audit', lastName: 'Fixture-C' },
  ];
  for (let i = 0; i < toCreate; i++) {
    const body = {
      propertyId: GBH_PROPERTY_ID,
      type: 'individual',
      ...names[i],
      email: `audit-fixture-${Date.now()}-${i}@example.test`,
      force: true,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

async function ensureProfilesOfType(
  type: 'company' | 'travel_agent' | 'source',
  minCount: number,
  prefix: string,
): Promise<number> {
  const res = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=${type}`,
  );
  const page = (await res.json()) as ProfilesPage;
  if (page.total >= minCount) return page.total;

  const toCreate = minCount - page.total;
  for (let i = 0; i < toCreate; i++) {
    const body = {
      propertyId: GBH_PROPERTY_ID,
      type,
      name: `${prefix}-${Date.now()}-${i}`,
      email: `${prefix.toLowerCase()}-${Date.now()}-${i}@example.test`,
      force: true,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles (${type}) failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

export const ensureCompanies     = (min = 1) => ensureProfilesOfType('company',      min, 'AuditCo');
export const ensureTravelAgents  = (min = 1) => ensureProfilesOfType('travel_agent', min, 'AuditTA');
export const ensureSources       = (min = 1) => ensureProfilesOfType('source',       min, 'AuditSrc');

export async function ensureActiveBusinessDate(): Promise<string> {
  const res = await fetch(
    `${API_URL}/api/business-date?propertyId=${GBH_PROPERTY_ID}`,
  );
  if (!res.ok) {
    throw new Error(`GET /api/business-date failed: ${res.status}`);
  }
  const body = (await res.json()) as { businessDate?: string; date?: string };
  return body.businessDate ?? body.date ?? '';
}
