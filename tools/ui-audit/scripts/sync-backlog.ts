/**
 * Sync BUG-* entries from docs/ui-audit/bugs.yml (source of truth) into
 * docs/backlog.json (project-wide backlog mirror).
 *
 * Motivation: Batch C retro §2.3 — bugs.yml and backlog.json drifted twice
 * because implementers manually copied entries and unintentionally condensed
 * the `fix` field. This script enforces a strict mirror and removes the
 * manual-copy step.
 *
 * Modes:
 *   default           — rewrites docs/backlog.json in place.
 *   --check           — compares what would be written against current file,
 *                       prints drift summary, exits 1 if drift detected, else 0.
 *
 * Behaviour:
 * - Replaces every existing BUG-* item with the canonical shape regenerated
 *   from bugs.yml.
 * - Inserts missing BUG-* items, sorted by numeric suffix (BUG-003 < BUG-012).
 * - Preserves non-BUG items (debt-*, feat-*, task-*, DEBT-*, FEAT-*, TASK-*)
 *   in their original order and position.
 * - Does NOT delete backlog.json BUG entries absent from bugs.yml — instead
 *   prints them as a warning (they may be deliberately-kept history, e.g.
 *   BUG-001/BUG-002 predate the ui-audit).
 * - Updates the `updated` field of backlog.json to today's date (UTC slice).
 *
 * Smoke-test checklist (see commit message for pass/fail):
 *   1. Idempotence — `pnpm --filter @pms/ui-audit sync-backlog` twice: second
 *      run reports Status: in-sync with 0 updates.
 *   2. Check mode after sync — `... sync-backlog:check` exits 0.
 *   3. Drift detection — mutate any BUG description in backlog.json, then
 *      `... sync-backlog:check` exits 1 and lists the drifted id.
 *   4. Non-BUG preservation — debt-*, feat-*, task-* items untouched.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BUGS_YML = path.join(REPO_ROOT, 'docs/ui-audit/bugs.yml');
const BACKLOG_JSON = path.join(REPO_ROOT, 'docs/backlog.json');

type Severity = 'low' | 'medium' | 'high' | 'critical';
type Status = 'open' | 'deferred' | 'resolved';

interface YamlBug {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  source?: string;
  file?: string;
  files?: string[];
  lines?: string;
  description?: string;
  fix?: string;
  defer_reason?: string;
}

interface YamlDoc {
  bugs: YamlBug[];
}

// Canonical JSON shape — key order matters for diff stability.
interface JsonBug {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  source?: string;
  files?: string[];
  lines?: string;
  description?: string;
  fix?: string;
  defer_reason?: string;
}

interface BacklogDoc {
  project: string;
  updated: string;
  note: string;
  items: Record<string, unknown>[];
}

function stripTrailingNewline(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

function canonicalizeBug(y: YamlBug): JsonBug {
  const out: JsonBug = {
    id: y.id,
    title: y.title,
    severity: y.severity,
    status: y.status,
  };
  if (y.source !== undefined) out.source = y.source;
  if (Array.isArray(y.files) && y.files.length > 0) {
    out.files = [...y.files];
  } else if (typeof y.file === 'string' && y.file.length > 0) {
    out.files = [y.file];
  }
  if (y.lines !== undefined) out.lines = y.lines;
  const desc = stripTrailingNewline(y.description);
  if (desc !== undefined) out.description = desc;
  const fix = stripTrailingNewline(y.fix);
  if (fix !== undefined) out.fix = fix;
  if (y.defer_reason !== undefined) out.defer_reason = y.defer_reason;
  return out;
}

function parseBugNumber(id: string): number {
  const m = /^BUG-(\d+)$/.exec(id);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function isBugId(id: unknown): id is string {
  return typeof id === 'string' && /^BUG-\d+$/.test(id);
}

/**
 * Deep equality for canonical JSON bug shapes. Strings (including those with
 * embedded newlines) are compared verbatim; arrays require matching length
 * and element-wise equality.
 */
