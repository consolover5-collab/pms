import buildGate from './build-gate.ts';
import apiProbe from './api-probe.ts';

const API_URL = process.env.AUDIT_API_URL ?? 'http://localhost:3001';

// Login once at global setup and export the admin session token via env so
// every Playwright worker (forked from the main process) can patch its own
// globalThis.fetch with the cookie. See shared.ts for the per-worker patch.
async function captureAdminSession(): Promise<string> {
  const r = await globalThis.fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!r.ok) {
    throw new Error(
      `[global-setup] admin login failed: ${r.status} ${await r.text()}`,
    );
  }
  const setCookie = r.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/pms_session=([^;]+)/);
  if (!match) {
    throw new Error(`[global-setup] no pms_session cookie in login response`);
  }
  return match[1];
}

export default async function globalSetup(): Promise<void> {
  await buildGate();
  const token = await captureAdminSession();
  // Workers inherit env from the main process at fork time — set before apiProbe
  // so the probe also benefits.
  process.env.AUDIT_ADMIN_SESSION = token;
  await apiProbe();
}
