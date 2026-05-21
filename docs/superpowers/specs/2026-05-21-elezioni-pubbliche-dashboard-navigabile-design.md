# Elezioni pubbliche + dashboard navigabile — Design

## Contesto e motivazione

Oggi Elemanager è interamente dietro login. Tutto il sito (inclusa la home
`/`) richiede una sessione. Si vuole:

1. Permettere a un admin di marcare singole elezioni come "pubbliche"
   (sola lettura, senza login).
2. Esporre alla home `/` (visitatore anonimo) un elenco di card delle elezioni
   pubbliche; click su una card → dashboard di quella elezione in sola lettura.
3. Rendere la dashboard navigabile: ogni card aggregata diventa cliccabile per
   aprire un dettaglio (drill-down). Esempio: copertura → tabella sezioni con
   stato e totali; voti per lista → tabella liste; top candidati → tutti i
   candidati con dettaglio per sezione.
4. Nella dashboard pubblica mostrare anche la **copertura live** (% inviate,
   feed live posts) per dare un colpo d'occhio in tempo reale.
5. Sulla home pubblica, in alto a destra, pulsante **Accedi** che porta al
   login esistente (la home autenticata attuale si sposta su `/app`).

## Scope

### In scope

- Schema: flag `pubblica` su `elezioni`.
- Migration RLS: policy `SELECT TO anon` su tutte le tabelle necessarie a
  popolare la dashboard pubblica, filtrate dall'esistenza di un'elezione
  pubblica corrispondente.
- Routing: la home pubblica `/`, login `/login`, dashboard pubblica
  `/pubblico/elezioni/:elezioneId`. Tutte le rotte autenticate attuali si
  spostano sotto `/app/*`. Redirect 301 lato client dalle vecchie rotte
  (`/admin`, `/dashboard`, `/editor`, `/live`) verso `/app/...`.
- Pagine nuove:
  - `HomePublicPage` (lista card elezioni pubbliche + pulsante Accedi)
  - `DashboardPublicaPage` (variant senza filtri, già scoped a un'elezione)
- Componente esistente `DashboardPage`: viene reso "navigabile" — le card
  KPI/Voti/Top/Copertura aprono modali di drill-down.
- Toggle admin "Pubblica" su `ElezioneSection`.
- Voti presunti, audit_log, foto restano privati (non pubblicati).

### Out of scope

- Esposizione pubblica delle foto della sezione (le foto contengono pannelli
  fotografati: lasciare privati per ora).
- Moderazione/throttling sui post live (resta come oggi).
- Mappe pubbliche delle sezioni.
- Flag a livello di giornata. La granularità è solo per elezione.
- Localizzazione i18n; tutto in italiano.

## Modello dati

### Migration `0012_elezione_pubblica.sql`

```sql
ALTER TABLE elemanager.elezioni
  ADD COLUMN IF NOT EXISTS pubblica boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS elezioni_pubblica_idx
  ON elemanager.elezioni (pubblica) WHERE pubblica;
```

Una funzione helper di supporto per le policy:

```sql
CREATE OR REPLACE FUNCTION elemanager.elezione_is_public(p_elezione_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = elemanager AS $$
  SELECT COALESCE(pubblica, false) FROM elemanager.elezioni WHERE id = p_elezione_id
$$;

CREATE OR REPLACE FUNCTION elemanager.giornata_has_public(p_giornata_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = elemanager AS $$
  SELECT EXISTS (
    SELECT 1 FROM elemanager.elezioni
     WHERE giornata_id = p_giornata_id AND pubblica
  )
$$;
```

### Migration RLS `0013_rls_pubblica_anon.sql`

Aggiunge policy `FOR SELECT TO anon` accanto a quelle esistenti `TO authenticated`
(restano per gli utenti loggati). Le policy `anon` filtrano per appartenenza a
un'elezione pubblica:

| Tabella                  | Filtro `TO anon`                                                 |
|--------------------------|------------------------------------------------------------------|
| `elezioni`               | `pubblica = true`                                                |
| `giornate_elettorali`    | `elemanager.giornata_has_public(id)`                             |
| `liste`                  | `elemanager.elezione_is_public(elezione_id)`                     |
| `candidati`              | EXISTS lista → elezione pubblica                                 |
| `sezioni`                | `elemanager.giornata_has_public(giornata_id)`                    |
| `risultati_sezione`      | `elemanager.elezione_is_public(elezione_id)`                     |
| `voti_lista`             | EXISTS risultato_sezione → elezione pubblica                     |
| `preferenze_candidato`   | EXISTS risultato_sezione → elezione pubblica                     |
| `live_post`              | `elemanager.giornata_has_public(giornata_id)`                    |

NB: la policy `live_post_select_anon` rende il feed live visibile pubblicamente
per le giornate con almeno un'elezione pubblica. INSERT/UPDATE/DELETE restano
authenticated come oggi.

`foto_sezione`, `voti_presunti`, `audit_log`, `profiles`, `push_subscriptions`,
`live_typing` non hanno policy `anon` — restano privati.

Tutte le funzioni `is_admin()`, `auth_role()` non sono coinvolte: la
discriminazione anon/authenticated è già fatta dal `TO` della policy.

## Routing

### Mapping nuovo

```
/                                  HomePublicPage           (public)
/login                             LoginPage                (public)
/pubblico/elezioni/:elezioneId     DashboardPublicaPage     (public)
/app                               ProtectedRoute > AppShell
  /app                             HomePage (privata)
  /app/admin/*                     come oggi (admin-only)
  /app/editor/*                    come oggi (editor+)
  /app/dashboard                   DashboardPage navigabile
  /app/live                        LivePage
```

### Redirect compat

Per i bookmark esistenti, il router include redirect 301 client-side:
- `/admin*` → `/app/admin*`
- `/editor*` → `/app/editor*`
- `/dashboard` → `/app/dashboard`
- `/live` → `/app/live`

Dopo il login, se l'utente arriva da una destinazione protetta `from` (state
attuale di `ProtectedRoute`), redirect lì come oggi. Default post-login: `/app`.

