-- 0015_live_post_cleanup_on_delete.sql
-- Cancella automaticamente i live_post di sistema quando viene cancellata
-- la riga (risultato_sezione o foto_sezione) a cui si riferiscono.
-- Risolve il caso "feed live mostra ancora la notifica dopo che ho azzerato
-- i voti della sezione".
--
-- Inoltre fa cleanup batch dei live_post già orfani (riferimenti a righe
-- non più esistenti) lasciati da operazioni precedenti.

BEGIN;

-- 1) Trigger: quando si cancella un risultato_sezione, rimuovi i live_post
--    che lo referenziano (system_section_complete, system_vote_update).
CREATE OR REPLACE FUNCTION elemanager.live_on_risultato_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
BEGIN
  DELETE FROM elemanager.live_post
   WHERE ref_table = 'risultati_sezione'
     AND ref_id = OLD.id::text;
  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS trg_live_risultato_delete ON elemanager.risultati_sezione;
CREATE TRIGGER trg_live_risultato_delete
  AFTER DELETE ON elemanager.risultati_sezione
  FOR EACH ROW EXECUTE FUNCTION elemanager.live_on_risultato_delete();

-- 2) Trigger: quando si cancella una foto_sezione, rimuovi il live_post
--    system_photo_added corrispondente.
CREATE OR REPLACE FUNCTION elemanager.live_on_foto_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
BEGIN
  DELETE FROM elemanager.live_post
   WHERE ref_table = 'foto_sezione'
     AND ref_id = OLD.id::text;
  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS trg_live_foto_delete ON elemanager.foto_sezione;
CREATE TRIGGER trg_live_foto_delete
  AFTER DELETE ON elemanager.foto_sezione
  FOR EACH ROW EXECUTE FUNCTION elemanager.live_on_foto_delete();

-- 3) Cleanup orfani esistenti.
DELETE FROM elemanager.live_post lp
 WHERE lp.ref_table = 'risultati_sezione'
   AND NOT EXISTS (
     SELECT 1 FROM elemanager.risultati_sezione r
      WHERE r.id::text = lp.ref_id
   );

DELETE FROM elemanager.live_post lp
 WHERE lp.ref_table = 'foto_sezione'
   AND NOT EXISTS (
     SELECT 1 FROM elemanager.foto_sezione f
      WHERE f.id::text = lp.ref_id
   );

COMMIT;
