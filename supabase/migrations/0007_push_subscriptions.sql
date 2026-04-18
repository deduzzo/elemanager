-- 0007_push_subscriptions.sql
-- Tabella per Web Push subscriptions (Level 2 - notifiche con tab chiusa).
-- Ogni device/browser crea una subscription univoca tramite endpoint.

CREATE TABLE IF NOT EXISTS elemanager.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES elemanager.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON elemanager.push_subscriptions(user_id);

ALTER TABLE elemanager.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: utente vede solo le proprie; admin vede tutte
DROP POLICY IF EXISTS push_select ON elemanager.push_subscriptions;
CREATE POLICY push_select ON elemanager.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR elemanager.is_admin());

-- INSERT: utente inserisce solo per sé
DROP POLICY IF EXISTS push_insert ON elemanager.push_subscriptions;
CREATE POLICY push_insert ON elemanager.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: utente cancella solo le proprie; admin può cancellare qualsiasi
DROP POLICY IF EXISTS push_delete ON elemanager.push_subscriptions;
CREATE POLICY push_delete ON elemanager.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR elemanager.is_admin());

-- UPDATE non serve: ricrea sottoscrizione se cambia device
GRANT ALL ON elemanager.push_subscriptions TO anon, authenticated, service_role;
