-- Da eseguire nel SQL Editor di Supabase Studio DOPO aver creato un utente
-- via dashboard (Authentication → Users → Invite user / Add user).
-- Sostituisci <UUID> con l'id dell'utente creato e <Nome visualizzato> con il nome.
INSERT INTO public.profiles (id, nome, ruolo)
VALUES ('<UUID>', '<Nome visualizzato>', 'admin')
ON CONFLICT (id) DO UPDATE SET
  ruolo = EXCLUDED.ruolo,
  nome = EXCLUDED.nome,
  attivo = true;