### Client Supabase per route pubbliche

Le route pubbliche non richiedono `ProtectedRoute`. Il client `supabase` esiste
già con anon key e funziona senza sessione — nessuna modifica al client. Le
RLS `TO anon` sono il gate effettivo.

## Componenti

### `HomePublicPage` (nuovo) — `src/pages/HomePublicPage.tsx`

Layout: header sticky con logo + "Accedi" (link a `/login`). Body:

- Hero compatto: titolo "Elemanager", payoff breve.
- Sezione "Elezioni in diretta": griglia responsive di `ElezionePubblicaCard`.

`ElezionePubblicaCard` mostra: nome elezione, comune della giornata, data, badge
stato giornata, indicatore copertura `n/totale (x%)`. Click → naviga a
`/pubblico/elezioni/:id`.

Lo stato "loggato/non loggato" viene rilevato via `useAuth()`. Se loggato e
attivo, sopra la lista appare banner:

> _"Sei autenticato come {nome}. Vai al pannello →"_ (link `/app`)

Empty state: se nessuna elezione pubblica, messaggio _"Nessuna elezione in
diretta al momento."_

### `DashboardPublicaPage` (nuovo) — `src/pages/DashboardPublicaPage.tsx`

Wrapper che riceve `elezioneId` da URL e renderizza la `DashboardCore` con
flag `mode='public'`. Header: nome elezione + giornata, link "← Torna
all'elenco" → `/`.

Componente interno `DashboardCore` (refactor minimo da `DashboardPage`): accetta
`{ giornataId, elezioneId, mode: 'auth'|'public' }`. In `mode='public'`:

- Niente filtri (giornata/elezione fissati da prop).
- Mostra le stesse card aggregate (KPI, voti lista, top candidati, copertura,
  proiezione) **tutte navigabili** (drill-down come la versione auth).
- Aggiunge in fondo una sezione **Feed live** (componente `LiveFeed` esistente,
  read-only — niente composer per anon).

### `DashboardPage` refactor — `src/features/dashboard/DashboardPage.tsx`

Diventa un thin wrapper che gestisce filtri giornata/elezione e delega a
`DashboardCore` in `mode='auth'`.

### Drill-down (modali)

Tre nuovi componenti modali in `src/features/dashboard/drilldown/`:

- `SezioniDrillDownModal.tsx` — invocato dalla `CoperturaCard`. Tabella sezioni
  della giornata, righe ordinabili per `numero`. Colonne: N., indirizzo, stato
  (`✓ submitted` / `~ draft` / `◯ vuoto`), schede totali, totale voti, %.
  Search input filtra per numero/indirizzo. Click su una riga apre sub-modal
  `SezioneDettaglioModal` con: totali schede, voti per lista (tabella), top
  candidati di sezione (tabella). Sub-modal usa solo aggregati esistenti per
  quella sezione.
- `VotiListaDrillDownModal.tsx` — invocato da `VotiListaChart`. Tabella liste:
  nome, voti totali, %, sezioni che hanno inviato, candidati top-3. Click su
  una riga → sub-modal `ListaDettaglioModal`: distribuzione voti per sezione
  (mini bar chart), elenco candidati di quella lista con voti e %.
- `CandidatiDrillDownModal.tsx` — invocato da `TopCandidatiChart`. Tabella
  ranked di tutti i candidati con voti, %, lista. Click su un candidato →
  sub-modal `CandidatoDettaglioModal`: distribuzione preferenze per sezione,
  totale, % rispetto al totale lista.

Tutti i modali sono client-only e riusano i dati già fetchati dalla
DashboardCore (passati come prop) — niente nuove fetch per drill-down primari.
I sub-modali pure (sono filtri locali sugli stessi array).

Per UX coerente: ogni card di KpiCards/VotiListaChart/TopCandidatiChart/
CoperturaCard riceve un `onClick` opzionale; se presente, l'intera card è
`role="button"` con hover state. KpiCards non hanno drill (sono numeri scarni)
ma `Card "% copertura"` di KpiCards invoca lo stesso modal della Copertura.

### Admin: toggle Pubblica

In `src/features/admin/giornate/ElezioneSection.tsx`, accanto al badge `tipo`
si aggiunge una pill `Pubblica` con `Switch` controllato. Toggle chiama
`useUpdateElezione({ id, patch: { pubblica: boolean } })`. Tooltip:

> _"Quando attiva, i risultati di questa elezione sono visualizzabili dalla
> home pubblica senza login."_

`useElezioni` ritorna già la riga completa; serve aggiungere `pubblica` ai
type `ElezioneRow/Update`.

## Type updates

In `src/lib/database.types.ts`:

```ts
export type ElezioneRow = {
  // ... esistenti ...
  pubblica: boolean;
};
export type ElezioneInsert = Partial<Pick<ElezioneRow, 'pubblica'>> & {
  // ... esistenti ...
};
export type ElezioneUpdate = Partial<Pick<ElezioneRow, 'pubblica'>> & {
  // ... esistenti ...
};
```

E nuovo helper RPC nelle Functions:

```ts
elezione_is_public: { Args: { p_elezione_id: string }; Returns: boolean };
giornata_has_public: { Args: { p_giornata_id: string }; Returns: boolean };
```

## Query/hooks nuovi

In `src/lib/queries/elezioni.ts`:

```ts
/** Solo elezioni pubbliche, ordinate per data giornata desc. Usata dalla home pubblica. */
export function useElezioniPubbliche() { ... }
```

Implementazione: select su `elezioni` filtrato `eq('pubblica', true)`, embed
giornata (`*, giornata:giornate_elettorali!inner(nome, comune, data, stato)`).

Non servono altri hook nuovi: gli hook di `sezioni`, `risultati`, `liste`,
`candidati`, `voti_lista`, `preferenze` funzionano già anche con sessione
anonima (basta che le RLS lo permettano).

## Pagine modificate

- `src/app/router.tsx` — refactor completo del tree (vedi sopra).
- `src/features/admin/giornate/ElezioneSection.tsx` — pill toggle "Pubblica".
- `src/features/dashboard/DashboardPage.tsx` — diventa wrapper di
  `DashboardCore`.
- `src/features/dashboard/CoperturaCard.tsx` — accetta `onClick`, diventa
  cliccabile.
- `src/features/dashboard/VotiListaChart.tsx` — idem.
- `src/features/dashboard/TopCandidatiChart.tsx` — idem.
- `src/features/dashboard/KpiCards.tsx` — la card "% copertura" accetta
  `onClick`.
