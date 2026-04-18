# Elemanager — Design Document

**Data**: 2026-04-18
**Autore**: Roberto De Domenico + Claude
**Status**: Draft in review

## Obiettivo

Web app mobile-first per raccolta **ufficiosa** dei risultati elettorali. Editor autorizzati inseriscono voti reali per sezione (coperture complete: tutte le liste e preferenze), admin inserisce voti presunti per candidato e compara con i reali. Primo test: elezioni comunali Messina 2026 (31 sezioni da CSV open data).

## Non-goal (fuori scope totale)

- Non sostituisce i canali ufficiali del Ministero/Comune.
- Non ha valore legale.
- Non è un sistema di voto online.
- Non fa OCR automatico delle foto pannelli.

## Stack tecnologico

| Layer | Scelta | Motivo |
|---|---|---|
| Frontend | React 18 + Vite + TailwindCSS | Preferenza utente (CLAUDE.md), futuristico dark/glassmorphism |
| Routing | React Router v6 | Standard de-facto |
| State | Zustand + TanStack Query | Leggero, no Redux boilerplate, cache server ottima |
| PWA | vite-plugin-pwa | Service worker + manifest zero-config |
| Backend | **Supabase self-hosted** (`supabase.robertodedomenico.it`) | Postgres vero, RLS, realtime, storage foto, OSS |
| Auth | Supabase Auth (email+password) | Integrato, gestione JWT automatica |
| Storage foto | Supabase Storage bucket `sezioni` | 1GB free, signed URL per lettura |
| Mappa | Leaflet + OpenStreetMap | OSS puri, no API key, no vendor lock |
| Geolocalizzazione | `navigator.geolocation` nativo | Zero dipendenze |
| Charts | Recharts | React-native, dark mode facile |
| Deploy frontend | GitHub Pages / Netlify / Cloudflare Pages | Tutti gratis, scelta finale a deploy |
| Testing | Vitest + Playwright | Unit + e2e |

## Roadmap incrementale

### Fase 1 — MVP core (questo documento)
Flusso minimo funzionante end-to-end: auth, import sezioni CSV, CRUD elezioni/liste/candidati (admin), inserimento voti reali per sezione (editor), dashboard letture (viewer), audit log base.

### Fase 2 — Foto e mappa
Upload foto pannelli per sezione, mappa Leaflet con marker sezioni, geolocalizzazione "sezioni vicine a me".

### Fase 3 — Voti presunti e confronto
CRUD voti_presunti (solo admin), dashboard confronto presunti vs reali con scostamenti per sezione/candidato.

### Fase 4 — Statistiche avanzate e proiezioni
Grafici per quartiere/circoscrizione, "sezioni mancanti", proiezione risultato finale via pesatura sezioni coperte, export CSV/PDF.

### Fase 5 — PWA offline e polish
Service worker offline-first, sync deferita, notifiche push (opzionale), refinement UX/UI.

---

# Fase 1 — Spec dettagliata

## User stories

**Admin**
- Voglio creare una giornata elettorale con sotto-elezioni, liste e candidati.
- Voglio importare il CSV delle sezioni di Messina in un click.
- Voglio creare utenti editor e viewer invitandoli via email.
- Voglio vedere, modificare o eliminare qualsiasi voto inserito.
- Voglio un audit log di ogni modifica per trasparenza.

**Editor**
- Voglio accedere da mobile e vedere solo le elezioni aperte.
- Voglio selezionare una sezione e inserire i totali voti per ogni lista + preferenze per ogni candidato.
- Voglio modificare solo i voti che ho inserito io (admin correggerà se serve).
- Voglio un'interfaccia di inserimento rapidissima (1-tap per aprire sezione, tastiera numerica nativa mobile).

**Viewer**
- Voglio vedere una dashboard con copertura sezioni (quante coperte / totali) e risultati aggregati in tempo reale.
- Non vedo né modifico voti presunti.

## Modello dati (Postgres)

