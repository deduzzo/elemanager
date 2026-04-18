-- 0005_realtime_publication.sql
-- Abilita Supabase Realtime (postgres_changes) sulle tabelle applicative.
-- RLS continua a filtrare gli eventi per ogni client subscribed.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'giornate_elettorali','elezioni','liste','candidati','sezioni',
    'risultati_sezione','voti_lista','preferenze_candidato','profiles'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END
$$;

-- Imposta REPLICA IDENTITY FULL così UPDATE/DELETE pubblicano l'intero OLD row
-- (utile per diff lato client).
ALTER TABLE elemanager.giornate_elettorali REPLICA IDENTITY FULL;
ALTER TABLE elemanager.elezioni REPLICA IDENTITY FULL;
ALTER TABLE elemanager.liste REPLICA IDENTITY FULL;
ALTER TABLE elemanager.candidati REPLICA IDENTITY FULL;
ALTER TABLE elemanager.sezioni REPLICA IDENTITY FULL;
ALTER TABLE elemanager.risultati_sezione REPLICA IDENTITY FULL;
ALTER TABLE elemanager.voti_lista REPLICA IDENTITY FULL;
ALTER TABLE elemanager.preferenze_candidato REPLICA IDENTITY FULL;
ALTER TABLE elemanager.profiles REPLICA IDENTITY FULL;
