-- 0009_live_feed.sql
-- Tabelle live_post + live_typing, RLS, trigger sistema per eventi auto-generati, bucket live-media.

-- === Tabella live_post ===
CREATE TABLE IF NOT EXISTS elemanager.live_post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES elemanager.giornate_elettorali(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'user_text', 'user_audio', 'user_photo',
    'system_vote_update', 'system_photo_added',
    'system_section_complete', 'system_giornata_update',
    'system_custom'
  )),
  author_id uuid REFERENCES elemanager.profiles(id) ON DELETE SET NULL,
  author_nome text,
  content text,
  media_path text,
  media_mime text,
  media_duration int,
  ref_table text,
  ref_id text,
  ref_url text,
  metadata jsonb,
  moderated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_post_giornata_created_idx ON elemanager.live_post(giornata_id, created_at DESC);
CREATE INDEX IF NOT EXISTS live_post_author_idx ON elemanager.live_post(author_id);

ALTER TABLE elemanager.live_post ENABLE ROW LEVEL SECURITY;

-- SELECT: tutti authenticated vedono non-moderated; admin vede tutto
DROP POLICY IF EXISTS live_post_select ON elemanager.live_post;
CREATE POLICY live_post_select ON elemanager.live_post
  FOR SELECT TO authenticated
  USING (moderated = false OR elemanager.is_admin());

-- INSERT: authenticated può inserire user_* kinds come sé stesso; system_* solo via trigger SECURITY DEFINER
DROP POLICY IF EXISTS live_post_insert_user ON elemanager.live_post;
CREATE POLICY live_post_insert_user ON elemanager.live_post
  FOR INSERT TO authenticated
  WITH CHECK (
    kind IN ('user_text', 'user_audio', 'user_photo')
    AND author_id = auth.uid()
  );

-- UPDATE: admin modera qualunque cosa; autore può editare content entro 2 minuti (su kind user_text)
DROP POLICY IF EXISTS live_post_update ON elemanager.live_post;
CREATE POLICY live_post_update ON elemanager.live_post
  FOR UPDATE TO authenticated
  USING (
    elemanager.is_admin()
    OR (author_id = auth.uid() AND kind = 'user_text' AND created_at > now() - interval '2 minutes')
  )
  WITH CHECK (
    elemanager.is_admin()
    OR (author_id = auth.uid() AND kind = 'user_text')
  );

-- DELETE: solo admin
DROP POLICY IF EXISTS live_post_delete ON elemanager.live_post;
CREATE POLICY live_post_delete ON elemanager.live_post
  FOR DELETE TO authenticated USING (elemanager.is_admin());

-- === Tabella live_typing ===
CREATE TABLE IF NOT EXISTS elemanager.live_typing (
  giornata_id uuid NOT NULL REFERENCES elemanager.giornate_elettorali(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES elemanager.profiles(id) ON DELETE CASCADE,
  nome text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giornata_id, user_id)
);
CREATE INDEX IF NOT EXISTS live_typing_giornata_idx ON elemanager.live_typing(giornata_id, started_at DESC);

