# Elemanager — Plan 01: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sbloccare lo sviluppo delle feature costruendo la base del progetto: scaffolding Vite/React/TS/Tailwind PWA, client Supabase, schema DB con RLS e audit log, flusso login, protected route per ruolo, shell mobile.

**Architecture:** Frontend SPA React con TanStack Query per cache server-side, Zustand per stato UI, Supabase client per auth+DB+realtime. Schema Postgres versionato in `supabase/migrations/`. Accesso DB sempre via client + JWT → RLS enforcement lato server.

**Tech Stack:** React 18, Vite 5, TypeScript 5, TailwindCSS 3, vite-plugin-pwa, Supabase JS v2, TanStack Query v5, React Router v6, Zustand, Vitest + Testing Library, Playwright.

**Spec di riferimento:** `docs/superpowers/specs/2026-04-18-elemanager-mvp-fase1-design.md`

**Istanza Supabase target:** `https://supabase.robertodedomenico.it/` (self-hosted utente)

---

## File Structure

```
elemanager/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
├── .env.local             # gitignorato
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── Providers.tsx
│   │   └── router.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── env.ts
│   ├── features/
│   │   └── auth/
│   │       ├── AuthProvider.tsx
│   │       ├── useAuth.ts
│   │       ├── useRole.ts
│   │       ├── LoginPage.tsx
│   │       └── ProtectedRoute.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── BottomNav.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Card.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   └── NotFoundPage.tsx
│   ├── styles/
│   │   └── index.css
│   └── test/
│       └── setup.ts
├── supabase/
│   └── migrations/
│       ├── 0001_init_schema.sql
│       ├── 0002_audit_log.sql
│       └── 0003_rls_policies.sql
└── tests/
    └── e2e/
        └── auth.spec.ts
```

Responsabilità chiave:
- `src/lib/supabase.ts` — client singleton, nessuna logica applicativa
- `src/features/auth/*` — tutto ciò che riguarda identità e ruolo
- `src/app/*` — bootstrap e routing (thin)
- `supabase/migrations/*.sql` — schema versionato, applicabile in ordine numerico

---

## Task 1: Inizializza progetto Vite + React + TypeScript

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/index.css`

- [ ] **Step 1: Scaffold con Vite**

```bash
npm create vite@latest . -- --template react-ts
```
Rispondi `y` per procedere nella cartella non vuota (rimuove eventuali template file scaffolded default).

- [ ] **Step 2: Installa dipendenze base**

```bash
npm install
npm install @supabase/supabase-js @tanstack/react-query react-router-dom zustand
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
npm install -D @playwright/test
```

- [ ] **Step 3: Init Tailwind**

```bash
npx tailwindcss init -p
```

Riscrivi `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          pink: '#f472b6',
        },
        bg: {
          deep: '#0a0f1e',
          panel: 'rgba(255,255,255,0.04)',
        },
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(135deg,#22d3ee 0%,#a78bfa 50%,#f472b6 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34,211,238,0.35)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Scrivi `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body {
    @apply bg-bg-deep text-slate-100 antialiased;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(34,211,238,0.08), transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(167,139,250,0.08), transparent 40%);
  }
}

@layer components {
  .glass {
    @apply bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl;
  }
  .glass-strong {
    @apply bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl;
  }
  .btn-neon {
    @apply px-4 py-2 rounded-xl font-medium transition-all duration-200
           bg-gradient-neon text-white shadow-glow-cyan
           hover:brightness-110 active:scale-[0.98] disabled:opacity-50;
  }
}
```

- [ ] **Step 5: Riscrivi `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Placeholder `src/app/App.tsx`**

```tsx
export function App() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong p-8 text-center">
        <h1 className="text-3xl font-bold bg-gradient-neon bg-clip-text text-transparent">
          Elemanager
        </h1>
        <p className="mt-2 text-slate-300">Foundation alive</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: `index.html` con meta viewport mobile**

Assicurati che `<head>` contenga:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0a0f1e" />
<title>Elemanager</title>
```

- [ ] **Step 8: Verifica build e dev**

```bash
npm run dev
```
Visita `http://localhost:5173`, conferma scheda con gradient "Elemanager / Foundation alive".

