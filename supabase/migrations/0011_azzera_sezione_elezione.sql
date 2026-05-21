-- 0011_azzera_sezione_elezione.sql
-- Due RPC admin-only per azzerare i dati di una sezione per una specifica elezione.
-- 1) reset_voti_effettivi_sezione_elezione: cancella risultati_sezione (cascade su
--    voti_lista e preferenze_candidato) e foto_sezione, restituendo gli storage_path
--    delle foto cancellate per consentire al client la pulizia del bucket Supabase
--    Storage 'sezioni-photos'.
-- 2) reset_voti_presunti_sezione_elezione: cancella le righe voti_presunti per la
--    sezione e i candidati appartenenti a liste della elezione indicata, lasciando
--    intatti i totali globali (sezione_id IS NULL).
--
-- Entrambe SECURITY DEFINER con check is_admin() esplicito nel body (difesa in
-- profondità rispetto alle RLS).

BEGIN;

CREATE OR REPLACE FUNCTION elemanager.reset_voti_effettivi_sezione_elezione(
  p_sezione_id  uuid,
  p_elezione_id uuid
) RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = elemanager, public, auth
AS $$
DECLARE
  v_paths text[];
BEGIN
  IF NOT elemanager.is_admin() THEN
    RAISE EXCEPTION 'admin role required'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO v_paths
    FROM elemanager.foto_sezione
   WHERE sezione_id  = p_sezione_id
     AND elezione_id = p_elezione_id;

  DELETE FROM elemanager.foto_sezione
   WHERE sezione_id  = p_sezione_id
     AND elezione_id = p_elezione_id;

  -- cascade su voti_lista e preferenze_candidato
  DELETE FROM elemanager.risultati_sezione
   WHERE sezione_id  = p_sezione_id
     AND elezione_id = p_elezione_id;

  RETURN v_paths;
END
$$;

CREATE OR REPLACE FUNCTION elemanager.reset_voti_presunti_sezione_elezione(
  p_sezione_id  uuid,
  p_elezione_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = elemanager, public, auth
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT elemanager.is_admin() THEN
    RAISE EXCEPTION 'admin role required'
      USING ERRCODE = '42501';
  END IF;

  WITH del AS (
    DELETE FROM elemanager.voti_presunti
     WHERE sezione_id = p_sezione_id
       AND candidato_id IN (
         SELECT c.id
           FROM elemanager.candidati c
           JOIN elemanager.liste     l ON l.id = c.lista_id
          WHERE l.elezione_id = p_elezione_id
       )
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM del;

  RETURN v_count;
END
$$;

-- Grants: il client le invoca con JWT authenticated; il check is_admin() nel body
-- garantisce che solo gli admin riescano effettivamente a eseguirle.
GRANT EXECUTE ON FUNCTION elemanager.reset_voti_effettivi_sezione_elezione(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION elemanager.reset_voti_presunti_sezione_elezione(uuid, uuid)
  TO authenticated;

COMMIT;
