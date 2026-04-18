# Plan 07 — Live Feed (canale WhatsApp-like)

**Goal:** Pagina **/live** stile canale WhatsApp che combina:
- **Eventi automatici sistema**: generati da trigger DB quando qualcosa cambia (nuova foto sezione, nuovo risultato, sezione completata, ecc.)
- **Messaggi utenti**: testo, foto, audio (memo vocali) scritti da admin/editor/viewer
- **Typing indicator**: "Mario sta scrivendo..."
- **Realtime**: nuovi post appaiono live in tutti i client
- **Moderazione admin**: hide/unhide messaggi utente

## Schema DB

### `live_post`
```sql
CREATE TABLE elemanager.live_post (
  id uuid PK DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES giornate_elettorali(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'user_text', 'user_audio', 'user_photo',
    'system_vote_update', 'system_photo_added',
    'system_section_complete', 'system_giornata_update',
    'system_custom'
  )),
  author_id uuid REFERENCES profiles(id),   -- NULL per system
  author_nome text,                          -- denormalizzato (rimane anche se profilo eliminato)
  content text,                              -- testo messaggio o system summary
  media_path text,                           -- storage path se user_audio/user_photo
  media_mime text,
  media_duration int,                        -- durata audio ms
  ref_table text,                            -- tabella referenziata (es. 'sezioni', 'risultati_sezione')
  ref_id text,                               -- id referenziato
  ref_url text,                              -- URL relativo per "clicca qui"
  metadata jsonb,                            -- payload extra (es. sezione_numero, elezione_nome)
  moderated boolean NOT NULL DEFAULT false,  -- nascosto da admin
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `live_typing`
```sql
CREATE TABLE elemanager.live_typing (
  giornata_id uuid NOT NULL REFERENCES giornate_elettorali(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giornata_id, user_id)
);
```
Il record viene inserito via UPSERT al primo keypress, cancellato dopo 3s di inattività o on send.

### RLS

**live_post**
- SELECT: tutti authenticated (non vedono moderated=true tranne admin)
  - Policy: `moderated = false OR is_admin()`
- INSERT: admin + editor + viewer per `kind` che inizia con `user_*`; system kinds solo via trigger (SECURITY DEFINER)
- UPDATE: admin (per moderation); autore solo per edit del proprio testo entro 2 minuti
- DELETE: admin

**live_typing**
- SELECT: authenticated
- INSERT/UPDATE/DELETE: solo sul proprio record (user_id = auth.uid())

### Bucket `live-media`
- Privato, signed URL
- Path: `{giornata_id}/{user_id}/{timestamp}-{uuid}.{ext}`
- MIME: image/jpeg, image/png, image/webp, audio/webm, audio/ogg, audio/mpeg, audio/mp4
- Max 10MB

## Trigger automatici sistema

Quando:
- `risultati_sezione` INSERT/UPDATE con stato cambiato a 'submitted' → insert live_post `system_section_complete` con metadata `{sezione_numero, elezione_nome}` e ref_url `/dashboard` (o il detail)
- `voti_lista` o `preferenze_candidato` INSERT (batch upsert dai salvataggi) → insert `system_vote_update` con summary "Nuovi voti arrivati dalla sezione X per l'elezione Y"
- `foto_sezione` INSERT → insert `system_photo_added` con metadata e ref_url
- `giornate_elettorali` UPDATE stato → insert `system_giornata_update`

Implementati via trigger Postgres `AFTER INSERT OR UPDATE ... FOR EACH ROW EXECUTE FUNCTION live_generate()`.

Deduplicazione: per risultati, generare UN solo post quando stato passa a 'submitted' (non per ogni update durante draft).

## UI

### `/live` route

- Accessibile a admin/editor/viewer.
- Layout WhatsApp-like:
  - Header fisso con nome giornata attiva (selettore se più giornate open)
  - Feed scrollabile (al fondo = più recenti)
  - Typing indicator sopra input bar
  - Input bar fisso in bottom con:
    - Textarea auto-grow
    - Bottone 📎 foto (file picker)
    - Bottone 🎤 registra audio (press-and-hold come WhatsApp)
    - Bottone ➤ invia

### Bubble styles

- **User message**:
  - Own: right-aligned, bg-neon-cyan/20 border-neon-cyan/40
  - Other: left-aligned, glass
  - Nome autore + timestamp piccolo
  - Testo: bubble normale
  - Foto: preview cliccabile → lightbox
  - Audio: custom player con waveform o barra semplice, play button
- **System event**:
  - Centrato, bg-white/5 pill shape, icona per tipo
  - Testo: es. "🗳️ Sezione 202 completata per Sindaco · [vedi]"
  - Click → naviga a ref_url

### Typing indicator

- `useTypingIndicator(giornataId)` hook che:
  - Su input change → upsert live_typing
  - Dopo 3s senza typing → delete
  - Su invia → delete
  - Fetch altri typing via realtime subscription su live_typing (filter giornata + user_id != me)
  - Render "Mario, Lucia stanno scrivendo..."

### Audio recording

- `MediaRecorder` API, codec `audio/webm;codecs=opus` (compatibile Chrome/Firefox/Safari recenti)
- Press-and-hold bottone microfono, rilascia per inviare, slide-up per annullare (come WhatsApp)
- Mostra waveform live durante registrazione (opzionale, canvas)
- Max 60s

### Moderazione admin

- Su ogni bubble user_*, long-press (o 3 dots menu) → "Nascondi"
- Setting `moderated=true` → il post appare solo all'admin con tag "Moderato"
- Un toggle "Mostra messaggi moderati" per admin nel header

## File structure

```
src/
├── lib/queries/
│   ├── livePost.ts
│   └── liveTyping.ts
├── features/live/
│   ├── LivePage.tsx
│   ├── LiveFeed.tsx           # lista bubble
│   ├── LiveBubble.tsx         # singolo post (switch su kind)
│   ├── LiveSystemBubble.tsx   # pill evento sistema
│   ├── LiveUserBubble.tsx     # testo/audio/foto utente
│   ├── LiveComposer.tsx       # input + bottoni
│   ├── TypingIndicator.tsx
│   ├── useAudioRecorder.ts
│   └── useTypingIndicator.ts
```

## Task

### T1 — Migration 0009 (tabelle + RLS + trigger sistema + bucket live-media)

File `supabase/migrations/0009_live_feed.sql`. Includi:
- CREATE TABLE live_post con constraint kind
- CREATE TABLE live_typing
- RLS policy come sopra
- Funzione + trigger `live_on_risultato_submit` su risultati_sezione AFTER UPDATE (quando stato passa a submitted)
- Funzione + trigger `live_on_foto_added` su foto_sezione AFTER INSERT
- Funzione + trigger `live_on_giornata_stato` su giornate_elettorali AFTER UPDATE (quando stato cambia)
- Bucket `live-media` + RLS storage.objects
- Add live_post e live_typing a realtime publication
- GRANT permessi

### T2 — Types + Query hooks

Aggiorna `database.types.ts` con `LivePostRow/Insert/Update`, `LiveTypingRow/Insert`.
`src/lib/queries/livePost.ts`: useLivePosts(giornataId, includeModerated), useCreateUserPost, useToggleModeration, useDeletePost.
`src/lib/queries/liveTyping.ts`: useTypingUsers(giornataId), useSetTyping, useClearTyping.

### T3 — UI components (LivePage + sub)

Componenti come elencati. Audio recorder con MediaRecorder, permissions, state machine idle/recording/saving.

### T4 — Routing + BottomNav

- Aggiungi `/live` route accessibile a tutti i ruoli.
- BottomNav: nuova voce "Live" visibile a tutti i ruoli (prima di Dashboard o dopo Home).
- Auto-redirect se nessuna giornata open: empty state + link a dashboard.

### T5 — Verifica + docker + tag

- tsc + test + build.
- Test manuale: 2 finestre (admin e editor). Editor scrive testo. Admin vede appare in tempo reale. Editor salva una sezione — appare system event. Editor carica foto — appare system event.
- Test audio: registra 5s messaggio vocale, invia, riproduci.
- Test moderazione: admin nasconde messaggio editor, editor non lo vede più.
- Tag `plan-07-live-feed-complete`.