```sql
-- Utenti e ruoli (profiles estende auth.users di Supabase)
profiles (
  id uuid PK REFERENCES auth.users(id),
  nome text NOT NULL,
  ruolo text NOT NULL CHECK (ruolo IN ('admin','editor','viewer')),
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Contenitore elezioni di una giornata
giornate_elettorali (
  id uuid PK,
  nome text NOT NULL,             -- "Comunali Messina 2026"
  data date NOT NULL,
  stato text DEFAULT 'draft'      -- draft | open | closed
    CHECK (stato IN ('draft','open','closed')),
  comune text,                     -- "Messina"
  created_at timestamptz DEFAULT now()
)

-- Sotto-elezioni dentro una giornata (sindaco, consiglio, circoscrizione, ...)
elezioni (
  id uuid PK,
  giornata_id uuid NOT NULL REFERENCES giornate_elettorali(id) ON DELETE CASCADE,
  nome text NOT NULL,              -- "Sindaco Messina", "Consiglio Comunale"
  tipo text NOT NULL,              -- sindaco | consiglio | circoscrizione | nazionale | referendum
  ordine int DEFAULT 0,            -- per ordinamento UI
  created_at timestamptz DEFAULT now()
)

-- Liste di una elezione
liste (
  id uuid PK,
  elezione_id uuid NOT NULL REFERENCES elezioni(id) ON DELETE CASCADE,
  nome text NOT NULL,
  simbolo_url text,                -- opzionale, visuale
  ordine int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Candidati (appartengono a una lista)
candidati (
  id uuid PK,
  lista_id uuid NOT NULL REFERENCES liste(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cognome text NOT NULL,
  ordine int DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
)

-- Sezioni elettorali (import da CSV Messina, condivise tra elezioni della stessa giornata)
sezioni (
  id uuid PK,
  giornata_id uuid NOT NULL REFERENCES giornate_elettorali(id) ON DELETE CASCADE,
  numero int NOT NULL,
  indirizzo text,
  ubicazione text,                 -- nome scuola
  lat numeric(9,6),
  lng numeric(9,6),
  circoscrizione int,              -- quartiere
  note text,
  accessibilita text,
  UNIQUE (giornata_id, numero)
)

-- Risultato globale sezione×elezione: totali scheda
risultati_sezione (
  id uuid PK,
  sezione_id uuid NOT NULL REFERENCES sezioni(id) ON DELETE CASCADE,
  elezione_id uuid NOT NULL REFERENCES elezioni(id) ON DELETE CASCADE,
  schede_totali int,
  schede_bianche int,
  schede_nulle int,
  schede_contestate int,
  stato text DEFAULT 'draft'       -- draft (parziale) | submitted | verified
    CHECK (stato IN ('draft','submitted','verified')),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sezione_id, elezione_id)
)

-- Voti per lista (totali lista in una sezione)
-- Vincolo applicativo: liste.elezione_id DEVE coincidere con risultati_sezione.elezione_id.
-- Enforcement: funzione check nel trigger di INSERT/UPDATE + validazione client.
voti_lista (
  id uuid PK,
  risultato_sezione_id uuid NOT NULL REFERENCES risultati_sezione(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES liste(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, lista_id)
)

-- Preferenze per singolo candidato in una sezione
-- Vincolo applicativo analogo: candidato deve appartenere a lista di elezione coerente.
preferenze_candidato (
  id uuid PK,
  risultato_sezione_id uuid NOT NULL REFERENCES risultati_sezione(id) ON DELETE CASCADE,
  candidato_id uuid NOT NULL REFERENCES candidati(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, candidato_id)
)

-- Audit log: traccia ogni INSERT/UPDATE/DELETE sulle tabelle sensibili
audit_log (
  id bigserial PK,
  actor_id uuid REFERENCES profiles(id),
  actor_email text,                -- denormalizzato (persistente se profilo eliminato)
  azione text NOT NULL,            -- INSERT | UPDATE | DELETE
  tabella text NOT NULL,
  record_id text,
  diff jsonb,                      -- { before: {...}, after: {...} }
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now()
)
```