```bash
npm run build
```
Expected: build completa senza errori TS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffolding Vite+React+TS+Tailwind con tema neon"
```

---

## Task 2: Configura PWA e vite-plugin-pwa

**Files:**
- Modify: `vite.config.ts`
- Create: `public/favicon.svg`, `public/pwa-192.png`, `public/pwa-512.png`

- [ ] **Step 1: Placeholder icone**

Per MVP usa icone placeholder (sostituibili dopo). Crea `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="0.5" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="#0a0f1e"/>
  <text x="32" y="42" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
        font-weight="800" font-size="28" fill="url(#g)">E</text>
</svg>
```

Per `pwa-192.png` e `pwa-512.png`, genera placeholder (o lascia gestire in step successivo usando lo stesso SVG). Se l'engineer non ha ImageMagick, skip e usare solo favicon — plugin PWA emette warning ma build funziona.

```bash
# se disponibile:
which rsvg-convert && rsvg-convert -w 192 -h 192 public/favicon.svg -o public/pwa-192.png
which rsvg-convert && rsvg-convert -w 512 -h 512 public/favicon.svg -o public/pwa-512.png
```

- [ ] **Step 2: Configura `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Elemanager',
        short_name: 'Elemanager',
        description: 'Raccolta ufficiosa risultati elettorali',
        theme_color: '#0a0f1e',
        background_color: '#0a0f1e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

- [ ] **Step 3: Aggiorna `tsconfig.json` per alias**

Nella sezione `compilerOptions` aggiungi:

```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 4: `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

Aggiungi in `tsconfig.json` in `compilerOptions.types`: `["vitest/globals", "@testing-library/jest-dom"]`.

- [ ] **Step 5: Link manifest in `index.html`**

Aggiungi in `<head>`:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="manifest" href="/manifest.webmanifest" />
```

- [ ] **Step 6: Verifica build PWA**

```bash
npm run build && npm run preview
```
Apri DevTools → Application → Manifest → deve mostrare "Elemanager".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: PWA config con manifest e service worker autoUpdate"
```

---

## Task 3: Client Supabase + variabili ambiente

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase.ts`, `.env.example`
- Modify: `.gitignore` (già OK)

- [ ] **Step 1: `.env.example`**

```
VITE_SUPABASE_URL=https://supabase.robertodedomenico.it
VITE_SUPABASE_ANON_KEY=<anon-key-da-supabase-dashboard>
```

- [ ] **Step 2: `.env.local` (non committato, chiedi all'utente se serve la anon key reale)**

Stesso contenuto di `.env.example` con la chiave anon vera. L'admin la ottiene dalla dashboard Supabase self-hosted → Settings → API.

- [ ] **Step 3: `src/lib/env.ts`**

```ts
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Supabase env mancante. Copia .env.example in .env.local e compila VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  );
}

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anon,
} as const;
```

- [ ] **Step 4: `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import type { Database } from './database.types';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

- [ ] **Step 5: Tipi database placeholder**

Crea `src/lib/database.types.ts`:

```ts
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
```

Verrà rigenerato dopo le migrazioni con `supabase gen types typescript`.

- [ ] **Step 6: Verifica**

```bash
npm run dev
```
Apri console browser, nessun errore ambiente. Se l'env non c'è ancora, expected error con messaggio utile.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: client Supabase con validazione env"
```

---

## Task 4: Migrazione 0001 — schema base

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`

- [ ] **Step 1: Scrivi migrazione completa**

