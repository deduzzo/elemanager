-- 0012_elezione_pubblica.sql
-- Flag `pubblica` su elezioni + helper functions per le policy RLS
-- che abilitano la lettura agli utenti anonimi (vedi 0013).

BEGIN;

ALTER TABLE elemanager.elezioni
  ADD COLUMN IF NOT EXISTS pubblica boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS elezioni_pubblica_idx
  ON elemanager.elezioni (pubblica) WHERE pubblica;

CREATE OR REPLACE FUNCTION elemanager.elezione_is_public(p_elezione_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = elemanager AS $$
  SELECT COALESCE(pubblica, false)
    FROM elemanager.elezioni
   WHERE id = p_elezione_id
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

GRANT EXECUTE ON FUNCTION elemanager.elezione_is_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION elemanager.giornata_has_public(uuid) TO anon, authenticated;

COMMIT;
