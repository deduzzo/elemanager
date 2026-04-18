-- 0003_rls_policies.sql
-- Helper + RLS per ruoli admin/editor/viewer.

CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth AS $$
  SELECT ruolo FROM public.profiles WHERE id = auth.uid() AND attivo
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth AS $$
  SELECT COALESCE(public.auth_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.giornata_is_open(p_giornata_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT stato = 'open' FROM public.giornate_elettorali WHERE id = p_giornata_id
$$;

-- Enable RLS su tutte le tabelle applicative
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giornate_elettorali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidati ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sezioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risultati_sezione ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voti_lista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferenze_candidato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS profiles_mutate ON public.profiles;
CREATE POLICY profiles_mutate ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Config tables (select authenticated; mutate admin)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['giornate_elettorali','elezioni','liste','candidati','sezioni'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_mutate ON public.%I FOR ALL TO authenticated
       USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
  END LOOP;
END
$$;

-- risultati_sezione
DROP POLICY IF EXISTS risultati_select ON public.risultati_sezione;
CREATE POLICY risultati_select ON public.risultati_sezione
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS risultati_insert ON public.risultati_sezione;
CREATE POLICY risultati_insert ON public.risultati_sezione
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND public.giornata_is_open((SELECT giornata_id FROM public.sezioni WHERE id = sezione_id))
    )
  );

DROP POLICY IF EXISTS risultati_update ON public.risultati_sezione;
CREATE POLICY risultati_update ON public.risultati_sezione
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  )
  WITH CHECK (
    public.is_admin() OR (
      public.auth_role() = 'editor'
      AND created_by = auth.uid()
      AND stato <> 'verified'
    )
  );

DROP POLICY IF EXISTS risultati_delete ON public.risultati_sezione;
CREATE POLICY risultati_delete ON public.risultati_sezione
  FOR DELETE TO authenticated USING (public.is_admin());

-- voti_lista e preferenze_candidato: admin full; editor solo via risultati proprio non verified
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_mutate ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_mutate ON public.%I FOR ALL TO authenticated
       USING (
         public.is_admin() OR EXISTS (
           SELECT 1 FROM public.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND public.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )
       WITH CHECK (
         public.is_admin() OR EXISTS (
           SELECT 1 FROM public.risultati_sezione r
           WHERE r.id = %I.risultato_sezione_id
             AND public.auth_role() = ''editor''
             AND r.created_by = auth.uid()
             AND r.stato <> ''verified''
         )
       )', t, t, t, t);
  END LOOP;
END
$$;

-- audit_log: SELECT solo admin
DROP POLICY IF EXISTS audit_select ON public.audit_log;
CREATE POLICY audit_select ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