Tabelle rimandate a Fase 2+: `foto_sezione`, `voti_presunti`.

## Row Level Security (Postgres RLS)

Helper function riusabile:
```sql
CREATE FUNCTION auth_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ruolo FROM profiles WHERE id = auth.uid() AND attivo
$$;
```

Policy principali:

**profiles**
- SELECT: autenticati (tutti vedono lista profili per mention/attribuzione)
- INSERT/UPDATE/DELETE: solo admin

**giornate_elettorali, elezioni, liste, candidati, sezioni**
- SELECT: tutti gli autenticati
- INSERT/UPDATE/DELETE: solo admin

**risultati_sezione, voti_lista, preferenze_candidato**
- SELECT: tutti gli autenticati
- INSERT: admin + editor (se `stato='open'` della giornata)
- UPDATE: admin sempre; editor solo se `created_by = auth.uid()` e stato ≠ 'verified'
- DELETE: solo admin

**audit_log**
- SELECT: solo admin
- INSERT: trigger (SECURITY DEFINER); nessun utente diretto
- UPDATE/DELETE: vietato a chiunque

Audit log implementato via trigger AFTER INSERT/UPDATE/DELETE sulle tabelle voti.

## Architettura frontend

```
src/
├── app/                    # bootstrap, router, providers
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx       # QueryClient, Supabase, AuthProvider
├── lib/
│   ├── supabase.ts         # client singleton
│   ├── auth.ts             # hook useAuth, useRole
│   └── queries/            # TanStack Query hooks per entità
├── components/
│   ├── ui/                 # button, input, card, modal (design system)
│   ├── layout/             # Shell mobile, BottomNav, TopBar
│   └── forms/              # InputNumber (tastiera mobile), ecc.
├── features/
│   ├── auth/               # Login, logout
│   ├── admin/
│   │   ├── users/          # CRUD profiles
│   │   ├── giornate/       # CRUD giornate + elezioni + liste + candidati
│   │   ├── sezioni/        # Import CSV
│   │   └── audit/          # Vista audit log
│   ├── editor/
│   │   └── inserimento/    # Flusso inserimento voti per sezione
│   └── dashboard/          # Copertura + aggregati (viewer)
├── pages/                  # route components (thin)
└── styles/
    └── index.css           # tailwind base + utility globali
```

Convenzione: ogni feature espone un `index.ts` che riesporta i componenti pubblici. Query hook co-locate in `src/lib/queries/*` per riuso cross-feature.

## Flusso UX editor (cuore MVP)

Target: inserire un risultato sezione in **< 60 secondi** su smartphone.

1. **Login** (email+password).
2. **Home editor** → lista giornate `stato=open` → tap apre lista sezioni.
3. **Lista sezioni**: ricerca per numero (tastiera numerica nativa), badge stato (⬜ vuota / 🟡 draft / 🟢 submitted). Ordinamento: prime quelle non ancora aperte, poi draft (mie in cima).
4. **Dettaglio sezione**: tab per ogni elezione della giornata (sindaco / consiglio / ...). Per ogni tab:
   - Header: schede totali, bianche, nulle, contestate (4 input numerici, grid 2×2).
   - Sezione "liste": una riga per lista con input voti totali lista.
   - Sezione "preferenze": espandibile per lista → elenco candidati della lista con input voti preferenza.
   - Validazione client-side: preferenze_lista ≤ voti_lista (warning, non blocca).
   - Pulsante "Salva bozza" (stato=draft) / "Invia" (stato=submitted).
5. Autosave locale (localStorage) ogni 5s su bozza, recupero su reload.

Componenti chiave: `InputNumber` con `inputmode="numeric"`, `pattern="[0-9]*"` per tastiera numerica nativa iOS/Android.

## Audit log — strategia

Trigger Postgres su `risultati_sezione`, `voti_lista`, `preferenze_candidato`:

