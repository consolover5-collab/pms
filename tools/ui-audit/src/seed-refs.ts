/**
 * Canonical seed UUIDs for Grand Baltic Hotel (GBH) property.
 * Values verified against seed.ts on 2026-04-21.
 * Update if seed.ts changes — verify via api-probe (see src/api-probe.ts).
 */

export const SEED = {
  property: {
    GBH: 'ff1d9135-dfb9-4baa-be46-0e739cd26dad',
  },
  roomType: {
    standardDouble: 'e8f25fcd-bdaf-43bb-b39f-4d9ad6d83c84',
  },
  ratePlan: {
    // Base rate (default-picked in new booking form)
    RACK: 'f47aaf7f-572e-4c24-9f66-506bd24839be',
    // Non-base, lower rate used for rate-switch tests
    PROMO: '28d39f1c-87bd-4824-b3e8-788053b6ff37',
  },
  room: {
    // Verified OOS at seed time — used for room-unavailable scenarios
    oos: '6762e1df-44b0-48cf-915e-97ac366cc297',
  },
  profileType: {
    individual: 'individual',
    company: 'company',
    travelAgent: 'travel_agent',
    source: 'source',
    contact: 'contact',
  },
  auth: {
    adminUsername: 'admin',
    adminPassword: 'admin123',
  },
} as const;
