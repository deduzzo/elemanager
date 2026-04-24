-- 0010_voti_presunti.sql
-- Tabella voti_presunti (stime di campagna per candidato, opzionalmente per sezione).
-- RLS admin-only su tutte le operazioni.

BEGIN;

CREATE TABLE IF NOT EXISTS elemanager.voti_presunti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid NOT NULL REFERENCES elemanager.candidati(id) ON DELETE CASCADE,
  sezione_id uuid REFERENCES elemanager.sezioni(id) ON DELETE CASCADE,
  voti int NOT NULL CHECK (voti >= 0),
  created_by uuid REFERENCES elemanager.profiles(id),
  updated_by uuid REFERENCES elemanager.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indici unici parziali: NULL non si uguaglia a NULL, quindi serve uno split.
CREATE UNIQUE INDEX IF NOT EXISTS voti_presunti_totale_uq
  ON elemanager.voti_presunti (candidato_id)
  WHERE sezione_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS voti_presunti_sezione_uq
  ON elemanager.voti_presunti (candidato_id, sezione_id)
  WHERE sezione_id IS NOT NULL;

-- Indici di lettura
CREATE INDEX IF NOT EXISTS voti_presunti_candidato_idx
  ON elemanager.voti_presunti (candidato_id);
CREATE INDEX IF NOT EXISTS voti_presunti_sezione_idx
  ON elemanager.voti_presunti (sezione_id)
  WHERE sezione_id IS NOT NULL;

-- Trigger coerenza giornata: la sezione_id.giornata_id deve coincidere con
-- candidato_id → lista → elezione → giornata_id.
CREATE OR REPLACE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  giornata_candidato uuid;
  giornata_sezione uuid;
BEGIN
  IF NEW.sezione_id IS NULL THEN
    RETURN NEW;
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
    RAISE EXCEPTION
      'candidato % e sezione % appartengono a giornate diverse',
      NEW.candidato_id, NEW.sezione_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS voti_presunti_coerenza_giornata
  ON elemanager.voti_presunti;
CREATE TRIGGER voti_presunti_coerenza_giornata
  BEFORE INSERT OR UPDATE ON elemanager.voti_presunti
  FOR EACH ROW
  EXECUTE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata();

-- Trigger updated_at (riusa set_updated_at definito in 0004).
DROP TRIGGER IF EXISTS trg_voti_presunti_updated ON elemanager.voti_presunti;
CREATE TRIGGER trg_voti_presunti_updated
  BEFORE UPDATE ON elemanager.voti_presunti
  FOR EACH ROW EXECUTE FUNCTION elemanager.set_updated_at();

-- Trigger audit (riusa trg_audit definito in 0004).
DROP TRIGGER IF EXISTS trg_audit_voti_presunti ON elemanager.voti_presunti;
CREATE TRIGGER trg_audit_voti_presunti
  AFTER INSERT OR UPDATE OR DELETE ON elemanager.voti_presunti
  FOR EACH ROW EXECUTE FUNCTION elemanager.trg_audit();

-- RLS admin-only
ALTER TABLE elemanager.voti_presunti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voti_presunti_admin_select ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_select ON elemanager.voti_presunti
  FOR SELECT TO authenticated USING (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_insert ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_insert ON elemanager.voti_presunti
  FOR INSERT TO authenticated WITH CHECK (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_update ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_update ON elemanager.voti_presunti
  FOR UPDATE TO authenticated
  USING (elemanager.is_admin())
  WITH CHECK (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_delete ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_delete ON elemanager.voti_presunti
  FOR DELETE TO authenticated USING (elemanager.is_admin());

-- Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.voti_presunti;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;

ALTER TABLE elemanager.voti_presunti REPLICA IDENTITY FULL;

COMMIT;
