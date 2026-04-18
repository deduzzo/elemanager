-- Seed dev: 1 giornata in stato 'draft' per Messina 2026.
-- Per un admin di test, esegui ANCHE scripts/create_admin.sql dopo aver creato un utente in auth.
INSERT INTO public.giornate_elettorali (nome, data, comune, stato)
VALUES ('Comunali Messina 2026 — demo', '2026-05-25', 'Messina', 'draft')
ON CONFLICT DO NOTHING;