```sql
-- 0001_init_schema.sql
-- Schema base Elemanager: profili, giornate, elezioni, liste, candidati, sezioni, risultati.

-- Estensione UUID se non presente
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles: estende auth.users con ruolo applicativo
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ruolo text NOT NULL CHECK (ruolo IN ('admin','editor','viewer')),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Giornate elettorali (un contenitore per elezioni contemporanee)
CREATE TABLE IF NOT EXISTS public.giornate_elettorali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data date NOT NULL,
  stato text NOT NULL DEFAULT 'draft' CHECK (stato IN ('draft','open','closed')),
  comune text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Elezioni dentro una giornata
CREATE TABLE IF NOT EXISTS public.elezioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES public.giornate_elettorali(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sindaco','consiglio','circoscrizione','nazionale','referendum','altro')),
  ordine int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Liste di una elezione
CREATE TABLE IF NOT EXISTS public.liste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elezione_id uuid NOT NULL REFERENCES public.elezioni(id) ON DELETE CASCADE,
  nome text NOT NULL,
  simbolo_url text,
  ordine int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Candidati in una lista
CREATE TABLE IF NOT EXISTS public.candidati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid NOT NULL REFERENCES public.liste(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cognome text NOT NULL,
  ordine int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sezioni (dal CSV, condivise nella giornata)
CREATE TABLE IF NOT EXISTS public.sezioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES public.giornate_elettorali(id) ON DELETE CASCADE,
  numero int NOT NULL,
  indirizzo text,
  ubicazione text,
  lat numeric(9,6),
  lng numeric(9,6),
  circoscrizione int,
  note text,
  accessibilita text,
  UNIQUE (giornata_id, numero)
);
CREATE INDEX IF NOT EXISTS sezioni_giornata_idx ON public.sezioni(giornata_id);

-- Risultato sezione×elezione
CREATE TABLE IF NOT EXISTS public.risultati_sezione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sezione_id uuid NOT NULL REFERENCES public.sezioni(id) ON DELETE CASCADE,
  elezione_id uuid NOT NULL REFERENCES public.elezioni(id) ON DELETE CASCADE,
  schede_totali int CHECK (schede_totali IS NULL OR schede_totali >= 0),
  schede_bianche int CHECK (schede_bianche IS NULL OR schede_bianche >= 0),
  schede_nulle int CHECK (schede_nulle IS NULL OR schede_nulle >= 0),
  schede_contestate int CHECK (schede_contestate IS NULL OR schede_contestate >= 0),
  stato text NOT NULL DEFAULT 'draft' CHECK (stato IN ('draft','submitted','verified')),
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sezione_id, elezione_id)
);
CREATE INDEX IF NOT EXISTS risultati_sezione_sezione_idx ON public.risultati_sezione(sezione_id);
CREATE INDEX IF NOT EXISTS risultati_sezione_elezione_idx ON public.risultati_sezione(elezione_id);

-- Voti totali per lista
CREATE TABLE IF NOT EXISTS public.voti_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risultato_sezione_id uuid NOT NULL REFERENCES public.risultati_sezione(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES public.liste(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, lista_id)
);

-- Preferenze per candidato
CREATE TABLE IF NOT EXISTS public.preferenze_candidato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risultato_sezione_id uuid NOT NULL REFERENCES public.risultati_sezione(id) ON DELETE CASCADE,
  candidato_id uuid NOT NULL REFERENCES public.candidati(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, candidato_id)
);

-- Trigger updated_at su risultati_sezione
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_risultati_updated ON public.risultati_sezione;
CREATE TRIGGER trg_risultati_updated
  BEFORE UPDATE ON public.risultati_sezione
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Applica la migrazione**

Due opzioni:

**A)** Se l'utente ha Supabase CLI configurato contro la sua istanza remota:
```bash
supabase db push
```

**B)** Fallback manuale via SQL Editor della dashboard Supabase: copia/incolla il contenuto di `0001_init_schema.sql` e esegui.

- [ ] **Step 3: Verifica**

Dashboard Supabase → Table Editor: devono apparire 8 tabelle (profiles, giornate_elettorali, elezioni, liste, candidati, sezioni, risultati_sezione, voti_lista, preferenze_candidato = 9 in realtà).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init_schema.sql
git commit -m "feat(db): schema base elezioni + voti"
```

---

## Task 5: Migrazione 0002 — audit log + trigger

**Files:**
- Create: `supabase/migrations/0002_audit_log.sql`

- [ ] **Step 1: Scrivi migrazione**

```sql
-- 0002_audit_log.sql
-- Audit log e trigger su tabelle voti.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  actor_email text,
  azione text NOT NULL CHECK (azione IN ('INSERT','UPDATE','DELETE')),
  tabella text NOT NULL,
  record_id text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tabella_idx ON public.audit_log(tabella, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_email text;
  v_record_id text;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_record_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    NULL
  );

  IF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_email, azione, tabella, record_id, diff)
  VALUES (auth.uid(), v_email, TG_OP, TG_TABLE_NAME, v_record_id, v_diff);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

-- Applica trigger a tabelle voti
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['risultati_sezione','voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_audit()', t, t);
  END LOOP;
END
$$;
```

- [ ] **Step 2: Applica e verifica**

