import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseDocument } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = path.resolve(__dirname, '../../../docs/ui-audit');
const INDEX_PATH = path.join(AUDIT_DIR, 'index.yml');

type Status = 'ok' | 'partial' | 'broken' | 'missing' | 'pending';
type Section = { id: string; file: string; status: Status; bugs: number; priority: string };

const VALID_STATUS: Status[] = ['ok', 'partial', 'broken', 'missing', 'pending'];

function countBugs(feature: { bugs?: unknown[] } | null): number {
  return Array.isArray(feature?.bugs) ? feature!.bugs!.length : 0;
}

function main(): void {
  const doc = parseDocument(fs.readFileSync(INDEX_PATH, 'utf8'));
  const sections = doc.toJS().sections as Section[];

  const seenIds = new Set<string>();
  for (const s of sections) {
    if (seenIds.has(s.id)) {
      throw new Error(`Duplicate section ID in index.yml: ${s.id}`);
    }
    seenIds.add(s.id);
  }

  const totals: Record<Status | 'bugs' | 'sections', number> = {
    sections: sections.length,
    ok: 0,
    partial: 0,
    broken: 0,
    missing: 0,
    pending: 0,
    bugs: 0,
  };

  for (const section of sections) {
    const featurePath = path.join(AUDIT_DIR, section.file);
    if (!fs.existsSync(featurePath)) {
      section.status = 'pending';
      section.bugs = 0;
    } else {
      const feature = parse(fs.readFileSync(featurePath, 'utf8')) as {
        status?: Status;
        bugs?: unknown[];
      };
      const rawStatus = feature.status ?? 'pending';
      if (!VALID_STATUS.includes(rawStatus as Status)) {
        throw new Error(`${section.file}: invalid status '${rawStatus}' (must be one of ${VALID_STATUS.join('|')})`);
      }
      section.status = rawStatus as Status;
      section.bugs = countBugs(feature);
    }
    totals[section.status]++;
    totals.bugs += section.bugs;
  }

  doc.set('sections', sections);
  doc.set('totals', totals);
  fs.writeFileSync(INDEX_PATH, doc.toString());
  console.log('index.yml aggregated:', totals);
}

main();
