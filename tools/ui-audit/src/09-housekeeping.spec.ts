import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';

const SECTION_ID = '09-housekeeping';
const ROUTE = '/housekeeping';

const labels = {
  ru: {
    title: 'Уборка номеров',
    generateBtn: 'Сгенерировать задания на сегодня',
    generating: 'Генерация...',
    emptyNoTasks: 'На текущую дату нет заданий по уборке. Нажмите «Сгенерировать».',
    actionStart: 'Начать',
    actionDone: 'Готово',
    actionSkip: 'Пропустить',
    maidPlaceholder: 'Имя горничной...',
    filterAllStatuses: 'Все статусы',
  },
  en: {
    title: 'Housekeeping',
    generateBtn: 'Generate today\'s tasks',
    generating: 'Generating…',
    emptyNoTasks: 'No housekeeping tasks for today. Click Generate.',
    actionStart: 'Start',
    actionDone: 'Done',
    actionSkip: 'Skip',
    maidPlaceholder: 'Attendant name…',
    filterAllStatuses: 'All statuses',
  },
} as const;

// Task IDs from probe: unassigned pending tasks we can mutate
// 00eb7a7d — room 204, stayover_clean (use for assign scenario)
// 907ed90b — room 704, stayover_clean (use for complete scenario)
const API_RESPONSE_TIMEOUT_MS = 15_000;
const UI_SETTLE_TIMEOUT_MS = 8_000;

const TASK_ASSIGN_ID = '00eb7a7d-1786-424f-9e06-11373aca35ee';
const TASK_COMPLETE_ID = '907ed90b-48a5-4bd3-bd96-d212a40e6d9f';
const TASK_ROOM_704_ID = 'd601fe24-4bfb-4e86-b936-2dee00489080'; // roomId for task 907ed90b

async function fetchTask(id: string): Promise<{ id: string; status: string; assignedTo: string | null } | null> {
  // The PATCH endpoint exists but not a GET; use the list and filter.
  const r = await fetch(
    `${API_URL}/api/housekeeping/tasks?propertyId=${GBH_PROPERTY_ID}`,
  );
  if (!r.ok) throw new Error(`GET /housekeeping/tasks failed: ${r.status}`);
  const data = (await r.json()) as { data: Array<{ id: string; status: string; assignedTo: string | null }> };
  return data.data.find((t) => t.id === id) ?? null;
}

