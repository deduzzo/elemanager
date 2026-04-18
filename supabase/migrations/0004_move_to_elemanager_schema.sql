-- 0004_move_to_elemanager_schema.sql
-- Sposta tutte le tabelle dell'app dallo schema public a uno schema dedicato "elemanager"
-- per isolamento da altri progetti sulla stessa istanza Supabase self-hosted.
--
-- PRECONDIZIONE POSTGREST (server-side): aggiungere "elemanager" a PGRST_DB_SCHEMAS
-- nel docker-compose .env della tua istanza Supabase, poi `docker compose restart rest`
-- (o il nome del servizio PostgREST). Senza questo, il client Supabase JS non vede lo schema.

BEGIN;

CREATE SCHEMA IF NOT EXISTS elemanager;

-- Move tables (ALTER TABLE SET SCHEMA preserva dati, FK, indici, CHECK, UNIQUE, defaults,
-- e porta con sé le policy RLS e i trigger attaccati alla tabella).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','giornate_elettorali','elezioni','liste','candidati',
    'sezioni','risultati_sezione','voti_lista','preferenze_candidato','audit_log'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA elemanager', t);
    END IF;
  END LOOP;
END
$$;

-- Drop old functions (CASCADE rimuove policy e trigger dipendenti, che ricreiamo sotto)
DROP FUNCTION IF EXISTS public.auth_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.giornata_is_open(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.trg_audit() CASCADE;

-- Ricrea funzioni dentro schema elemanager
CREATE OR REPLACE FUNCTION elemanager.auth_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = elemanager, auth AS $$
  SELECT ruolo FROM elemanager.profiles WHERE id = auth.uid() AND attivo
$$;

CREATE OR REPLACE FUNCTION elemanager.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = elemanager, auth AS $$
  SELECT COALESCE(elemanager.auth_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION elemanager.giornata_is_open(p_giornata_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT stato = 'open' FROM elemanager.giornate_elettorali WHERE id = p_giornata_id
$$;

CREATE OR REPLACE FUNCTION elemanager.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION elemanager.trg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, auth AS $$
DECLARE
  v_email text;
  v_record_id text;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  IF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;
  INSERT INTO elemanager.audit_log(actor_id, actor_email, azione, tabella, record_id, diff)
  VALUES (auth.uid(), v_email, TG_OP, TG_TABLE_NAME, v_record_id, v_diff);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

-- Ricrea trigger (dropped da CASCADE)
DROP TRIGGER IF EXISTS trg_risultati_updated ON elemanager.risultati_sezione;
CREATE TRIGGER trg_risultati_updated
  BEFORE UPDATE ON elemanager.risultati_sezione
  FOR EACH ROW EXECUTE FUNCTION elemanager.set_updated_at();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['risultati_sezione','voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON elemanager.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON elemanager.%I
       FOR EACH ROW EXECUTE FUNCTION elemanager.trg_audit()', t, t);
  END LOOP;
END
$$;

-- Assicura RLS abilitato (è conservato da SET SCHEMA ma questo DDL è idempotente)
ALTER TABLE elemanager.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.giornate_elettorali ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.elezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.liste ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.candidati ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.sezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.risultati_sezione ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.voti_lista ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.preferenze_candidato ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemanager.audit_log ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_select ON elemanager.profiles;
CREATE POLICY profiles_select ON elemanager.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS profiles_mutate ON elemanager.profiles;
CREATE POLICY profiles_mutate ON elemanager.profiles FOR ALL TO authenticated
  USING (elemanager.is_admin()) WITH CHECK (elemanager.is_admin());

-- Config tables: select authenticated; mutate admin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['giornate_elettorali','elezioni','liste','candidati','sezioni'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON elemanager.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON elemanager.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON elemanager.%I', t, t);
    EXECUTE format('CREATE POLICY %I_mutate ON elemanager.%I FOR ALL TO authenticated USING (elemanager.is_admin()) WITH CHECK (elemanager.is_admin())', t, t);
  END LOOP;
END
$$;

-- risultati_sezione
DROP POLICY IF EXISTS risultati_select ON elemanager.risultati_sezione;
CREATE POLICY risultati_select ON elemanager.risultati_sezione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS risultati_insert ON elemanager.risultati_sezione;
CREATE POLICY risultati_insert ON elemanager.risultati_sezione
  FOR INSERT TO authenticated
  WITH CHECK (
    elemanager.is_admin() OR (
      elemanager.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND elemanager.giornata_is_open((SELECT giornata_id FROM elemanager.sezioni WHERE id = sezione_id))
    )
  );

DROP POLICY IF EXISTS risultati_update ON elemanager.risultati_sezione;
CREATE POLICY risultati_update ON elemanager.risultati_sezione
  FOR UPDATE TO authenticated
  USING (
    elemanager.is_admin() OR (
      elemanager.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  )
  WITH CHECK (
    elemanager.is_admin() OR (
      elemanager.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  );

DROP POLICY IF EXISTS risultati_delete ON elemanager.risultati_sezione;
CREATE POLICY risultati_delete ON elemanager.risultati_sezione
  FOR DELETE TO authenticated USING (elemanager.is_admin());

-- voti_lista + preferenze_candidato
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON elemanager.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON elemanager.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON elemanager.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_mutate ON elemanager.%I FOR ALL TO authenticated
       USING (
         elemanager.is_admin() OR EXISTS (
           SELECT 1 FROM elemanager.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND elemanager.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )
       WITH CHECK (
         elemanager.is_admin() OR EXISTS (
           SELECT 1 FROM elemanager.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND elemanager.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )', t, t, t, t);
  END LOOP;
END
$$;

-- audit_log
DROP POLICY IF EXISTS audit_select ON elemanager.audit_log;
CREATE POLICY audit_select ON elemanager.audit_log
  FOR SELECT TO authenticated USING (elemanager.is_admin());

-- Grants perché PostgREST (ruoli anon/authenticated/service_role) acceda allo schema
GRANT USAGE ON SCHEMA elemanager TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA elemanager TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA elemanager TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA elemanager TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA elemanager GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA elemanager GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA elemanager GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

COMMIT;