Stessa procedura Task 4. Dashboard → tabella `audit_log` deve esistere, e in `Database → Triggers` i 3 trigger `trg_audit_*`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_audit_log.sql
git commit -m "feat(db): audit log con trigger su tabelle voti"
```

---

## Task 6: Migrazione 0003 — RLS policies

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`

- [ ] **Step 1: Scrivi migrazione**

```sql
-- 0003_rls_policies.sql
-- Helper + RLS per ruoli admin/editor/viewer.

-- Helper: ruolo dell'utente corrente
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth AS $$
  SELECT ruolo FROM public.profiles WHERE id = auth.uid() AND attivo
$$;

-- Helper: is admin?
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth AS $$
  SELECT COALESCE(public.auth_role() = 'admin', false)
$$;

-- Helper: giornata aperta?
CREATE OR REPLACE FUNCTION public.giornata_is_open(p_giornata_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT stato = 'open' FROM public.giornate_elettorali WHERE id = p_giornata_id
$$;

-- Abilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giornate_elettorali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidati ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risultati_sezione ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voti_lista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferenze_candidato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- profiles: SELECT autenticati; CRUD solo admin
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS profiles_mutate ON public.profiles;
CREATE POLICY profiles_mutate ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Config tables (giornate, elezioni, liste, candidati, sezioni): SELECT tutti, CRUD admin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['giornate_elettorali','elezioni','liste','candidati','sezioni'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_mutate ON public.%I FOR ALL TO authenticated
       USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
  END LOOP;
END
$$;

-- risultati_sezione
DROP POLICY IF EXISTS risultati_select ON public.risultati_sezione;
CREATE POLICY risultati_select ON public.risultati_sezione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS risultati_insert ON public.risultati_sezione;
CREATE POLICY risultati_insert ON public.risultati_sezione
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND public.giornata_is_open((SELECT giornata_id FROM public.sezioni WHERE id = sezione_id))
    )
  );

DROP POLICY IF EXISTS risultati_update ON public.risultati_sezione;
CREATE POLICY risultati_update ON public.risultati_sezione
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  )
  WITH CHECK (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  );

DROP POLICY IF EXISTS risultati_delete ON public.risultati_sezione;
CREATE POLICY risultati_delete ON public.risultati_sezione
  FOR DELETE TO authenticated USING (public.is_admin());

-- voti_lista e preferenze_candidato: stesso pattern via giunzione con risultato
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_mutate ON public.%I FOR ALL TO authenticated
       USING (
         public.is_admin() OR EXISTS (
           SELECT 1 FROM public.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND public.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )
       WITH CHECK (
         public.is_admin() OR EXISTS (
           SELECT 1 FROM public.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND public.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )', t, t, t, t);
  END LOOP;
END
$$;

-- audit_log: SELECT solo admin, no mutate lato utente (trigger usa SECURITY DEFINER bypass)
DROP POLICY IF EXISTS audit_select ON public.audit_log;
CREATE POLICY audit_select ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
```

- [ ] **Step 2: Applica e verifica**

Dashboard → Authentication → Policies: per ogni tabella devono apparire le policy attese. In `SQL Editor` esegui:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

Expected: lista completa di policy per ogni tabella.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_rls_policies.sql
git commit -m "feat(db): RLS policy admin/editor/viewer"
```

---

## Task 7: Rigenera tipi Database TypeScript

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Genera tipi**

Se l'utente ha Supabase CLI con accesso all'istanza:

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > src/lib/database.types.ts
```

Per self-hosted senza project-id, alternativa via linked DB URL:

```bash
npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/database.types.ts
```

Dove `SUPABASE_DB_URL` è la connection string Postgres dell'istanza (presa dalla dashboard → Settings → Database).

- [ ] **Step 2: Fallback se CLI non disponibile**

Scrivi manualmente i tipi minimi necessari (solo le righe/insert/update per le tabelle che useremo in Plan 01):

```ts
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string; ruolo: 'admin'|'editor'|'viewer'; attivo: boolean; created_at: string };
        Insert: { id: string; nome: string; ruolo: 'admin'|'editor'|'viewer'; attivo?: boolean };
        Update: Partial<{ nome: string; ruolo: 'admin'|'editor'|'viewer'; attivo: boolean }>;
      };
    };
    Views: Record<string, never>;
    Functions: { auth_role: { Args: Record<string, never>; Returns: string } };
    Enums: Record<string, never>;
  };
};
```

