# Azzera dati di una sezione per un'elezione — Design

## Contesto e motivazione

Durante l'inserimento dei dati può capitare che un editor (per i voti effettivi) o un admin (per i voti presunti) sbagli sezione, trascriva male numeri, o carichi foto sulla sezione errata. Oggi non esiste un modo pulito per "azzerare" l'inserimento e ripartire: l'unico workaround è modificare a mano i campi uno per uno, lasciando comunque foto e voti collegati.

L'obiettivo è dare al ruolo `admin` due azioni di azzeramento simmetriche — una per i **voti effettivi** (scrutinio) e una per i **voti presunti** (stime di campagna) — che cancellino tutti i dati relativi alla coppia (sezione, elezione) in un colpo solo.

Le due cose sono tenute **separate** perché:
- I voti effettivi sono inseriti dagli editor sulla pagina `/editor/giornate/:gid/sezioni/:sid?e=:eid`.
- I voti presunti sono inseriti dagli admin sulla pagina `/admin/presunti/sezioni/:sezioneId`.
- Un errore in uno dei due flussi non implica errori nell'altro: l'admin deve poter azzerare solo ciò che gli serve azzerare.

## Scope

### Scenario A — Azzera voti effettivi per (sezione, elezione)

Cancella i **dati di scrutinio**:

1. **Risultato della sezione** — riga in `risultati_sezione` per `(sezione_id, elezione_id)`. Il `ON DELETE CASCADE` fa cadere automaticamente:
   - `voti_lista` (tutti i voti per lista collegati al risultato)
   - `preferenze_candidato` (tutte le preferenze per candidato collegate al risultato)
2. **Foto della sezione associate a quell'elezione** — righe in `foto_sezione` con `(sezione_id, elezione_id)` corrispondenti, **più i file binari su Supabase Storage** nel bucket `sezioni-photos` (altrimenti restano orfani occupando spazio).

NON tocca: voti presunti, anagrafica sezione, foto di altre elezioni della stessa sezione, liste/candidati/elezione/giornata.

### Scenario B — Azzera voti presunti per (sezione, elezione)

Cancella le righe in `voti_presunti` la cui `sezione_id` è quella selezionata **e** il cui `candidato_id` appartiene a una lista dell'elezione selezionata. Le righe "totale candidato" con `sezione_id IS NULL` non vengono toccate (sono dati globali del candidato, non legati alla sezione).

NON tocca: voti effettivi, foto, voti presunti totali, anagrafica.

### Chi può farlo (entrambi gli scenari)

Solo ruolo `admin`. Le RLS già impongono `is_admin()` per le DELETE su `risultati_sezione`, `voti_presunti` e (parzialmente) `foto_sezione`. L'UI nasconde inoltre il pulsante a editor/viewer.

## Architettura

### Layer DB: due RPC server-side

Due funzioni separate in schema `elemanager`, entrambe `SECURITY DEFINER` con check `is_admin()` come prima istruzione del body. Il check duplicato (RPC + RLS) è difesa in profondità: senza il check nella RPC, qualunque authenticated user potrebbe scavalcare le RLS via SECURITY DEFINER.

#### `elemanager.reset_voti_effettivi_sezione_elezione`

```sql
CREATE OR REPLACE FUNCTION elemanager.reset_voti_effettivi_sezione_elezione(
  p_sezione_id  uuid,
  p_elezione_id uuid
) RETURNS text[]   -- array di storage_path delle foto cancellate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = elemanager, public, auth
AS $$ ... $$;
```

Pseudocodice:

```
1. IF NOT elemanager.is_admin() THEN RAISE EXCEPTION '...' USING ERRCODE = '42501'; END IF;
2. SELECT array_agg(storage_path) INTO v_paths
     FROM foto_sezione
     WHERE sezione_id = p_sezione_id AND elezione_id = p_elezione_id;
3. DELETE FROM foto_sezione WHERE sezione_id = p_sezione_id AND elezione_id = p_elezione_id;
4. DELETE FROM risultati_sezione WHERE sezione_id = p_sezione_id AND elezione_id = p_elezione_id;
   (cascade su voti_lista e preferenze_candidato)
5. RETURN COALESCE(v_paths, ARRAY[]::text[]);
```

