-- 0014_candidati_preferito.sql
-- Flag `preferito` su candidato. Un candidato è in una singola lista (quindi
-- una singola elezione), per cui un boolean sul candidato è sufficiente per
-- la semantica "preferiti per elezione".
-- Mutazione consentita solo agli admin (RLS candidati_mutate già lo impone).
-- Lettura consentita anche ad anon quando l'elezione è pubblica (RLS
-- candidati_select_anon di 0013).

BEGIN;

ALTER TABLE elemanager.candidati
  ADD COLUMN IF NOT EXISTS preferito boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS candidati_preferito_idx
  ON elemanager.candidati (preferito) WHERE preferito;

COMMIT;
