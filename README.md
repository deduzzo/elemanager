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
4. **Bootstrap primo admin** (una tantum):
   - Crea un utente in Supabase Studio → Authentication → Users → Add user (email + password).
   - Nel SQL Editor, esegui `scripts/create_admin.sql` sostituendo l'UUID con quello dell'utente appena creato.
5. Deploya la Edge Function `admin-create-user` (vedi sezione dedicata sotto). Senza questa, l'admin non potrà creare ulteriori utenti dall'app.
6. (Opzionale) Applica il seed demo: `supabase/seed.sql` via SQL Editor.
7. `npm run dev` e visita http://localhost:5173

## Gestione utenti dall'app

Una volta che esiste **almeno un admin**, gli admin successivi (e gli editor/viewer) si creano direttamente da `/admin/utenti` → **+ Nuovo utente**: email + password + ruolo. Il backend è una Edge Function `admin-create-user` che verifica server-side il JWT del chiamante (deve avere `ruolo='admin'` e `attivo=true`), crea l'utente in `auth.users` con email confermata, inserisce il profilo in `public.profiles` in modo atomico (rollback dell'auth user se l'insert del profilo fallisce).

### Deploy Edge Function su Supabase self-hosted

Sorgente: `supabase/functions/admin-create-user/index.ts`.

Secrets richiesti dall'ambiente della funzione (di solito già presenti su un Supabase self-hosted):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Metodi di deploy:

**A) Via Supabase CLI (preferito se la CLI è configurata sul self-hosted)**
```bash
supabase functions deploy admin-create-user --no-verify-jwt
```
Il flag `--no-verify-jwt` è necessario: la funzione verifica il JWT a livello applicativo (controllando il ruolo `admin`), non a livello di gateway.

**B) Via Docker (copia diretta nel volume montato)**
1. Copia `supabase/functions/admin-create-user/index.ts` nel server, dentro la cartella `volumes/functions/admin-create-user/` del compose di Supabase.
2. Restart del container edge-runtime: `docker compose restart functions` (o nome equivalente del servizio).

**C) Via Studio UI** (se abilitata l'interfaccia Edge Functions): crea una nuova function `admin-create-user`, incolla il contenuto del file e salva.

Verifica rapida del deploy:
```bash
curl -i -X POST https://<tuo-supabase>/functions/v1/admin-create-user \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass1234","nome":"Test","ruolo":"editor"}'
```
Risposte attese: `200 { id, email }` su successo; `401`/`403` se il token non è di un admin attivo.

## Fase 3 — Voti presunti + Confronto (admin-only)

- Admin inserisce stime voti per candidato: totale globale + stime per-sezione opzionali.
- Due viste di inserimento simmetriche (per candidato / per sezione) con autosave on blur.
- Dashboard `/admin/confronto` con scostamenti live (reale vs presunto) a due tab.
- Tutte le stime sono RLS admin-only: editor/viewer non vedono nulla.
- Migration: `supabase/migrations/0010_voti_presunti.sql`.

## Fase 4 — Proiezioni statistiche (admin-only)

- Pagina `/admin/proiezioni` con stima del risultato finale pesata per circoscrizione.
- 6 widget: KPI copertura, bar chart liste con bande di confidenza, top candidati per preferenze proiettate, sezioni mancanti raggruppate per circoscrizione, matrice circoscrizione × lista, export CSV per liste/candidati/sezioni mancanti.
- Algoritmo: per ogni circoscrizione la proiezione = voti × (totale/coperta); fallback alla media globale per circoscrizioni senza copertura.
- Realtime: si aggiorna live quando un editor chiude una sezione.
- Pure functions in `src/features/admin/proiezioni/proiezioni.ts` con 14+ unit test.

## Stato

✅ Fasi 1–4 completate. Deploy live su GitHub Pages: https://deduzzo.github.io/elemanager/

Roadmap: Fase 5 (offline-first + polish UX).

Vedi [docs/superpowers/specs/](docs/superpowers/specs/) per design e roadmap.

## Deploy frontend

Il push su `main` triggera `.github/workflows/deploy.yml` che builda e pubblica su GitHub Pages all'URL sopra. Secrets richiesti nel repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Il build usa `VITE_BASE_PATH=/elemanager/` (project site sotto-path).

## Licenza

TBD (verosimilmente AGPL o MIT).
