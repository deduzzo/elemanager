import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Richiede env ADMIN_EMAIL/PASSWORD, EDITOR_EMAIL/PASSWORD, VIEWER_EMAIL/PASSWORD
// e SUPABASE_URL + ANON_KEY in .env.test. Se non impostate, test skippato.

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const admin = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const editor = { email: process.env.EDITOR_EMAIL, password: process.env.EDITOR_PASSWORD };
const viewer = { email: process.env.VIEWER_EMAIL, password: process.env.VIEWER_PASSWORD };

const shouldRun = URL && ANON && admin.email && editor.email && viewer.email;

async function signedClient(email: string, password: string) {
  const c = createClient(URL!, ANON!, { db: { schema: 'elemanager' } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

describe.skipIf(!shouldRun)('voti_presunti RLS', () => {
  let adminClient: Awaited<ReturnType<typeof signedClient>>;
  let editorClient: Awaited<ReturnType<typeof signedClient>>;
  let viewerClient: Awaited<ReturnType<typeof signedClient>>;

  beforeAll(async () => {
    adminClient = await signedClient(admin.email!, admin.password!);
    editorClient = await signedClient(editor.email!, editor.password!);
    viewerClient = await signedClient(viewer.email!, viewer.password!);
  });

  afterAll(async () => {
    await Promise.all([
      adminClient?.auth.signOut(),
      editorClient?.auth.signOut(),
      viewerClient?.auth.signOut(),
    ]);
  });

  it('admin sees rows', async () => {
    const { data, error } = await adminClient.from('voti_presunti').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('editor sees empty set', async () => {
    const { data, error } = await editorClient.from('voti_presunti').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('viewer sees empty set', async () => {
    const { data, error } = await viewerClient.from('voti_presunti').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('editor insert fails', async () => {
    const { error } = await editorClient
      .from('voti_presunti')
      .insert({ candidato_id: '00000000-0000-0000-0000-000000000000', sezione_id: null, voti: 1 });
    expect(error).not.toBeNull();
  });
});
