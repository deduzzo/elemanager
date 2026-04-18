#!/usr/bin/env node
// Import CSV sezioni in una giornata elettorale esistente.
// Usa service_role key da .env.server.
// Usage: node scripts/import-csv-sezioni.mjs <csv-url-or-path> <giornata-id>

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

function parseCsv(text) {
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors?.length) {
    console.warn(`CSV warnings: ${result.errors.length} (continuing with best-effort parse)`);
  }
  return result.data.map((row) => {
    const cleaned = {};
    for (const [k, v] of Object.entries(row)) {
      const s = typeof v === 'string' ? v.trim() : v;
      cleaned[k] = s === '' || s == null ? null : s;
    }
    return cleaned;
  });
}

async function loadEnv(envPath) {
  const text = await readFile(envPath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

async function main() {
  const [source, giornataId] = process.argv.slice(2);
  if (!source || !giornataId) {
    console.error('Usage: node scripts/import-csv-sezioni.mjs <csv-url-or-path> <giornata-id>');
    process.exit(2);
  }

  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(here, '..');
  const env = await loadEnv(resolve(root, '.env.server'));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.server');

  let csvText;
  if (source.startsWith('http')) {
    console.log(`Fetching CSV from ${source}`);
    const r = await fetch(source);
    csvText = await r.text();
  } else {
    csvText = await readFile(source, 'utf8');
  }

  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} rows`);

  const payload = rows.map((r) => ({
    giornata_id: giornataId,
    numero: r.sezione ? parseInt(r.sezione, 10) : null,
    indirizzo: r.indirizzo,
    ubicazione: r.ubicazione,
    lat: r.lat ? parseFloat(r.lat) : null,
    lng: r.long ? parseFloat(r.long) : null,
    circoscrizione: r.circoscrizione ? parseInt(r.circoscrizione, 10) : null,
    note: r.note,
    accessibilita: r.accessibilita,
  })).filter((p) => p.numero != null);

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/sezioni?on_conflict=giornata_id,numero`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Accept-Profile': 'elemanager',
      'Content-Profile': 'elemanager',
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  const inserted = JSON.parse(text);
  console.log(`Inserted/updated ${inserted.length} sezioni into giornata ${giornataId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