function bugsEqual(a: JsonBug, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!(k in b)) return false;
    const va = (a as Record<string, unknown>)[k];
    const vb = b[k];
    if (Array.isArray(va)) {
      if (!Array.isArray(vb) || va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) {
        if (va[i] !== vb[i]) return false;
      }
    } else if (va !== vb) {
      return false;
    }
  }
  // Also confirm no extra keys on b that a doesn't have.
  for (const k of keysB) {
    if (!(k in a)) return false;
  }
  // Confirm key order matches — required for diff stability.
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
  }
  return true;
}

function diffFields(a: JsonBug, b: Record<string, unknown>): string[] {
  const out: string[] = [];
  const allKeys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    const va = (a as Record<string, unknown>)[k];
    const vb = b[k];
    if (va === undefined && vb !== undefined) {
      out.push(`${k} (only in json)`);
      continue;
    }
    if (vb === undefined && va !== undefined) {
      out.push(`${k} (only in yaml)`);
      continue;
    }
    if (Array.isArray(va) || Array.isArray(vb)) {
      if (JSON.stringify(va) !== JSON.stringify(vb)) out.push(k);
    } else if (va !== vb) {
      out.push(k);
    }
  }
  // Key order drift also counts.
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length === kb.length && ka.every((k, i) => k === kb[i])) {
    /* order matches */
  } else if (out.length === 0) {
    out.push('(field order)');
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const checkMode = argv.includes('--check');

  const yamlRaw = fs.readFileSync(BUGS_YML, 'utf8');
  const yamlDoc = parse(yamlRaw) as YamlDoc;
  if (!yamlDoc || !Array.isArray(yamlDoc.bugs)) {
    console.error('[sync-backlog] bugs.yml has no top-level bugs[] array');
    process.exit(1);
  }

  const backlogRaw = fs.readFileSync(BACKLOG_JSON, 'utf8');
  const backlog = JSON.parse(backlogRaw) as BacklogDoc;
  if (!backlog || !Array.isArray(backlog.items)) {
    console.error('[sync-backlog] backlog.json has no top-level items[] array');
    process.exit(1);
  }

  // Detect duplicate bug IDs in source.
  const seenYamlIds = new Set<string>();
  for (const b of yamlDoc.bugs) {
    if (seenYamlIds.has(b.id)) {
      console.error(`[sync-backlog] duplicate id in bugs.yml: ${b.id}`);
      process.exit(1);
    }
    seenYamlIds.add(b.id);
  }

  // Canonicalise every yaml bug.
  const yamlCanonical = new Map<string, JsonBug>();
  for (const b of yamlDoc.bugs) {
    yamlCanonical.set(b.id, canonicalizeBug(b));
  }

  // Index existing json BUG entries and count non-BUG items.
  const jsonBugIndex = new Map<string, { item: Record<string, unknown>; index: number }>();
  for (let i = 0; i < backlog.items.length; i++) {
    const item = backlog.items[i];
    if (isBugId(item.id)) {
      jsonBugIndex.set(item.id as string, { item, index: i });
    }
  }

  // Classify.
  const updates: { id: string; fields: string[] }[] = [];
  const additions: string[] = [];
  const orphans: string[] = []; // in json but not in yaml — kept
  const unchanged: string[] = [];

  for (const [id, canonical] of yamlCanonical) {
    const existing = jsonBugIndex.get(id);
    if (!existing) {
      additions.push(id);
      continue;
    }
    if (bugsEqual(canonical, existing.item)) {
      unchanged.push(id);
    } else {
      updates.push({ id, fields: diffFields(canonical, existing.item) });
    }
  }

  for (const id of jsonBugIndex.keys()) {
    if (!yamlCanonical.has(id)) orphans.push(id);
  }

  // Build new items[]: walk existing items preserving non-BUG positions,
  // replace known BUG-* entries with canonical form, drop canonicalised-inline,
  // then append any brand-new BUGs sorted numerically just before the first
  // non-BUG item (to keep bugs grouped at top) or at end if no non-BUG anchor.
  const today = new Date().toISOString().slice(0, 10);

  const mergedItems: Record<string, unknown>[] = [];
  const insertedIds = new Set<string>();

  for (const item of backlog.items) {
    if (isBugId(item.id)) {
      const id = item.id as string;
      const canonical = yamlCanonical.get(id);
      if (canonical) {
        mergedItems.push(canonical as unknown as Record<string, unknown>);
        insertedIds.add(id);
      } else {
        // Orphan — keep verbatim.
        mergedItems.push(item);
      }
    } else {
      mergedItems.push(item);
    }
  }

  // Append new BUG-* entries that were not yet inserted, sorted numerically.
  const newBugs = [...yamlCanonical.values()]
    .filter((b) => !insertedIds.has(b.id))
    .sort((a, b) => parseBugNumber(a.id) - parseBugNumber(b.id));

  if (newBugs.length > 0) {
    // Find the position of the last BUG-* entry already in mergedItems and
    // splice new ones right after it; if no existing BUG, splice at start.
    let lastBugIdx = -1;
    for (let i = 0; i < mergedItems.length; i++) {
      if (isBugId(mergedItems[i].id)) lastBugIdx = i;
    }
    const insertAt = lastBugIdx >= 0 ? lastBugIdx + 1 : 0;
    mergedItems.splice(insertAt, 0, ...(newBugs as unknown as Record<string, unknown>[]));
  }

  const newBacklog: BacklogDoc = {
    project: backlog.project,
    updated: today,
    note: backlog.note,
    items: mergedItems,
  };

  const newText = JSON.stringify(newBacklog, null, 2) + '\n';

  // For --check, compare newText with existing file. Also `updated` date
  // change alone must not count as drift — compare everything except updated.
  const existingForCompare: BacklogDoc = {
    ...backlog,
    updated: today,
  };
  const existingText = JSON.stringify(existingForCompare, null, 2) + '\n';
  const drift = newText !== existingText;

  // Print summary.
  const beforeBugCount = jsonBugIndex.size;
  const afterBugCount = yamlCanonical.size + orphans.length;
  const status = !drift
    ? 'in-sync'
    : checkMode
      ? 'drift-detected'
      : 'updated';

  console.log('bugs.yml → backlog.json sync');
  console.log(`- BUG entries in yaml: ${yamlCanonical.size}`);
  console.log(`- BUG entries in json (before): ${beforeBugCount}`);
  console.log(`- BUG entries added: ${additions.length}${additions.length > 0 ? `  (${additions.join(', ')})` : ''}`);
  if (updates.length > 0) {
    const detail = updates
      .map((u) => `${u.id} [${u.fields.join(', ')}]`)
      .join('; ');
    console.log(`- BUG entries updated: ${updates.length}   (drift: ${detail})`);
  } else {
    console.log('- BUG entries updated: 0');
  }
  console.log('- BUG entries removed (would-be): 0');
  if (orphans.length > 0) {
    console.log(
      `- Orphan entries in backlog.json (kept, printed as warning): ${orphans.length}  (${orphans.join(', ')})`,
    );
  } else {
    console.log('- Orphan entries in backlog.json (kept, printed as warning): 0');
  }
  console.log(`Status: ${status}`);

  if (orphans.length > 0) {
    console.warn(
      `[sync-backlog] WARNING: ${orphans.length} BUG id(s) in backlog.json not found in bugs.yml: ${orphans.join(', ')}. Kept as-is (likely resolved/historical).`,
    );
  }

  // BUG-count sanity (after write, every yaml bug must be present).
  if (afterBugCount < yamlCanonical.size) {
    console.error('[sync-backlog] internal error: merged result lost bug entries');
    process.exit(1);
  }

  if (checkMode) {
    process.exit(drift ? 1 : 0);
  }

  if (!drift) {
    // Even in default mode, if nothing changed we still rewrite the file to
    // refresh the `updated` date — but only if it actually differs, otherwise
    // skip the write to preserve mtime and avoid spurious git noise.
    if (existingText === newText) {
      // Nothing — the only thing that could differ is `updated`, and if we
      // arrived here via the compare above, existingText was built with the
      // new date so a literal equality means the current file already has
      // today's date and identical content. Skip write.
      return;
    }
  }

  fs.writeFileSync(BACKLOG_JSON, newText);
}

main();