I plan successivi estenderanno questo file quando le feature relative verranno implementate.

- [ ] **Step 3: Verifica TS**

```bash
npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat: tipi Database TypeScript da schema Supabase"
```

---

## Task 8: AuthProvider + hook useAuth

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/useAuth.ts`, `src/features/auth/useRole.ts`
- Test: `src/features/auth/useAuth.test.tsx`

- [ ] **Step 1: Scrivi test failing**

```tsx
// src/features/auth/useAuth.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('useAuth', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('parte con loading true e poi session null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verifica fallisce**

```bash
npx vitest run src/features/auth/useAuth.test.tsx
```
Expected: fail (AuthProvider/useAuth non esistono).

- [ ] **Step 3: Implementa AuthProvider**

```tsx
// src/features/auth/AuthProvider.tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: Implementa hook**

```ts
// src/features/auth/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
```

- [ ] **Step 5: useRole (derivato dal DB profiles)**

```ts
// src/features/auth/useRole.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export type Ruolo = 'admin' | 'editor' | 'viewer';

export function useRole() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id && !loading,
    queryFn: async (): Promise<{ ruolo: Ruolo; nome: string } | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('ruolo, nome, attivo')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.attivo) return null;
      return { ruolo: data.ruolo as Ruolo, nome: data.nome };
    },
  });
}
```

- [ ] **Step 6: Run test, verifica passa**

```bash
npx vitest run src/features/auth/useAuth.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): AuthProvider + hook useAuth/useRole"
```

---

## Task 9: Providers globale (QueryClient + Router + Auth)

**Files:**
- Create: `src/app/Providers.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Scrivi `Providers.tsx`**

```tsx
// src/app/Providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  }));

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Aggiorna `App.tsx`**

```tsx
// src/app/App.tsx
import { Providers } from './Providers';
import { AppRouter } from './router';

export function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(app): Providers globali con QueryClient e Router"
```

---

## Task 10: Router + ProtectedRoute

**Files:**
- Create: `src/app/router.tsx`, `src/features/auth/ProtectedRoute.tsx`, `src/pages/HomePage.tsx`, `src/pages/NotFoundPage.tsx`

- [ ] **Step 1: ProtectedRoute**

```tsx
// src/features/auth/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useRole, type Ruolo } from './useRole';

type Props = {
  children: ReactNode;
  allow?: Ruolo[];
};