```sql
CREATE FUNCTION trg_audit() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log(actor_id, actor_email, azione, tabella, record_id, diff)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN COALESCE(NEW, OLD);
END
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

IP/UA non catturati dal DB: aggiunti in Fase 2 via Edge Function se richiesto.

## Import CSV sezioni

Pagina admin: input file → parsing in-browser (`papaparse`) → preview tabella → conferma → batch `upsert` su `sezioni` con unique key `(giornata_id, numero)`. CSV Messina 2026 verificato: 31 righe, colonne `sezione, indirizzo, ubicazione, lat, long, circoscrizione, note, accessibilita`.

## Dashboard viewer (MVP)

Card KPI:
- Sezioni coperte / totali (% progress bar per elezione).
- Voti totali per lista (bar chart orizzontale Recharts).
- Top candidati per preferenze (top 10).
- Ultimo aggiornamento + chi.

Realtime: subscription Supabase su `risultati_sezione` per aggiornamento auto senza refresh.

## Testing

- **Unit (Vitest)**: validatori form, aggregati dashboard, helper client Supabase.
- **RLS**: test integrazione in Vitest usando un client Supabase con JWT dei tre ruoli (admin/editor/viewer) su DB di test dedicato — verifica che ogni policy consenta/neghi come atteso.
- **Integration**: CRUD end-to-end per ogni entità, audit log popolato correttamente.
- **E2E (Playwright)**: 3 happy path (admin crea giornata → editor inserisce voti → viewer vede dashboard).

Target coverage Fase 1: ≥70% sui moduli critici (auth, inserimento voti, audit).

## Sicurezza

- RLS attivo su tutte le tabelle applicative (default deny).
- JWT Supabase con refresh automatico.
- Input numerici validati sia client che DB (`CHECK voti >= 0`).
- Sanitizzazione testo (descrizioni, note) via React escape-by-default.
- HTTPS obbligatorio (enforced da hosting).
- Variabili `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` (mai committate).
- Rate limiting: delegato a Supabase (limit login 30/h built-in).

## Metriche di successo Fase 1

- Admin può configurare una giornata completa in < 15 minuti (sezioni via CSV, elezioni/liste/candidati manuale).
- Editor inserisce un risultato sezione in < 60 secondi su mobile.
- Dashboard viewer carica in < 2s su 4G.
- Audit log cattura 100% delle modifiche ai voti.

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| CSV Messina cambia schema | Medio | Wrapper parser con mapping configurabile; preview pre-import |
| Inserimento preferenze lento/errata | Alto | UX tab espandibili per lista, autosave draft, validazioni soft |
| Editor inserisce doppiamente stessa sezione | Alto | UNIQUE `(sezione_id, elezione_id)` + upsert pattern |
| Carico picco la sera del voto | Medio | Realtime Supabase con throttle client; niente polling aggressivo |
| Perdita connessione mobile in seggio | Alto | localStorage autosave → retry queue (Fase 5 offline completo) |

## Deliverable Fase 1

1. Repo inizializzato con Vite+React+TS+Tailwind + config PWA base.
2. Migrazioni SQL Supabase (schema + RLS + trigger audit) versionate in `supabase/migrations/`.
3. Seed script: 1 giornata demo + 1 elezione + 2 liste + 5 candidati + import CSV Messina.
4. UI admin: users, giornate/elezioni/liste/candidati, import sezioni, audit viewer.
5. UI editor: lista sezioni, form inserimento voti con autosave.
6. UI viewer: dashboard aggregata con realtime.
7. Test automatici (unit + 3 e2e happy path).
8. README con setup locale + deploy.

## Fuori scope Fase 1 (per chiarezza)

- Upload foto pannelli → Fase 2.
- Mappa Leaflet / geolocalizzazione → Fase 2.
- Voti presunti + confronto presunti vs reali → Fase 3.
- Proiezioni statistiche e charts avanzati → Fase 4.
- Offline completo con sync → Fase 5.
- Notifiche push → Fase 5.
- Export CSV/PDF → Fase 4.
- OCR automatico foto → non pianificato.
