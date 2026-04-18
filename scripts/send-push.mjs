#!/usr/bin/env node
import webpush from 'web-push';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function loadEnv(envPath) {
  const text = await readFile(envPath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

async function main() {
  const [titleArg, bodyArg, urlArg, userEmailArg] = process.argv.slice(2);
  if (!titleArg) {
    console.error('Usage: node scripts/send-push.mjs <title> [body] [url] [filter-user-email]');
    process.exit(2);
  }
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(here, '..');
  const env = await loadEnv(resolve(root, '.env.server'));

  webpush.setVapidDetails(env.VAPID_CONTACT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  // Fetch all subscriptions (optionally filtered by user email)
  let filter = '';
  if (userEmailArg) {
    const r = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(userEmailArg)}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const j = await r.json();
    const u = (j.users ?? []).find((x) => x.email === userEmailArg);
    if (!u) throw new Error(`No user found for email ${userEmailArg}`);
    filter = `?user_id=eq.${encodeURIComponent(u.id)}`;
  }
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions${filter}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Accept-Profile': 'elemanager',
    },
  });
  const subs = await r.json();
  console.log(`Found ${subs.length} subscription(s)`);

  const payload = JSON.stringify({
    title: titleArg,
    body: bodyArg ?? '',
    url: urlArg ?? '/',
  });

  let sent = 0,
    failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      failed++;
      console.error(`Failed for ${s.endpoint.slice(0, 40)}:`, e.message);
    }
  }
  console.log(`Sent ${sent}, failed ${failed}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
