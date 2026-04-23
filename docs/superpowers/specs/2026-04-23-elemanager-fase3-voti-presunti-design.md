# Elemanager — Fase 3: Voti presunti + Confronto

**Data**: 2026-04-23
**Autore**: Roberto De Domenico + Claude
**Status**: Draft in review
**Riferimento**: `docs/superpowers/specs/2026-04-18-elemanager-mvp-fase1-design.md` (Fase 1 — MVP core)

## Obiettivo

Introdurre la gestione dei **voti presunti** per candidato (stime della campagna: es. "la Famiglia Costa porterà 40 voti a Rossi in sezione 5") e la **dashboard di confronto** presunti vs reali, strumento strategico riservato ad admin per monitorare in tempo reale lo scostamento rispetto alle aspettative della campagna.

I voti presunti sono dati **strategici e riservati**: non vengono mostrati a editor né a viewer. Solo gli admin li inseriscono e li leggono.

## Non-goal

- Non sostituisce i canali ufficiali del Ministero/Comune (come tutta l'app).
- Non distribuisce automaticamente il residuo: sezioni senza stima esplicita sono ignorate nel confronto.
- Non stima le liste (in questa fase): solo candidati. La stima lista resta un'estensione futura.
- Non importa presunti da CSV (in questa fase): solo form UI. CSV può arrivare più avanti se emerge il bisogno.

## Decisioni chiave (brainstorming)

1. **Granularità stima** → per candidato con **totale globale + stime per-sezione opzionali**. Non si richiede la matrice completa.
2. **Sezioni senza stima** → **ignorate** nel confronto per-sezione. Nessuna distribuzione automatica del residuo.
3. **Soggetto della stima** → solo **candidati**. Liste rimandate.
4. **Input method** → **form UI a due viste simmetriche**: per candidato (un candidato, le sue sezioni) e per sezione (una sezione, tutti i candidati).
5. **Dashboard confronto** → **due viste equivalenti**: per candidato e per sezione (tab).

## Modello dati

Nuova tabella nel schema `elemanager`:

```sql
CREATE TABLE elemanager.voti_presunti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid NOT NULL REFERENCES elemanager.candidati(id) ON DELETE CASCADE,
  sezione_id uuid REFERENCES elemanager.sezioni(id) ON DELETE CASCADE,
  voti int NOT NULL CHECK (voti >= 0),
  created_by uuid REFERENCES elemanager.profiles(id),
  updated_by uuid REFERENCES elemanager.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Semantica:
- Riga con `sezione_id IS NULL` → **totale globale presunto** per il candidato (al più una per candidato).
- Riga con `sezione_id IS NOT NULL` → stima per-sezione (al più una per coppia candidato×sezione).

Unicità tramite **due indici parziali** (un `UNIQUE (candidato_id, sezione_id)` con `NULL` non funziona: `NULL` non si uguaglia a `NULL`):

```sql
CREATE UNIQUE INDEX voti_presunti_totale_uq
  ON elemanager.voti_presunti (candidato_id)
  WHERE sezione_id IS NULL;

CREATE UNIQUE INDEX voti_presunti_sezione_uq
  ON elemanager.voti_presunti (candidato_id, sezione_id)
  WHERE sezione_id IS NOT NULL;
```

Indici di lettura:
```sql
CREATE INDEX voti_presunti_candidato_idx ON elemanager.voti_presunti (candidato_id);
CREATE INDEX voti_presunti_sezione_idx ON elemanager.voti_presunti (sezione_id)
  WHERE sezione_id IS NOT NULL;
```

### Trigger di coerenza

`sezione_id.giornata_id` deve coincidere con `candidato_id → lista → elezione → giornata_id`. Stessa logica del trigger già usato per `preferenze_candidato`:

```sql
CREATE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  giornata_candidato uuid;
  giornata_sezione uuid;
BEGIN
  IF NEW.sezione_id IS NULL THEN
    RETURN NEW;  -- totale globale, niente da verificare
  END IF;

  SELECT e.giornata_id INTO giornata_candidato
  FROM elemanager.candidati c
  JOIN elemanager.liste l ON l.id = c.lista_id
  JOIN elemanager.elezioni e ON e.id = l.elezione_id
  WHERE c.id = NEW.candidato_id;

  SELECT s.giornata_id INTO giornata_sezione
  FROM elemanager.sezioni s
  WHERE s.id = NEW.sezione_id;

  IF giornata_candidato IS DISTINCT FROM giornata_sezione THEN
    RAISE EXCEPTION 'candidato % e sezione % appartengono a giornate diverse',
      NEW.candidato_id, NEW.sezione_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER voti_presunti_coerenza_giornata
  BEFORE INSERT OR UPDATE ON elemanager.voti_presunti
  FOR EACH ROW EXECUTE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata();
```

### Audit log

La tabella `voti_presunti` è sensibile: trigger `trg_audit` (già esistente) applicato anche qui. Ogni INSERT/UPDATE/DELETE viene loggato in `audit_log`.

### Trigger `updated_at`

Stesso pattern delle altre tabelle: trigger BEFORE UPDATE che aggiorna `updated_at = now()`.

### Realtime

Publication `supabase_realtime` aggiunge `elemanager.voti_presunti` per aggiornare la dashboard confronto live.

## Row Level Security

Default deny. Policy **admin-only su tutte le operazioni**.

```sql
ALTER TABLE elemanager.voti_presunti ENABLE ROW LEVEL SECURITY;

CREATE POLICY voti_presunti_admin_select ON elemanager.voti_presunti
  FOR SELECT USING (elemanager.auth_role() = 'admin');

CREATE POLICY voti_presunti_admin_insert ON elemanager.voti_presunti
  FOR INSERT WITH CHECK (elemanager.auth_role() = 'admin');

CREATE POLICY voti_presunti_admin_update ON elemanager.voti_presunti
  FOR UPDATE USING (elemanager.auth_role() = 'admin')
             WITH CHECK (elemanager.auth_role() = 'admin');

CREATE POLICY voti_presunti_admin_delete ON elemanager.voti_presunti
  FOR DELETE USING (elemanager.auth_role() = 'admin');
```

Editor e viewer non ricevono alcuna riga da `voti_presunti` né dalla publication realtime (RLS si applica anche ai canali realtime).

## UX admin — CRUD voti presunti

Nuova voce nel menu `AdminLayout`: **"Voti presunti"** → pagina `/admin/presunti`.

La pagina ha un **filtro elezione** (se la giornata attiva ha più elezioni, default: prima elezione in ordine) e due tab:

### Tab "Per candidato"

Tabella:

| Candidato | Lista | Totale presunto | # stime sezione | Azioni |
|---|---|---|---|---|
| Rossi Mario | Lista A | 1200 | 8 | → |
| Bianchi Anna | Lista A | — | 3 | → |

Ordinamento default: per lista + ordine candidato. Ricerca per nome/cognome.
Riga con totale vuoto → "—" in grigio. Click riga → `/admin/presunti/candidato/:candidato_id`.

**Pagina form candidato**:
- Header: nome + lista + link torna alla index.
- Campo `Totale presunto` (intero ≥ 0, opzionale). Vuoto = elimina la riga `sezione_id IS NULL`.
- Sezione "Stime per sezione":
  - Lista righe editabili: `[select sezione] [input voti] [×]`.
  - Bottone "+ Aggiungi stima sezione". Il select mostra solo sezioni della giornata che non sono già presenti nella lista.
  - `×` rimuove la riga (DELETE in DB).
- Persistenza: autosave on blur + debounce 500ms per campo, pattern già usato in editor voti.
- Validazione soft: warning inline se somma stime per-sezione > totale globale presunto (non blocca: l'admin potrebbe non aver definito un totale rigoroso).

### Tab "Per sezione"

Tabella:

| Sezione | Indirizzo | # candidati con stima | Totale voti presunti | Azioni |
|---|---|---|---|---|
| 1 | Via X | 12 | 340 | → |
| 2 | Via Y | 0 | 0 | → |

Ordinamento default: per numero sezione. Ricerca per numero.
Click riga → `/admin/presunti/sezione/:sezione_id`.

**Pagina form sezione**:
- Header: numero sezione + indirizzo + ubicazione + link torna alla index.
- Filtro elezione (se la giornata ha più elezioni).
- Lista di **tutti i candidati** dell'elezione raggruppati per lista. Ogni riga:
  - Nome candidato + lista a sinistra.
  - Input voti a destra. Campo vuoto = nessuna stima (assenza di riga o DELETE).
- Autosave on blur per ogni campo:
  - Campo vuoto e riga esisteva → DELETE.
  - Campo con valore e riga non esisteva → INSERT.
  - Campo con valore diverso e riga esisteva → UPDATE.
- Header pagina: totale voti presunti nella sezione (somma dei campi compilati), aggiornato live.

Entrambe le viste scrivono sulla stessa tabella `voti_presunti` con `sezione_id NOT NULL`. Il **totale globale** (`sezione_id IS NULL`) si inserisce **solo dalla vista "Per candidato"** (nella vista per sezione non ha senso).

## UX admin — Dashboard confronto

Nuova voce nel menu `AdminLayout`: **"Confronto"** → pagina `/admin/confronto`.

Filtro elezione in alto (obbligatorio: tutto il contenuto delle tab è scopato all'elezione selezionata). Badge di copertura: "X/Y sezioni con risultati `submitted` o `verified` tra quelle stimate".

Due tab equivalenti. Tutti i dati mostrati nelle tab e nei drill-down sono filtrati per l'elezione selezionata.

### Tab "Per candidato"

Lista candidati (filtrata all'elezione selezionata):

| Candidato | Lista | Reale | Presunto | Δ | Δ % | Barra |
|---|---|---|---|---|---|---|
| Rossi Mario | Lista A | 980 | 1200 | −220 | −18% | ▓▓▓▓░░ |

- **Reale**: somma di `preferenze_candidato.voti` per il candidato su tutte le sezioni con risultato (`submitted` o `verified`).
- **Presunto**: totale globale presunto (`sezione_id IS NULL`). Se assente, mostra "—" e nessun Δ.
- **Δ**: `reale − presunto`. Colore verde se ≥ 0, rosso se < 0.
- **Δ %**: `(reale − presunto) / presunto * 100`. Se presunto = 0 o assente → "—".
- Barra: visualizzazione relativa rispetto al presunto (100% = presunto raggiunto).

Ordinamento default: Δ % crescente (i peggiori sopra). Toggle per ordinare per Δ assoluto o per nome.

Click riga → drill-down candidato:
- Card in alto con reale, presunto, Δ, Δ %.
- Tabella "Sezioni stimate":

| Sezione | Presunto | Reale | Δ | Δ % | Stato sezione |
|---|---|---|---|---|---|
| 5 | 40 | 38 | −2 | −5% | ✓ submitted |
| 7 | 20 | — | — | — | ⏳ in attesa |

- Solo sezioni con stima per il candidato. "Reale" è `preferenze_candidato.voti` per (candidato, sezione) se esiste un `risultati_sezione` in stato `submitted` o `verified`; altrimenti "—" + stato "in attesa".
- Stato sezione deriva da `risultati_sezione.stato` (`draft` / `submitted` / `verified` / assente).

### Tab "Per sezione"

Lista sezioni:

| Sezione | Indirizzo | Stato | # candidati stimati | Reale tot. | Presunto tot. | Δ |
|---|---|---|---|---|---|---|
| 5 | Via X | ✓ submitted | 12 | 340 | 380 | −40 |

- "Reale tot." = somma `preferenze_candidato.voti` dei candidati che hanno stima in quella sezione.
- "Presunto tot." = somma stime `voti_presunti` per quella sezione.

Click riga → drill-down sezione:
- Header: numero, indirizzo, stato.
- Tabella "Candidati stimati in questa sezione":

| Candidato | Lista | Presunto | Reale | Δ | Δ % |
|---|---|---|---|---|---|

- Solo candidati con riga `voti_presunti` per (candidato, sezione_id corrente).
- Riga totali in fondo.

### Comportamento comune alle due viste

- **Realtime**: subscription Supabase su `preferenze_candidato` e `voti_presunti` → cache TanStack Query invalidata → UI aggiornata senza refresh.
- **Toggle "mostra anche stime = 0"**: off di default (righe con presunto 0 non interessano), on per debug.
- **Fallback stato vuoto**: "nessuna stima inserita per questa elezione" con CTA "vai a Voti presunti".

## Architettura frontend

```
src/features/admin/presunti/
├── PresuntiIndexPage.tsx           # /admin/presunti — tabs Per candidato / Per sezione
├── PresuntoCandidatoPage.tsx       # /admin/presunti/candidato/:id
├── PresuntoSezionePage.tsx         # /admin/presunti/sezione/:id
└── components/
    ├── StimaSezioneRow.tsx         # riga select sezione + voti (form candidato)
    └── CandidatoVotiRow.tsx        # riga candidato + input voti (form sezione)

src/features/admin/confronto/
├── ConfrontoPage.tsx               # /admin/confronto — tabs + filtro elezione
├── PerCandidatoView.tsx
├── PerSezioneView.tsx
├── CandidatoDrillDown.tsx          # /admin/confronto/candidato/:id
├── SezioneDrillDown.tsx            # /admin/confronto/sezione/:id
└── confronto.ts                    # pure functions aggregazione (unit-test)

src/lib/queries/
└── votiPresunti.ts                 # hook TanStack Query + subscription realtime
```

### Hook queries

`votiPresunti.ts` espone:
- `useVotiPresuntiByElezione(elezioneId)` → lista completa per calcoli admin.
- `useVotiPresuntiByCandidato(candidatoId)` → subset per form candidato.
- `useVotiPresuntiBySezione(sezioneId, elezioneId)` → subset per form sezione.
- Mutations `upsertVotoPresunto`, `deleteVotoPresunto`.
- `useConfrontoData(elezioneId)` → combina `preferenze_candidato` + `voti_presunti` per dashboard (usa `confronto.ts` internamente).

Tutte le query usano cache TanStack Query con realtime invalidation già configurata nel progetto.

### Funzioni pure in `confronto.ts`

```typescript
aggregateByCandidato(
  presunti: VotoPresunto[],
  preferenze: PreferenzaCandidato[],
  risultatiSezione: RisultatoSezione[],
  candidati: Candidato[],
): CandidatoConfrontoRow[]

aggregateBySezione(
  presunti: VotoPresunto[],
  preferenze: PreferenzaCandidato[],
  risultatiSezione: RisultatoSezione[],
  sezioni: Sezione[],
  candidati: Candidato[],
): SezioneConfrontoRow[]

candidatoDrillDown(
  candidatoId: string,
  presunti: VotoPresunto[],
  preferenze: PreferenzaCandidato[],
  risultatiSezione: RisultatoSezione[],
  sezioni: Sezione[],
): SezioneDettaglio[]

sezioneDrillDown(
  sezioneId: string,
  elezioneId: string,
  presunti: VotoPresunto[],
  preferenze: PreferenzaCandidato[],
  candidati: Candidato[],
): CandidatoDettaglio[]
```

Nessuna IO, input/output puri JS, completamente unit-testabili.

### Routing e menu

`AdminLayout` aggiunge due voci di menu mobile-first con icona:
- **Voti presunti** → `/admin/presunti`
- **Confronto** → `/admin/confronto`

Entrambe visibili solo se `useRole() === 'admin'`. Nessun cambio a Editor/Viewer layout.

## Migration

File: `supabase/migrations/0010_voti_presunti.sql`

Contiene:
1. `CREATE TABLE elemanager.voti_presunti` + check + default.
2. Due `CREATE UNIQUE INDEX` parziali + indici di lettura.
3. Funzione e trigger `voti_presunti_coerenza_giornata`.
4. Funzione e trigger `voti_presunti_updated_at` (riusa pattern esistente se già generico).
5. Trigger audit (`trg_audit` già definito, solo applicazione).
6. Policy RLS (4 policy: SELECT/INSERT/UPDATE/DELETE admin-only).
7. `ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.voti_presunti`.

## Testing

### Unit (Vitest)

In `src/features/admin/confronto/confronto.test.ts`:
- `aggregateByCandidato`:
  - Candidato senza presunto globale → Δ e Δ % = null.
  - Candidato con presunto = 0 → Δ % = null, Δ = reale.
  - Candidato con presunto > 0 e reale > 0 → Δ e Δ % corretti.
  - Sezioni non `submitted`/`verified` non contribuiscono a "reale".
- `aggregateBySezione`:
  - Sezione con 0 stime → riga mostra 0 candidati stimati, totali 0.
  - Sezione con più stime → somma corretta.
- `candidatoDrillDown`:
  - Sezione stimata senza risultato → `reale = null`, stato "in attesa".
- `sezioneDrillDown`:
  - Ordine righe = ordine candidati della lista.

### Integration / RLS (Vitest + client Supabase con JWT per ruolo)

In `tests/integration/voti-presunti-rls.test.ts`:
- Admin può SELECT/INSERT/UPDATE/DELETE.
- Editor SELECT ritorna 0 righe (anche se righe esistono).
- Viewer SELECT ritorna 0 righe.
- Editor INSERT fallisce con 403/policy error.
- Trigger coerenza giornata: insert con sezione di giornata diversa → eccezione.
- Indici unici parziali: due totali per stesso candidato → fallisce; due stime per stessa (candidato, sezione) → fallisce.

### E2E (Playwright)

In `tests/e2e/confronto.spec.ts`:
- Happy path admin:
  1. Login admin.
  2. Vai a `/admin/presunti` tab "Per candidato" → apri un candidato → inserisci totale globale 100.
  3. Vai tab "Per sezione" → apri sezione 1 → inserisci 40 per lo stesso candidato.
  4. Login editor (seconda sessione).
  5. Editor inserisce `preferenze_candidato = 35` per quel candidato×sezione 1 e chiude sezione (`submitted`).
  6. Login admin → `/admin/confronto` tab "Per candidato" → il candidato mostra Reale 35 / Presunto 100 / Δ -65.
  7. Drill-down candidato: sezione 1 mostra Presunto 40 / Reale 35 / Δ -5.
- Editor non vede voce di menu "Voti presunti" né "Confronto".
- Viewer non vede voce di menu "Voti presunti" né "Confronto".

Target coverage: ≥80% su `confronto.ts` (pure functions).

## Sicurezza

- RLS admin-only come descritto.
- Trigger audit sul 100% delle modifiche.
- Vincolo `voti >= 0` a DB + validazione client.
- Input numerici con `inputmode="numeric"` per tastiera mobile.
- Nessuna esposizione di `voti_presunti` a ruoli diversi da admin, anche via realtime.

## Metriche di successo Fase 3

- Admin può inserire presunti per 50 candidati in < 20 minuti.
- Dashboard confronto aggiorna i valori in < 2 secondi dal momento in cui l'editor chiude una sezione (`submitted`).
- 100% dei presunti soggetti ad audit log.
- RLS impedisce qualsiasi leak a editor/viewer (verificato nei test).

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Autosave per-sezione crea molte mutation | Medio | Debounce 500ms per campo, batch mutations quando possibile |
| Admin confonde presunto globale con somma per-sezione | Medio | Warning soft se somma stime > totale globale, copy UI chiara |
| Perdita stima per cambio elezione senza salvataggio | Basso | Autosave continuo, no stato locale volatile |
| Editor vede presunti via realtime leak | Alto | RLS policy esplicite + test integration che verificano |

## Deliverable Fase 3

1. Migration `0010_voti_presunti.sql` applicata in dev e documentata.
2. UI admin `/admin/presunti` con le due tab e i due form (candidato, sezione).
3. Dashboard `/admin/confronto` con le due tab e drill-down.
4. Hook queries in `src/lib/queries/votiPresunti.ts` con realtime.
5. Funzioni pure in `src/features/admin/confronto/confronto.ts` + unit test.
6. Test integration RLS.
7. Test E2E happy path completo (admin + editor).
8. Aggiornamento `README.md` con sezione Fase 3.

## Fuori scope Fase 3 (per chiarezza)

- Stime per liste → eventuale Fase 3bis.
- Import CSV presunti → se emerge il bisogno.
- Proiezioni pesate del risultato finale → Fase 4.
- Export CSV/PDF del confronto → Fase 4.
- Notifiche push su scostamenti significativi → Fase 5.