ALTER TABLE elemanager.live_typing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_typing_select ON elemanager.live_typing;
CREATE POLICY live_typing_select ON elemanager.live_typing
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS live_typing_mutate ON elemanager.live_typing;
CREATE POLICY live_typing_mutate ON elemanager.live_typing
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- === Helper: inserisci system post ===
CREATE OR REPLACE FUNCTION elemanager.live_insert_system(
  p_giornata_id uuid,
  p_kind text,
  p_content text,
  p_ref_table text DEFAULT NULL,
  p_ref_id text DEFAULT NULL,
  p_ref_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
BEGIN
  INSERT INTO elemanager.live_post(giornata_id, kind, content, ref_table, ref_id, ref_url, metadata)
  VALUES (p_giornata_id, p_kind, p_content, p_ref_table, p_ref_id, p_ref_url, p_metadata);
END
$$;

-- === Trigger: risultato_sezione → system_section_complete ===
CREATE OR REPLACE FUNCTION elemanager.live_on_risultato_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
DECLARE
  v_sezione_numero int;
  v_giornata_id uuid;
  v_elezione_nome text;
  v_content text;
  v_ref_url text;
BEGIN
  -- Solo quando stato diventa 'submitted' (su INSERT con stato=submitted, o UPDATE che cambia stato→submitted)
  IF TG_OP = 'INSERT' AND NEW.stato = 'submitted' THEN
    -- ok, evento
  ELSIF TG_OP = 'UPDATE' AND NEW.stato = 'submitted' AND (OLD.stato IS DISTINCT FROM 'submitted') THEN
    -- ok, evento
  ELSE
    RETURN NEW;
  END IF;

  SELECT s.numero, s.giornata_id INTO v_sezione_numero, v_giornata_id
  FROM elemanager.sezioni s WHERE s.id = NEW.sezione_id;

  SELECT nome INTO v_elezione_nome FROM elemanager.elezioni WHERE id = NEW.elezione_id;

  v_content := format('Sezione %s completata per "%s"', v_sezione_numero, COALESCE(v_elezione_nome, 'elezione'));
  v_ref_url := format('/admin/giornate/%s', v_giornata_id);

  PERFORM elemanager.live_insert_system(
    v_giornata_id,
    'system_section_complete',
    v_content,
    'risultati_sezione',
    NEW.id::text,
    v_ref_url,
    jsonb_build_object(
      'sezione_numero', v_sezione_numero,
      'elezione_nome', v_elezione_nome,
      'sezione_id', NEW.sezione_id,
      'elezione_id', NEW.elezione_id
    )
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_live_risultato ON elemanager.risultati_sezione;
CREATE TRIGGER trg_live_risultato
  AFTER INSERT OR UPDATE ON elemanager.risultati_sezione
  FOR EACH ROW EXECUTE FUNCTION elemanager.live_on_risultato_change();

-- === Trigger: foto_sezione INSERT → system_photo_added ===
CREATE OR REPLACE FUNCTION elemanager.live_on_foto_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
DECLARE
  v_sezione_numero int;
  v_giornata_id uuid;
  v_uploader_nome text;
  v_content text;
BEGIN
  SELECT s.numero, s.giornata_id INTO v_sezione_numero, v_giornata_id
  FROM elemanager.sezioni s WHERE s.id = NEW.sezione_id;

  SELECT nome INTO v_uploader_nome FROM elemanager.profiles WHERE id = NEW.uploaded_by;

  v_content := format('%s ha aggiunto una foto alla sezione %s',
    COALESCE(v_uploader_nome, 'Un utente'), v_sezione_numero);

  PERFORM elemanager.live_insert_system(
    v_giornata_id,
    'system_photo_added',
    v_content,
    'foto_sezione',
    NEW.id::text,
    format('/editor/giornate/%s/sezioni/%s', v_giornata_id, NEW.sezione_id),
    jsonb_build_object(
      'sezione_numero', v_sezione_numero,
      'sezione_id', NEW.sezione_id,
      'storage_path', NEW.storage_path,
      'uploader_nome', v_uploader_nome
    )
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_live_foto ON elemanager.foto_sezione;
CREATE TRIGGER trg_live_foto
  AFTER INSERT ON elemanager.foto_sezione
  FOR EACH ROW EXECUTE FUNCTION elemanager.live_on_foto_added();

-- === Trigger: giornata stato change → system_giornata_update ===
CREATE OR REPLACE FUNCTION elemanager.live_on_giornata_stato() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = elemanager, public AS $$
DECLARE
  v_content text;
BEGIN
  IF NEW.stato IS DISTINCT FROM OLD.stato THEN
    v_content := format('Giornata "%s" passata allo stato "%s"', NEW.nome, NEW.stato);
    PERFORM elemanager.live_insert_system(
      NEW.id,
      'system_giornata_update',
      v_content,
      'giornate_elettorali',
      NEW.id::text,
      format('/admin/giornate/%s', NEW.id),
      jsonb_build_object('stato', NEW.stato, 'stato_precedente', OLD.stato)
    );
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_live_giornata ON elemanager.giornate_elettorali;
CREATE TRIGGER trg_live_giornata
  AFTER UPDATE ON elemanager.giornate_elettorali
  FOR EACH ROW EXECUTE FUNCTION elemanager.live_on_giornata_stato();

-- === Realtime publication ===
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.live_post;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.live_typing;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE elemanager.live_post REPLICA IDENTITY FULL;
ALTER TABLE elemanager.live_typing REPLICA IDENTITY FULL;

-- Grants
GRANT ALL ON elemanager.live_post TO anon, authenticated, service_role;
GRANT ALL ON elemanager.live_typing TO anon, authenticated, service_role;

-- === Bucket live-media ===
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-media',
  'live-media',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS
DROP POLICY IF EXISTS "live_media_read" ON storage.objects;
CREATE POLICY "live_media_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'live-media');

DROP POLICY IF EXISTS "live_media_insert" ON storage.objects;
CREATE POLICY "live_media_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'live-media');

DROP POLICY IF EXISTS "live_media_delete" ON storage.objects;
CREATE POLICY "live_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'live-media' AND (elemanager.is_admin() OR owner = auth.uid()));
