import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.resolve(__dirname, '../../../docs/ui-audit/features');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../docs/ui-audit/screenshots');

const REQUIRED_FIELDS = [
  'id', 'title', 'route', 'depends_on', 'locales_tested',
  'ui', 'steps', 'edge_cases',
  'api_calls_observed', 'console_errors', 'network_errors',
  'bugs', 'status', 'last_audited', 'screenshots_dir', 'help_rewrite_hints', 'retro',
];

const VALID_STATUS = ['ok', 'partial', 'broken', 'missing', 'pending'];

function main(): void {
  const errors: string[] = [];
  for (const file of fs.readdirSync(FEATURES_DIR)) {
    if (!file.endsWith('.yml') || file === '_template.yml') continue;
    const fullPath = path.join(FEATURES_DIR, file);
    const relPath = path.relative(process.cwd(), fullPath);
    let doc: Record<string, unknown>;
    try {
      doc = parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      errors.push(`${relPath}: YAML parse error: ${(e as Error).message}`);
      continue;
    }
    for (const f of REQUIRED_FIELDS) {
      if (!(f in doc)) errors.push(`${relPath}: missing field '${f}'`);
    }
    const status = doc.status as string;
    if (status && !VALID_STATUS.includes(status)) {
      errors.push(`${relPath}: invalid status '${status}' (must be one of ${VALID_STATUS.join('|')})`);
    }
    const steps = doc.steps as { screenshots?: string[] }[] | undefined;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        for (const ss of step.screenshots ?? []) {
          const ssPath = path.resolve(SCREENSHOTS_DIR, ss);
          if (!ssPath.startsWith(SCREENSHOTS_DIR + path.sep)) {
            errors.push(`${relPath}: screenshot path escapes screenshots dir: ${ss}`);
            continue;
          }
          if (!fs.existsSync(ssPath)) {
            errors.push(`${relPath}: screenshot not found: ${ss}`);
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