- `src/components/layout/AppShell.tsx` — nessun cambio interno; la sua route
  diventa `/app/*` invece di `/*`.
- `src/components/layout/BottomNav.tsx` — i link interni `/admin/...` ecc.
  diventano `/app/admin/...`.
- `src/features/auth/ProtectedRoute.tsx` — il redirect post-`!session` resta
  `/login`. Il redirect post-`!allow` cambia da `/` a `/app`.
- `src/features/auth/LoginPage.tsx` — dopo login, redirect a
  `from?.pathname ?? '/app'`.

## Componenti nuovi (riepilogo)

- `src/pages/HomePublicPage.tsx`
- `src/pages/DashboardPublicaPage.tsx`
- `src/features/dashboard/DashboardCore.tsx` (estratto)
- `src/features/dashboard/drilldown/SezioniDrillDownModal.tsx`
- `src/features/dashboard/drilldown/SezioneDettaglioModal.tsx`
- `src/features/dashboard/drilldown/VotiListaDrillDownModal.tsx`
- `src/features/dashboard/drilldown/ListaDettaglioModal.tsx`
- `src/features/dashboard/drilldown/CandidatiDrillDownModal.tsx`
- `src/features/dashboard/drilldown/CandidatoDettaglioModal.tsx`
- `src/pages/RedirectLegacy.tsx` (helper per redirect 301 client-side)
- `src/features/admin/giornate/ElezionePubblicaToggle.tsx` (componente piccolo
  per la pill, isolato da `ElezioneSection` per leggibilità)

## Migrations (riepilogo)

- `supabase/migrations/0012_elezione_pubblica.sql` — colonna `pubblica` +
  helper functions `elezione_is_public`, `giornata_has_public`.
- `supabase/migrations/0013_rls_pubblica_anon.sql` — policy `SELECT TO anon`
  su tutte le tabelle necessarie.

Le due migration vengono applicate in sequenza con
`node scripts/apply-migration.mjs supabase/migrations/0012_...sql` e poi 0013.

## Considerazioni di sicurezza

- Le policy `TO anon` sono **solo SELECT**. Nessun INSERT/UPDATE/DELETE viene
  abilitato per `anon`.
- Le policy esistenti `TO authenticated` non vengono toccate — gli utenti
  loggati continuano a vedere/scrivere come oggi.
- Il filtro `elezione_is_public` blocca dati di elezioni private anche se la
  query li chiedesse (es. liste o candidati di un'elezione non pubblica
  appartenente alla stessa giornata).
- Il toggle "Pubblica" è dietro RLS `admin-only` su `elezioni` (già
  esistente). Solo un admin può accendere/spegnere il flag.
- Niente PII esposta: `profiles` e `audit_log` rimangono `authenticated`-only.

## UX scelte importanti

- Drill-down sempre modal, mai page-route per i livelli 1–2 di profondità.
  Mantiene il senso di "stay on the dashboard". Per livelli più profondi
  (eventuale futuro) → page-route.
- Sub-modal aperto sopra al primo modal (z-index alto). ESC chiude il sub
  prima del parent.
- Search box nei modali tabella (Sezioni/Liste/Candidati): filtro su
  numero/nome con `useDeferredValue` per non lagare.
- Tooltip sui valori % per indicare numerosità di basi (es. "12 sezioni di 80
  inviate").

## Errori e stati

- Home pubblica con backend offline: skeleton + "Errore caricamento elezioni"
  toast (Toast esistente OK).
- Dashboard pubblica con `elezioneId` non pubblica (o inesistente): la query
  ritornerà nulla per RLS → mostra `EmptyState` _"Questa elezione non è
  disponibile."_ + link `/`.
- Banner loggato in home pubblica: se `useRole()` ritorna `null` (profilo non
  attivo), niente banner.

## Build & Deploy

- `npm run build` per verifica type+bundle.
- Migration applicate via `apply-migration.mjs` con pre/post-check.
- Commit + push su `main` → GitHub Pages deploy automatico via workflow
  esistente.

## Out of scope (riepilogo)

- Foto pubbliche.
- Mappe pubbliche.
- Composer post live anon.
- Routing con i18n.
- Caching/CDN ottimizzato per visitor anonimi (resta affidato a Supabase
  PostgREST come per gli authenticated).