export function ProtectedRoute({ children, allow }: Props) {
  const { session, loading } = useAuth();
  const { data: profile, isLoading: roleLoading } = useRole();
  const location = useLocation();

  if (loading || roleLoading) {
    return <div className="p-6 text-slate-400">Caricamento…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile) {
    return (
      <div className="p-6 glass m-6">
        Il tuo profilo non è attivo o non configurato. Contatta l'admin.
      </div>
    );
  }

  if (allow && !allow.includes(profile.ruolo)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Pagine placeholder**

```tsx
// src/pages/HomePage.tsx
import { useRole } from '@/features/auth/useRole';

export function HomePage() {
  const { data: profile } = useRole();
  return (
    <div className="glass-strong p-6">
      <h2 className="text-xl font-semibold">
        Ciao {profile?.nome ?? '...'}
      </h2>
      <p className="text-slate-300 mt-2">Ruolo: <span className="text-neon-cyan">{profile?.ruolo}</span></p>
      <p className="text-slate-400 mt-4 text-sm">
        Le sezioni admin / editor / viewer saranno aggiunte nei plan successivi.
      </p>
    </div>
  );
}

// src/pages/NotFoundPage.tsx
export function NotFoundPage() {
  return <div className="glass p-6">404 — pagina non trovata</div>;
}
```

- [ ] **Step 3: Router**

```tsx
// src/app/router.tsx
import { Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 4: Commit (dopo LoginPage + AppShell dei prossimi task)**

Temporaneamente il codice non compila finché LoginPage e AppShell non esistono. Procedi con Task 11 e 12 e committa dopo.

---

## Task 11: LoginPage

**Files:**
- Create: `src/features/auth/LoginPage.tsx`
- Test: `src/features/auth/LoginPage.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/features/auth/LoginPage.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

const signInMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => signInMock(args),
    },
  },
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => { signInMock.mockReset(); });

  it('chiama signInWithPassword con email e password', async () => {
    signInMock.mockResolvedValue({ error: null });
    renderPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.it');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /entra/i }));
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.it', password: 'secret' });
  });

  it('mostra messaggio di errore se login fallisce', async () => {
    signInMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'x@y.it');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /entra/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/credenziali/i);
  });
});
```

Run per verificare fail: `npx vitest run src/features/auth/LoginPage.test.tsx`.

- [ ] **Step 2: Implementa `LoginPage`**

```tsx
// src/features/auth/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(/invalid/i.test(error.message) ? 'Credenziali non valide.' : error.message);
      return;
    }
    const target = location.state?.from?.pathname ?? '/';
    navigate(target, { replace: true });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass-strong p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold bg-gradient-neon bg-clip-text text-transparent">
          Accedi a Elemanager
        </h1>

        <label className="block text-sm">
          <span className="text-slate-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2
                       focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-300">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2
                       focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
          />
        </label>

        {error && (
          <div role="alert" className="text-sm text-neon-pink bg-neon-pink/10 rounded-lg p-2 border border-neon-pink/20">
            {error}
          </div>
        )}

        <button type="submit" className="btn-neon w-full" disabled={loading}>
          {loading ? 'Accesso…' : 'Entra'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Run test**

```bash
npx vitest run src/features/auth/LoginPage.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit (dopo AppShell — Task 12)**

---

## Task 12: AppShell mobile (TopBar + BottomNav)

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: TopBar**

```tsx
// src/components/layout/TopBar.tsx
import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';

export function TopBar() {
  const { signOut } = useAuth();
  const { data: profile } = useRole();

  return (
    <header className="sticky top-0 z-20 glass border-b border-white/10 px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Elemanager</div>
        <div className="text-sm text-slate-200">{profile?.nome ?? '...'} · <span className="text-neon-cyan">{profile?.ruolo}</span></div>
      </div>
      <button onClick={() => void signOut()} className="text-sm text-slate-300 hover:text-neon-pink">
        Esci
      </button>
    </header>
  );
}
```

- [ ] **Step 2: BottomNav**

```tsx
// src/components/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom';
import { useRole } from '@/features/auth/useRole';

type Item = { to: string; label: string; roles?: Array<'admin'|'editor'|'viewer'> };

const items: Item[] = [
  { to: '/', label: 'Home' },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
  { to: '/editor', label: 'Editor', roles: ['admin','editor'] },
  { to: '/dashboard', label: 'Dashboard' },
];

export function BottomNav() {
  const { data: profile } = useRole();
  const visible = items.filter(i => !i.roles || (profile && i.roles.includes(profile.ruolo)));

  return (
    <nav className="sticky bottom-0 z-20 glass border-t border-white/10 grid" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))` }}>
      {visible.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) =>
            `text-center py-3 text-sm ${isActive ? 'text-neon-cyan' : 'text-slate-300'}`
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: AppShell**

```tsx
// src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Verifica full stack funziona**

```bash
npm run dev
```
- Visita `/` senza login → redirect a `/login`.
- Prova login con account admin esistente su Supabase (creato manualmente dalla dashboard).
- Dopo login → vedi Home con nome, ruolo, TopBar e BottomNav.

- [ ] **Step 5: Run tutti i test**

```bash
npx vitest run
```
Expected: tutti verdi.

- [ ] **Step 6: Commit finale dei Task 10-12**

```bash
git add -A
git commit -m "feat(ui): LoginPage, ProtectedRoute, AppShell mobile con TopBar/BottomNav"
```

---

## Task 13: Seed script per ambiente dev

**Files:**
- Create: `supabase/seed.sql`, `scripts/create_admin.sql`
- Modify: `README.md` (sezione setup)

- [ ] **Step 1: `supabase/seed.sql`**

```sql
-- Seed dev: 1 giornata in stato 'draft' per Messina 2026.
-- Per un admin di test, esegui ANCHE scripts/create_admin.sql dopo aver creato un utente in auth.
INSERT INTO public.giornate_elettorali (nome, data, comune, stato)
VALUES ('Comunali Messina 2026 — demo', '2026-05-25', 'Messina', 'draft')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: `scripts/create_admin.sql`**

```sql
-- Da eseguire nel SQL Editor Supabase DOPO aver creato manualmente un utente via dashboard (Authentication → Users → Invite).
-- Sostituisci <UUID> con l'id dell'utente creato.
INSERT INTO public.profiles (id, nome, ruolo)
VALUES ('<UUID>', 'Admin Roberto', 'admin')
ON CONFLICT (id) DO UPDATE SET ruolo = EXCLUDED.ruolo, attivo = true;
```

- [ ] **Step 3: Aggiorna README con istruzioni setup**

Aggiungi in `README.md` dopo la sezione Stack:

```md
## Setup locale

1. `cp .env.example .env.local` e compila con URL e anon key della tua istanza Supabase.
2. `npm install`
3. Applica migrazioni: `supabase db push` (o esegui manualmente i file `supabase/migrations/*.sql` via SQL Editor).
4. Crea un utente in Authentication → Users → Invite user (indirizzo email tuo).
5. In SQL Editor, esegui `scripts/create_admin.sql` sostituendo l'UUID con quello dell'utente appena creato.
6. `npm run dev` e visita http://localhost:5173
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: seed dev + istruzioni setup admin in README"
```

---

## Task 14: E2E smoke test auth

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Config Playwright**

```bash
npx playwright install --with-deps chromium
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Test smoke**

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('redirect a /login quando non autenticati', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /accedi a elemanager/i })).toBeVisible();
});

