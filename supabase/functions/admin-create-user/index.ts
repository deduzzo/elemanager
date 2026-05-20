// Edge Function: admin-create-user
// Crea un nuovo utente (auth + profilo) su richiesta di un admin autenticato.
//
// Flow:
//   1. Legge JWT del chiamante dall'header Authorization (Bearer ...)
//   2. Verifica che il chiamante sia un admin attivo (query public.profiles)
//   3. Crea l'utente in auth.users via admin API (email confermata)
//   4. Inserisce il profilo in public.profiles
//   5. In caso di errore al punto 4, rollback: elimina l'auth.user appena creato
//
// Secrets richiesti nell'ambiente della function:
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Body atteso (JSON): { email, password, nome, ruolo }
// Risposta success (200): { id, email }
// Errori: 400 / 401 / 403 / 409 / 500 con { error: string }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RUOLI_VALIDI = ['admin', 'editor', 'viewer'] as const;
type Ruolo = (typeof RUOLI_VALIDI)[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) {
    return json({ error: 'Server misconfigured: missing Supabase env vars' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  // Client con il JWT del chiamante per validare l'identità
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  // Client con service_role per verifica ruolo (bypass RLS) e mutazioni
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'elemanager' },
  });

  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('ruolo, attivo')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileErr) return json({ error: profileErr.message }, 500);
  if (!callerProfile || callerProfile.ruolo !== 'admin' || !callerProfile.attivo) {
    return json({ error: 'Forbidden: admin role required' }, 403);
  }

  let body: { email?: string; password?: string; nome?: string; ruolo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const nome = body.nome?.trim();
  const ruolo = body.ruolo as Ruolo | undefined;

  if (!email || !password || !nome || !ruolo) {
    return json({ error: 'Missing fields: email, password, nome, ruolo' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email format' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password too short (min 8 characters)' }, 400);
  }
  if (nome.length < 2) {
    return json({ error: 'Nome too short (min 2 characters)' }, 400);
  }
  if (!RUOLI_VALIDI.includes(ruolo)) {
    return json({ error: `Invalid ruolo: must be one of ${RUOLI_VALIDI.join(', ')}` }, 400);
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? 'Failed to create auth user';
    const status = /already (registered|exist)/i.test(msg) ? 409 : 500;
    return json({ error: msg }, status);
  }

  const { error: insertErr } = await admin
    .from('profiles')
    .insert({ id: created.user.id, nome, ruolo, attivo: true });

  if (insertErr) {
    // Rollback: rimuovi l'auth user appena creato per evitare orfani
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Profile insert failed: ${insertErr.message}` }, 500);
  }

  return json({ id: created.user.id, email });
});
