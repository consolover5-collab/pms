#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ROUTES_DIR = join(ROOT, "apps/api/src/routes");
const LOCALES_DIR = join(ROOT, "apps/web/src/lib/i18n/locales");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

function extractApiCodes() {
  const codes = new Set();
  for (const file of walk(ROUTES_DIR)) {
    const src = readFileSync(file, "utf8");
    const re = /code:\s*"([A-Z_][A-Z0-9_]*)"/g;
    let m;
    while ((m = re.exec(src)) !== null) codes.add(m[1]);
  }
  return codes;
}

function extractDictKeys(file) {
  const src = readFileSync(file, "utf8");
  const keys = new Set();
  const re = /^\s*"?(err_[a-z0-9_]+)"?:/gm;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

const apiCodes = extractApiCodes();
const apiAsKeys = new Set([...apiCodes].map(c => `err_${c.toLowerCase()}`));

const enKeys = extractDictKeys(join(LOCALES_DIR, "en.ts"));
const ruKeys = extractDictKeys(join(LOCALES_DIR, "ru.ts"));

const ALLOWED_EXTRAS = new Set(["err_unknown", "err_network_error"]);

const errors = [];

// Missing in dicts (API has code, dict lacks key)
const missingEn = [...apiAsKeys].filter(k => !enKeys.has(k)).sort();
const missingRu = [...apiAsKeys].filter(k => !ruKeys.has(k)).sort();
if (missingEn.length) errors.push(`en.ts is missing ${missingEn.length} keys:\n  ${missingEn.join("\n  ")}`);
if (missingRu.length) errors.push(`ru.ts is missing ${missingRu.length} keys:\n  ${missingRu.join("\n  ")}`);

// Dead keys (dict has err_key but no API code, and not in ALLOWED_EXTRAS)
const deadEn = [...enKeys].filter(k => !apiAsKeys.has(k) && !ALLOWED_EXTRAS.has(k)).sort();
const deadRu = [...ruKeys].filter(k => !apiAsKeys.has(k) && !ALLOWED_EXTRAS.has(k)).sort();
if (deadEn.length) errors.push(`en.ts has ${deadEn.length} dead keys (no API code):\n  ${deadEn.join("\n  ")}`);
if (deadRu.length) errors.push(`ru.ts has ${deadRu.length} dead keys (no API code):\n  ${deadRu.join("\n  ")}`);

// Drift between en and ru
const onlyEn = [...enKeys].filter(k => !ruKeys.has(k)).sort();
const onlyRu = [...ruKeys].filter(k => !enKeys.has(k)).sort();
if (onlyEn.length) errors.push(`keys in en.ts but not ru.ts:\n  ${onlyEn.join("\n  ")}`);
if (onlyRu.length) errors.push(`keys in ru.ts but not en.ts:\n  ${onlyRu.join("\n  ")}`);

if (errors.length) {
  console.error("i18n check FAILED:\n");
  for (const e of errors) console.error(e + "\n");
  console.error(`API codes: ${apiCodes.size}, en keys: ${enKeys.size}, ru keys: ${ruKeys.size}`);
  process.exit(1);
}

console.log(`i18n check OK — ${apiCodes.size} API codes, ${enKeys.size} en/${ruKeys.size} ru dict keys aligned.`);
