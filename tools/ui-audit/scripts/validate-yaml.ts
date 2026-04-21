import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.resolve(__dirname, '../../../docs/ui-audit/features');

const REQUIRED_FIELDS = [
  'id', 'title', 'route', 'locales_tested',
  'ui', 'steps', 'edge_cases',
  'api_calls_observed', 'console_errors', 'network_errors',
  'bugs', 'status', 'last_audited', 'screenshots_dir',
];

const VALID_STATUS = ['ok', 'partial', 'broken', 'missing', 'pending'];

function main(): void {
  const errors: string[] = [];
  for (const file of fs.readdirSync(FEATURES_DIR)) {
    if (!file.endsWith('.yml') || file === '_template.yml') continue;
    const fullPath = path.join(FEATURES_DIR, file);
    let doc: Record<string, unknown>;
    try {
      doc = parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      errors.push(`${file}: YAML parse error: ${(e as Error).message}`);
      continue;
    }
    for (const f of REQUIRED_FIELDS) {
      if (!(f in doc)) errors.push(`${file}: missing field '${f}'`);
    }
    const status = doc.status as string;
    if (status && !VALID_STATUS.includes(status)) {
      errors.push(`${file}: invalid status '${status}' (must be one of ${VALID_STATUS.join('|')})`);
    }
    const steps = doc.steps as { screenshots?: string[] }[] | undefined;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        for (const ss of step.screenshots ?? []) {
          const ssPath = path.resolve(__dirname, '../../../docs/ui-audit/screenshots', ss);
          if (!fs.existsSync(ssPath)) {
            errors.push(`${file}: screenshot not found: ${ss}`);
          }
        }
      }
    }
  }
  if (errors.length > 0) {
    console.error('validate-yaml failed:');
    for (const e of errors) console.error('  -', e);
    process.exit(1);
  }
  console.log('validate-yaml: all feature YAMLs OK');
}

main();