async function resetTask(id: string, patch: { status?: string; assignedTo?: string | null }) {
  await fetch(`${API_URL}/api/housekeeping/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

test.describe('09 housekeeping', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // Safety-net: restore tasks to their original states after the full run.
      await resetTask(TASK_ASSIGN_ID, { assignedTo: null });
      await resetTask(TASK_COMPLETE_ID, { status: 'pending' });
    },
  });

  // ── Scenario 01: list/kanban renders ────────────────────────────────────────
  test('01-list-render: housekeeping page loads and kanban renders ≥1 task', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Page title is present.
    await expect(page.getByRole('heading', { name: labels[locale].title })).toBeVisible();

    // The kanban board renders — at least one task card is visible.
    // We have 33 seed tasks so the board is never empty.
    const kcards = page.getByTestId('hk-task-card');
    await expect(kcards.first()).toBeVisible();
    const count = await kcards.count();
    testInfo.attach('kcard-count', { body: String(count), contentType: 'text/plain' });
    expect(count).toBeGreaterThanOrEqual(1);

    // KPI row: 6 status columns (dirty, pickup, clean, inspected, ooo, oos).
    const kpiVals = page.getByTestId('hk-kpi-value');
    await expect(kpiVals).toHaveCount(6);

    // Status filter select is visible with "All statuses" option.
    const statusSelect = page.getByTestId('hk-status-select');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('all');

    // Generate button is rendered (always present regardless of task count).
    await expect(
      page.getByRole('button', { name: labels[locale].generateBtn }),
    ).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '01-list-render', locale);
  });

  // ── Scenario 02: generate-tasks ─────────────────────────────────────────────
  // The "Generate today's tasks" button is always present; tasks already exist for
  // today so the API will return {created:0}. We click, wait for the POST, and
  // confirm the button returns to its non-loading state. Mark NA is not needed —
  // button is present.
  test('02-generate-tasks: generate button present; POST /api/housekeeping/generate fires', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const generateBtn = page.getByRole('button', { name: labels[locale].generateBtn });
    await expect(generateBtn).toBeVisible();

    // Ensure tasks already present before generate (kanban not empty).
    await expect(page.getByTestId('hk-task-card').first()).toBeVisible();
    const preCount = await page.getByTestId('hk-task-card').count();
    testInfo.attach('pre-generate-kcard-count', {
      body: String(preCount),
      contentType: 'text/plain',
    });
    expect(preCount).toBeGreaterThanOrEqual(1);

    const [genResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/housekeeping/generate') &&
          r.request().method() === 'POST',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      generateBtn.click(),
    ]);
    testInfo.attach('generate-response', {
      body: `status=${genResp.status()} body=${await genResp.text()}`,
      contentType: 'text/plain',
    });
    expect(genResp.status()).toBe(200);

    // Button returns to normal state after response.
    await expect(generateBtn).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });
    await expect(generateBtn).toBeEnabled({ timeout: 5_000 });

    await auditScreenshot(page, SECTION_ID, '02-generate-tasks', locale);
  });

  // ── Scenario 03: assign-task (en-only mutation) ──────────────────────────────
  test('03-assign-task: type attendant name → onBlur fires PATCH → assignedTo saved', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    // Precondition: TASK_ASSIGN_ID is pending and unassigned.
    const pre = await fetchTask(TASK_ASSIGN_ID);
    testInfo.attach('pre-assign-task', {
      body: JSON.stringify(pre),
      contentType: 'application/json',
    });
    expect(pre).not.toBeNull();
    expect(pre!.status).toBe('pending');

    await setLocaleAndGoto(page, 'en', ROUTE);

    // Find the task card for TASK_ASSIGN_ID using room number 204.
    const kcards = page.getByTestId('hk-task-card');
    await expect(kcards.first()).toBeVisible();
    const count = await kcards.count();
    testInfo.attach('kcard-count', { body: String(count), contentType: 'text/plain' });
    expect(count).toBeGreaterThan(0);

    // Find the card with room 204.
    const card204 = page.getByTestId('hk-task-card').filter({ has: page.getByTestId('hk-room-no').filter({ hasText: '204' }) });
    testInfo.attach('card-204-count', { body: String(await card204.count()), contentType: 'text/plain' });
    await expect(card204).toHaveCount(1);

    // Use the first matching card.
    const targetCard = card204.first();
    await expect(targetCard).toBeVisible();

    // The assignedTo input inside the card.
    const maidInput = targetCard.getByTestId('hk-assign-input');
    await expect(maidInput).toBeVisible();

    const newAttendant = 'AuditBot';
    await maidInput.fill(newAttendant);

    // Wait for the PATCH request triggered by blur.
    const [patchResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/housekeeping/tasks/${TASK_ASSIGN_ID}`) &&
          r.request().method() === 'PATCH',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      maidInput.blur(),
    ]);
    testInfo.attach('assign-response', {
      body: `status=${patchResp.status()}`,
      contentType: 'text/plain',
    });
    expect(patchResp.status()).toBe(200);

    // Confirm assignedTo persisted via API.
    await expect
      .poll(
        async () => {
          const t = await fetchTask(TASK_ASSIGN_ID);
          return t?.assignedTo;
        },
        { timeout: UI_SETTLE_TIMEOUT_MS },
      )
      .toBe(newAttendant);

    await auditScreenshot(page, SECTION_ID, '03-assign-task', 'en');
  });

  // ── Scenario 04: complete-task (en-only mutation) ────────────────────────────
  test('04-complete-task: click Done → PATCH → status=completed; room housekeepingStatus may change', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    // Precondition: TASK_COMPLETE_ID is pending.
    const pre = await fetchTask(TASK_COMPLETE_ID);
    testInfo.attach('pre-complete-task', {
      body: JSON.stringify(pre),
      contentType: 'application/json',
    });
    expect(pre).not.toBeNull();
    expect(pre!.status).toBe('pending');

    // Also snapshot the room HK status before completing.
    const preRoomResp = await fetch(`${API_URL}/api/rooms/${TASK_ROOM_704_ID}`);
    const preRoom = preRoomResp.ok ? await preRoomResp.json() : null;
    testInfo.attach('pre-complete-room', {
      body: JSON.stringify(preRoom),
      contentType: 'application/json',
    });

    await setLocaleAndGoto(page, 'en', ROUTE);

    // Find card for room 704.
    const card704 = page.getByTestId('hk-task-card').filter({ has: page.getByTestId('hk-room-no').filter({ hasText: '704' }) });
    testInfo.attach('card-704-count', { body: String(await card704.count()), contentType: 'text/plain' });
    await expect(card704).toHaveCount(1);

    const targetCard = card704.first();
    await expect(targetCard).toBeVisible();

    // The "Done" button should be present for a pending task.
    const doneBtn = targetCard.getByRole('button', { name: labels.en.actionDone, exact: true });
    await expect(doneBtn).toHaveCount(1);
    await expect(doneBtn).toBeVisible();

    const [patchResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/housekeeping/tasks/${TASK_COMPLETE_ID}`) &&
          r.request().method() === 'PATCH',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      doneBtn.click(),
    ]);
    testInfo.attach('complete-response', {
      body: `status=${patchResp.status()}`,
      contentType: 'text/plain',
    });
    expect(patchResp.status()).toBe(200);

    // Confirm status updated via API.
    await expect
      .poll(
        async () => {
          const t = await fetchTask(TASK_COMPLETE_ID);
          return t?.status;
        },
        { timeout: UI_SETTLE_TIMEOUT_MS },
      )
      .toBe('completed');

    // Snapshot room HK status after completion (observational — may or may not change).
    const postRoomResp = await fetch(`${API_URL}/api/rooms/${TASK_ROOM_704_ID}`);
    const postRoom = postRoomResp.ok ? await postRoomResp.json() : null;
    testInfo.attach('post-complete-room', {
      body: JSON.stringify(postRoom),
      contentType: 'application/json',
    });

    await auditScreenshot(page, SECTION_ID, '04-complete-task', 'en');
  });
});
