# Elemanager

Web app PWA mobile-first per la raccolta **ufficiosa** dei risultati elettorali, con gestione voti reali per sezione, confronto voti presunti vs reali, mappa, foto pannelli e proiezioni.

**Primo deploy target**: elezioni comunali Messina 2026 (31 sezioni da open data).

## Stack

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (design dark/futuristico, glassmorphism) + PWA
- **Backend**: Supabase self-hosted (Postgres + Auth + Storage + Realtime)
- **Mappa**: Leaflet + OpenStreetMap
- **Charts**: Recharts
- **Testing**: Vitest + Playwright

## Ruoli

- **Admin** — configura elezioni, invita utenti, CRUD totale, audit log
- **Editor** — inserisce voti reali per sezione (modifica solo i propri, admin sovrascrive)
- **Viewer** — dashboard aggregati, niente voti presunti

## Setup locale

1. `cp .env.example .env.local` e compila `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` con i valori della tua istanza Supabase self-hosted.
2. `npm install`
3. Applica le migrazioni al database:
   - **Automatico** (se hai `.env.server` con `SUPABASE_SERVICE_ROLE_KEY`): `node scripts/apply-migration.mjs supabase/migrations/`
   - **Manuale**: copia/incolla i file `supabase/migrations/000*.sql` nel SQL Editor di Supabase Studio in ordine.
4. Crea un utente in Supabase Studio → Authentication → Users → Add user (email + password).
5. Nel SQL Editor, esegui `scripts/create_admin.sql` sostituendo l'UUID con quello dell'utente appena creato.
6. (Opzionale) Applica il seed demo: `supabase/seed.sql` via SQL Editor.
7. `npm run dev` e visita http://localhost:5173

## Fase 3 — Voti presunti + Confronto (admin-only)

- Admin inserisce stime voti per candidato: totale globale + stime per-sezione opzionali.
- Due viste di inserimento simmetriche (per candidato / per sezione) con autosave on blur.
- Dashboard `/admin/confronto` con scostamenti live (reale vs presunto) a due tab.
- Tutte le stime sono RLS admin-only: editor/viewer non vedono nulla.
- Migration: `supabase/migrations/0010_voti_presunti.sql`.

## Stato

🚧 Fase 1 (MVP core) — in sviluppo.

Vedi [docs/superpowers/specs/](docs/superpowers/specs/) per design e roadmap.

## Licenza

TBD (verosimilmente AGPL o MIT).
