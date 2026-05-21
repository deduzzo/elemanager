-- 0013_rls_pubblica_anon.sql
-- Policy SELECT TO anon su tutte le tabelle necessarie alla dashboard
-- pubblica. Filtrate dall'appartenenza a un'elezione marcata pubblica
-- (tramite helper elezione_is_public / giornata_has_public).
-- Le policy esistenti TO authenticated restano vigenti.

BEGIN;

-- elezioni: anon vede solo quelle pubbliche
DROP POLICY IF EXISTS elezioni_select_anon ON elemanager.elezioni;
CREATE POLICY elezioni_select_anon ON elemanager.elezioni
  FOR SELECT TO anon
  USING (pubblica);

-- giornate_elettorali: anon vede le giornate che hanno almeno un'elezione pubblica
DROP POLICY IF EXISTS giornate_elettorali_select_anon ON elemanager.giornate_elettorali;
CREATE POLICY giornate_elettorali_select_anon ON elemanager.giornate_elettorali
  FOR SELECT TO anon
  USING (elemanager.giornata_has_public(id));

-- liste: anon vede liste di elezioni pubbliche
DROP POLICY IF EXISTS liste_select_anon ON elemanager.liste;
CREATE POLICY liste_select_anon ON elemanager.liste
  FOR SELECT TO anon
  USING (elemanager.elezione_is_public(elezione_id));

-- candidati: anon vede candidati di liste di elezioni pubbliche
DROP POLICY IF EXISTS candidati_select_anon ON elemanager.candidati;
CREATE POLICY candidati_select_anon ON elemanager.candidati
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM elemanager.liste l
     WHERE l.id = candidati.lista_id
       AND elemanager.elezione_is_public(l.elezione_id)
  ));

-- sezioni: anon vede sezioni della giornata in cui c'è un'elezione pubblica
DROP POLICY IF EXISTS sezioni_select_anon ON elemanager.sezioni;
CREATE POLICY sezioni_select_anon ON elemanager.sezioni
  FOR SELECT TO anon
  USING (elemanager.giornata_has_public(giornata_id));

-- risultati_sezione: anon vede risultati per elezioni pubbliche
DROP POLICY IF EXISTS risultati_select_anon ON elemanager.risultati_sezione;
CREATE POLICY risultati_select_anon ON elemanager.risultati_sezione
  FOR SELECT TO anon
  USING (elemanager.elezione_is_public(elezione_id));

-- voti_lista: anon vede solo quelli legati a risultati di elezioni pubbliche
DROP POLICY IF EXISTS voti_lista_select_anon ON elemanager.voti_lista;
CREATE POLICY voti_lista_select_anon ON elemanager.voti_lista
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM elemanager.risultati_sezione r
     WHERE r.id = voti_lista.risultato_sezione_id
       AND elemanager.elezione_is_public(r.elezione_id)
  ));

-- preferenze_candidato: idem
DROP POLICY IF EXISTS preferenze_candidato_select_anon ON elemanager.preferenze_candidato;
CREATE POLICY preferenze_candidato_select_anon ON elemanager.preferenze_candidato
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM elemanager.risultati_sezione r
     WHERE r.id = preferenze_candidato.risultato_sezione_id
       AND elemanager.elezione_is_public(r.elezione_id)
  ));

-- live_post: anon vede i post live delle giornate che hanno un'elezione pubblica
DROP POLICY IF EXISTS live_post_select_anon ON elemanager.live_post;
CREATE POLICY live_post_select_anon ON elemanager.live_post
  FOR SELECT TO anon
  USING (elemanager.giornata_has_public(giornata_id));

COMMIT;
