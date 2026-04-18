-- 0008_foto_sezione.sql
-- Tabella metadata foto + bucket Supabase Storage + RLS.

CREATE TABLE IF NOT EXISTS elemanager.foto_sezione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sezione_id uuid NOT NULL REFERENCES elemanager.sezioni(id) ON DELETE CASCADE,
  elezione_id uuid REFERENCES elemanager.elezioni(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  descrizione text,
  width int,
  height int,
  bytes int,
  uploaded_by uuid REFERENCES elemanager.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS foto_sezione_sezione_idx ON elemanager.foto_sezione(sezione_id);
CREATE INDEX IF NOT EXISTS foto_sezione_elezione_idx ON elemanager.foto_sezione(elezione_id);
CREATE INDEX IF NOT EXISTS foto_sezione_uploaded_by_idx ON elemanager.foto_sezione(uploaded_by);

ALTER TABLE elemanager.foto_sezione ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS foto_select ON elemanager.foto_sezione;
CREATE POLICY foto_select ON elemanager.foto_sezione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS foto_insert ON elemanager.foto_sezione;
CREATE POLICY foto_insert ON elemanager.foto_sezione
  FOR INSERT TO authenticated
  WITH CHECK (
    elemanager.is_admin() OR (
      elemanager.auth_role() = 'editor'
      AND uploaded_by = auth.uid()
      AND elemanager.giornata_is_open((SELECT giornata_id FROM elemanager.sezioni WHERE id = sezione_id))
    )
  );

DROP POLICY IF EXISTS foto_update ON elemanager.foto_sezione;
CREATE POLICY foto_update ON elemanager.foto_sezione
  FOR UPDATE TO authenticated
  USING (elemanager.is_admin() OR uploaded_by = auth.uid())
  WITH CHECK (elemanager.is_admin() OR uploaded_by = auth.uid());

DROP POLICY IF EXISTS foto_delete ON elemanager.foto_sezione;
CREATE POLICY foto_delete ON elemanager.foto_sezione
  FOR DELETE TO authenticated
  USING (elemanager.is_admin() OR uploaded_by = auth.uid());

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.foto_sezione;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE elemanager.foto_sezione REPLICA IDENTITY FULL;

-- Grant per PostgREST
GRANT ALL ON elemanager.foto_sezione TO anon, authenticated, service_role;

-- Bucket Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sezioni-photos', 'sezioni-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS
DROP POLICY IF EXISTS "sezioni_photos_read" ON storage.objects;
CREATE POLICY "sezioni_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sezioni-photos');

DROP POLICY IF EXISTS "sezioni_photos_insert" ON storage.objects;
CREATE POLICY "sezioni_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sezioni-photos');

DROP POLICY IF EXISTS "sezioni_photos_delete" ON storage.objects;
CREATE POLICY "sezioni_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sezioni-photos' AND (elemanager.is_admin() OR owner = auth.uid()));
