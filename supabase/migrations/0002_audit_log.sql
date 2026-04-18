-- 0002_audit_log.sql
-- Audit log e trigger su tabelle voti.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  actor_email text,
  azione text NOT NULL CHECK (azione IN ('INSERT','UPDATE','DELETE')),
  tabella text NOT NULL,
  record_id text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tabella_idx ON public.audit_log(tabella, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_email text;
  v_record_id text;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;

  IF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_email, azione, tabella, record_id, diff)
  VALUES (auth.uid(), v_email, TG_OP, TG_TABLE_NAME, v_record_id, v_diff);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['risultati_sezione','voti_lista','preferenze_candidato'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_audit()', t, t);
  END LOOP;
END
$$;
