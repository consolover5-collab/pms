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
