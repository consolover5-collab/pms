import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BUILD_ID_PATH = path.join(REPO_ROOT, 'apps/web/.next/BUILD_ID');

export default async function buildGate(): Promise<void> {
  if (!fs.existsSync(BUILD_ID_PATH)) {
    throw new Error(
      `apps/web/.next/BUILD_ID missing. Run 'pnpm --filter @pms/web build' before running the audit.`,
    );
  }

  const buildMtime = fs.statSync(BUILD_ID_PATH).mtimeMs;
  // Last commit touching apps/web:
  let lastWebCommitTsSec = 0;
  try {
    lastWebCommitTsSec = Number(
      execSync('git log -1 --format=%ct -- apps/web', { cwd: REPO_ROOT }).toString().trim(),
    );
  } catch {
    // no git history — skip check
  }
  const lastWebCommitTsMs = lastWebCommitTsSec * 1000;

  if (lastWebCommitTsMs && buildMtime < lastWebCommitTsMs) {
    throw new Error(
      `Stale .next/ detected: BUILD_ID mtime ${new Date(buildMtime).toISOString()} is older than last apps/web commit ${new Date(lastWebCommitTsMs).toISOString()}. Run 'pnpm --filter @pms/web build' before running the audit.`,
    );
  }

  const buildId = fs.readFileSync(BUILD_ID_PATH, 'utf8').trim();
  console.log(`[build-gate] BUILD_ID=${buildId}, mtime=${new Date(buildMtime).toISOString()}`);
}
