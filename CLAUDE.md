# CLAUDE.md — Elemanager

Istruzioni operative per Claude Code in questo repository. Vincolante (override delle default).

## Schema database = `elemanager` (NON `public`)

Tutte le tabelle dell'app vivono nello schema PostgreSQL **`elemanager`**, non in `public`. Lo spostamento è gestito dalla migration `supabase/migrations/0004_move_to_elemanager_schema.sql` (creata per isolare le tabelle da altri progetti sulla stessa istanza Supabase self-hosted).

### Conseguenze pratiche

1. **Frontend (`supabase-js`)**: il client va creato con `{ db: { schema: 'elemanager' } }`. Il client condiviso è in `src/lib/supabase.ts` e il wrapper tipizzato in `src/lib/queries/_db.ts` (`db` esporta un `SupabaseClient<DatabaseWithRel, 'elemanager'>`). **Usa sempre `db` dai query hooks, mai `supabase` direttamente** per evitare di puntare allo schema sbagliato.

2. **Edge Functions Supabase** (`supabase/functions/*`): ogni `createClient(url, key, ...)` deve passare `db: { schema: 'elemanager' }`. Senza, PostgREST risponde `PGRST205 "Could not find the table 'public.<nome>' in the schema cache"`. Esempio:
   ```ts
   const admin = createClient(url, serviceKey, {
     auth: { persistSession: false, autoRefreshToken: false },
     db: { schema: 'elemanager' },
   });
   ```

3. **PostgREST server-side**: l'istanza Supabase self-hosted deve avere `PGRST_DB_SCHEMAS` che include `elemanager` (nel `.env` del docker-compose di Supabase). Senza questo, anche col client corretto le richieste falliscono con 404.

4. **SQL diretto / RPC**: riferimenti `FROM nomeTabella` senza prefisso devono essere preceduti da `SET search_path TO elemanager, public;` o usare il prefisso esplicito `elemanager.nomeTabella`. Le funzioni create dal progetto sono già in schema `elemanager` (`elemanager.is_admin()`, `elemanager.auth_role()`, ecc.).

### Diagnostica errore PGRST205

Se compare `"Could not find the table 'public.<nome>' in the schema cache"`:
- 99% delle volte è un client (frontend o edge function) che non passa `db: { schema: 'elemanager' }`.
- Non è un problema di cache di PostgREST — è il client che chiede lo schema sbagliato.
- **Non** rimediare applicando le migration in `public`: rifaresti la confusione che ha portato a 0004 nel primo posto.

### Bootstrap nuova istanza Supabase

Per una istanza pulita, applicare in ordine `0001_init_schema.sql` → `0010_voti_presunti.sql` via `scripts/apply-migration.mjs supabase/migrations/`. Le prime 3 creano tutto in `public`, la 0004 sposta in `elemanager`, le successive lavorano già su `elemanager`. Se 0004 fallisce con `"relation already exists in schema elemanager"`, significa che lo schema `elemanager` esisteva già: bisogna prima fare il drop delle tabelle vuote in `public` (sono i doppioni di 0001-0003) e poi ripartire da 0005.

## Deploy

- **Frontend**: GitHub Pages — push su `main` → workflow `.github/workflows/deploy.yml` builda con `VITE_BASE_PATH=/elemanager/` e pubblica su https://deduzzo.github.io/elemanager/. I secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` sono già configurati nel repo.
- **Edge Functions**: deployate manualmente sul Supabase self-hosted. Repo Supabase Docker su `/home/deduzzo/supabase/docker/` (server `deduzzo@server.robertodedomenico.it`), volume functions in `volumes/functions/<nome>/index.ts`. Restart con `docker restart supabase-edge-functions`.

## Migration Supabase

Standing permission per applicare migration via `POST /pg/query` con `service_role` (vedi auto-memory `feedback_migration_supabase`). Pre-check con REST + post-check obbligatori. Le migration sono in `supabase/migrations/`, applicate con `node scripts/apply-migration.mjs supabase/migrations/<file>`.

DROP TABLE / TRUNCATE / DELETE WITHOUT WHERE su tabelle popolate richiedono comunque conferma esplicita.