test('form login mostra errore su credenziali sbagliate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('nonexistent@example.it');
  await page.getByLabel(/password/i).fill('wrong');
  await page.getByRole('button', { name: /entra/i }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 3: Aggiungi script in package.json**

```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 4: Run**

```bash
npm run test:run
npm run test:e2e
```
Expected: tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: e2e smoke auth con Playwright"
```

---

## Task 15: Verifica finale Plan 01

- [ ] **Step 1: Checklist funzionale**

- [ ] `npm run dev` avvia senza errori
- [ ] Redirect anonimo → `/login`
- [ ] Login con admin seed funziona, mostra nome e ruolo in TopBar
- [ ] BottomNav mostra le voci coerenti col ruolo (admin vede Admin+Editor+Home+Dashboard; editor vede Editor+Home+Dashboard; viewer solo Home+Dashboard)
- [ ] Signout riporta a `/login`
- [ ] `npm run test:run` tutti verdi
- [ ] `npm run test:e2e` tutti verdi
- [ ] `npm run build` completa senza errori

- [ ] **Step 2: Checklist DB**

Dashboard Supabase SQL Editor:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: audit_log, candidati, elezioni, giornate_elettorali, liste,
--           preferenze_candidato, profiles, risultati_sezione, sezioni, voti_lista

SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: >= 14 policy

SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_audit%';
-- Expected: trg_audit_risultati_sezione, trg_audit_voti_lista, trg_audit_preferenze_candidato
```

- [ ] **Step 3: Commit finale del plan**

```bash
git tag plan-01-foundation-complete
git log --oneline
```

Plan 01 completato. Il Plan 02 (Admin CRUD) partirà da qui.

---

## Self-review checklist

**Spec coverage:**
- ✅ Stack setup (Task 1-3)
- ✅ Schema DB (Task 4)
- ✅ Audit log (Task 5)
- ✅ RLS policy 3 ruoli (Task 6)
- ✅ Tipi TS (Task 7)
- ✅ Auth (Task 8, 11)
- ✅ Ruolo protection (Task 10)
- ✅ App shell mobile (Task 12)
- ✅ Seed/setup doc (Task 13)
- ✅ E2E smoke (Task 14)
- ✅ Verifica finale (Task 15)

**Fuori da Plan 01 (coperti in plan successivi):**
- Plan 02: CRUD admin users/giornate/elezioni/liste/candidati + import CSV + audit viewer
- Plan 03: Editor form inserimento voti mobile + autosave
- Plan 04: Viewer dashboard + realtime
- Plan 05: Deploy + docs utente finali

**Placeholder/TBD:** nessuno nel Plan 01.

**Type consistency:** `Ruolo` type esportato da `useRole.ts` e usato in `ProtectedRoute` e `BottomNav`. Nomi tabelle e colonne coerenti tra migration e TypeScript.
