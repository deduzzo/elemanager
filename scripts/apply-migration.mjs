#!/usr/bin/env node
// Apply a SQL migration file to the self-hosted Supabase instance via the pg-meta endpoint.
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.server (never logged, never in argv).
// Usage:
//   node scripts/apply-migration.mjs supabase/migrations/0001_init_schema.sql
//   node scripts/apply-migration.mjs supabase/migrations/         # applies all .sql files in order

import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function runSql({ url, serviceKey, sql, label }) {
  const endpoint = `${url.replace(/\/$/, '')}/pg/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${label}] HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function collectFiles(target) {
  const st = await stat(target);
  if (st.isDirectory()) {
    const entries = (await readdir(target)).filter((f) => extname(f) === '.sql').sort();
    return entries.map((e) => resolve(target, e));
  }
  return [resolve(target)];
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/apply-migration.mjs <file-or-dir>');
    process.exit(2);
  }

  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(here, '..');
  const envPath = resolve(root, '.env.server');
  const env = await loadEnv(envPath);
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.server');
    process.exit(2);
  }

  const files = await collectFiles(resolve(root, arg));
  for (const file of files) {
    const sql = await readFile(file, 'utf8');
    const label = basename(file);
    process.stdout.write(`Applying ${label}... `);
    try {
      await runSql({ url, serviceKey, sql, label });
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      console.error(err.message);
      process.exit(1);
    }
  }
  console.log(`Done. Applied ${files.length} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