Tutto in singola transazione PL/pgSQL. Restituisce i `storage_path` perché Postgres non può cancellare file dal bucket Supabase Storage — il client li userà per la pulizia.

#### `elemanager.reset_voti_presunti_sezione_elezione`

```sql
CREATE OR REPLACE FUNCTION elemanager.reset_voti_presunti_sezione_elezione(
  p_sezione_id  uuid,
  p_elezione_id uuid
) RETURNS integer   -- numero di righe cancellate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = elemanager, public, auth
AS $$ ... $$;
```

Pseudocodice:

```
1. IF NOT elemanager.is_admin() THEN RAISE EXCEPTION '...' USING ERRCODE = '42501'; END IF;
2. WITH del AS (
     DELETE FROM voti_presunti
     WHERE sezione_id = p_sezione_id
       AND candidato_id IN (
         SELECT c.id FROM candidati c
         JOIN liste l ON l.id = c.lista_id
         WHERE l.elezione_id = p_elezione_id
       )
     RETURNING 1
   )
   SELECT count(*) INTO v_count FROM del;
3. RETURN v_count;
```

Entrambe con `GRANT EXECUTE ... TO authenticated`.

Migration unica: `0011_azzera_sezione_elezione.sql`.

### Layer client: due hook simmetrici

Due hook React Query separati.

In `src/lib/queries/risultati.ts`:

```ts
export function useResetVotiEffettiviSezioneElezione() { ... }
```

Comportamento `mutationFn` (input: `{ sezioneId, elezioneId, giornataId }`):

1. `db.rpc('reset_voti_effettivi_sezione_elezione', { p_sezione_id, p_elezione_id })` → riceve `string[]` di storage_paths.
2. Se l'array non è vuoto: `supabase.storage.from('sezioni-photos').remove(storage_paths)`. Errori Storage vengono **loggati** (`console.error`) ma **non** fanno fallire la mutation. I metadati DB sono già spariti; gli eventuali file orfani sono recuperabili manualmente con costo molto basso.
3. `onSuccess`: invalida le query rilevanti:
   - `['risultati', sezioneId, elezioneId]`
   - `['risultati', 'giornata', giornataId]`
   - `['voti_lista']` (prefisso — l'id del risultato non esiste più, invalidiamo tutto il ramo)
   - `['preferenze']` (idem)
   - `['foto', ...]` con la query key esatta usata in `src/lib/queries/foto.ts` (da verificare durante l'implementazione)

In `src/lib/queries/votiPresunti.ts`:

```ts
export function useResetVotiPresuntiSezioneElezione() { ... }
```

Comportamento `mutationFn` (input: `{ sezioneId, elezioneId }`):

1. `db.rpc('reset_voti_presunti_sezione_elezione', { p_sezione_id, p_elezione_id })` → riceve `number` (count cancellati).
2. `onSuccess`: invalida `['voti_presunti']` con prefisso (copre `[KEY, 'elezione', ...]`, `[KEY, 'candidato', ...]`, `[KEY, 'sezione', ...]`).

Il segnale realtime di Supabase su `risultati_sezione`, `foto_sezione`, `voti_presunti` notificherà automaticamente le altre sessioni aperte.

### Layer UI: pulsante "Azzera sezione" nei due posti

In entrambe le pagine si aggiunge un pulsante rosso `variant="danger" size="sm"`, **visibile solo se `profile?.ruolo === 'admin'`**, label **"Azzera sezione"**.

#### Pagina voti effettivi — `src/features/editor/ElezioneVoteTab.tsx`

Route: `/editor/giornate/:giornataId/sezioni/:sezioneId?e=:elezioneId`.

Posizione: nella sticky bottom bar a sinistra dei pulsanti "Salva bozza" / "Invia sezione", separato visivamente. Sempre cliccabile per admin (la RPC è idempotente: zero righe = zero effetto).

Conferma con `ConfirmDialog`:
> _"Azzerare l'inserimento per la sezione N. **{numero}** dell'elezione «**{nomeElezione}**»? Verranno cancellati risultati, voti per lista, preferenze e foto caricate per questa sezione e questa elezione. L'operazione è irreversibile."_
- `confirmLabel="Azzera"` con `danger`.

Su successo:
- Toast verde `"Sezione azzerata"`.
- `clearAutosave(autosaveKey)` per quella coppia.
- Reset di `dirty`/`hydrated` a `false` per forzare la re-idratazione dal server (ora vuoto). In pratica si scatena lo stesso effetto del rendering iniziale del componente.

Su errore: toast rosso. Se l'errore corrisponde al codice `42501`, messaggio `"Non autorizzato"`.

#### Pagina voti presunti — `src/features/admin/presunti/PresuntoSezionePage.tsx`

Route: `/admin/presunti/sezioni/:sezioneId` (con elezione selezionata via `<Select>`).

Posizione: header della pagina, accanto al link "Torna all'elenco" (o nel `PageHeader` come `actions`). Disabilitato se non c'è ancora una `selectedElezioneId` (il dropdown elezione deve avere un valore).

Conferma con `ConfirmDialog`:
> _"Azzerare i voti presunti per la sezione N. **{numero}** dell'elezione «**{nomeElezione}**»? Verranno cancellate tutte le righe presunte per questa sezione relative ai candidati di questa elezione. I totali globali dei candidati restano invariati. L'operazione è irreversibile."_
- `confirmLabel="Azzera"` con `danger`.

Su successo: toast verde `"Voti presunti azzerati ({count} righe)"`. La UI si aggiorna automaticamente via invalidate.

### Edge case: dirty form locale (solo scenario voti effettivi)

Se l'admin ha modifiche non salvate nel form al click di "Azzera", il dialog di conferma ne fa già menzione implicita. Dopo il reset, `dirty` torna `false` e l'autosave key viene cancellata, così non vediamo prompt di "bozza locale più recente" al prossimo accesso sullo stesso device.

### Edge case: bozze locali su altri dispositivi (solo scenario voti effettivi)

Un editor su un altro device potrebbe avere un autosave locale per la stessa `(sezione, elezione)` con timestamp posteriore al reset. Al suo prossimo accesso vedrà il prompt "Bozza locale più recente del server: ripristinare?". Comportamento accettato: il prompt esistente gestisce il caso e l'editor può scegliere di scartare. Non aggiungiamo logica server-side per invalidare bozze locali altrui.

## Considerazioni di sicurezza

- Check `is_admin()` duplicato (RLS + RPC body). Le RPC sono `SECURITY DEFINER`: senza check esplicito, qualunque authenticated user potrebbe chiamarle.
- L'audit log esistente registra ogni DELETE sulle tabelle coinvolte. Dopo l'azzeramento l'audit traccia "chi ha cancellato cosa e quando" — non perdiamo storicità.
- Lo Storage cleanup è "best effort": se fallisce, i metadati DB sono comunque consistenti. File orfani nel bucket possono essere puliti da un job di manutenzione futuro (fuori scope).

## File interessati

### Nuovi

- `supabase/migrations/0011_azzera_sezione_elezione.sql` — due funzioni RPC + GRANT EXECUTE.

### Modificati

- `src/lib/queries/risultati.ts` — aggiunta hook `useResetVotiEffettiviSezioneElezione`.
- `src/lib/queries/votiPresunti.ts` — aggiunta hook `useResetVotiPresuntiSezioneElezione`.
- `src/features/editor/ElezioneVoteTab.tsx` — pulsante "Azzera sezione" admin-only + confirm dialog + integrazione mutation effettivi.
- `src/features/admin/presunti/PresuntoSezionePage.tsx` — pulsante "Azzera sezione" + confirm dialog + integrazione mutation presunti.

Nessun altro file richiede modifica.

## Out of scope

- Un unico pulsante "Azzera tutto" che faccia entrambe le cose insieme. La separazione è voluta perché le due pagine sono distinte e il rischio di errore differente.
- Pagina admin di "manutenzione bulk" con lista sezioni + reset di massa.
- Soft delete / "undo" dell'azzeramento. Per ora è hard.
- Cleanup automatico delle bozze locali altrui (lascia agire il flusso esistente).
- Job di pulizia file Storage orfani.
