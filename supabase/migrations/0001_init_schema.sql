-- 0001_init_schema.sql
-- Schema base Elemanager: profili, giornate, elezioni, liste, candidati, sezioni, risultati.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles: estende auth.users con ruolo applicativo
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ruolo text NOT NULL CHECK (ruolo IN ('admin','editor','viewer')),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Giornate elettorali (un contenitore per elezioni contemporanee)
CREATE TABLE IF NOT EXISTS public.giornate_elettorali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data date NOT NULL,
  stato text NOT NULL DEFAULT 'draft' CHECK (stato IN ('draft','open','closed')),
  comune text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Elezioni dentro una giornata
CREATE TABLE IF NOT EXISTS public.elezioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES public.giornate_elettorali(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sindaco','consiglio','circoscrizione','nazionale','referendum','altro')),
  ordine int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Liste di una elezione
CREATE TABLE IF NOT EXISTS public.liste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elezione_id uuid NOT NULL REFERENCES public.elezioni(id) ON DELETE CASCADE,
  nome text NOT NULL,
  simbolo_url text,
  ordine int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Candidati in una lista
CREATE TABLE IF NOT EXISTS public.candidati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid NOT NULL REFERENCES public.liste(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cognome text NOT NULL,
  ordine int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sezioni (dal CSV, condivise nella giornata)
CREATE TABLE IF NOT EXISTS public.sezioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giornata_id uuid NOT NULL REFERENCES public.giornate_elettorali(id) ON DELETE CASCADE,
  numero int NOT NULL,
  indirizzo text,
  ubicazione text,
  lat numeric(9,6),
  lng numeric(9,6),
  circoscrizione int,
  note text,
  accessibilita text,
  UNIQUE (giornata_id, numero)
);
CREATE INDEX IF NOT EXISTS sezioni_giornata_idx ON public.sezioni(giornata_id);

-- Risultato sezione×elezione
CREATE TABLE IF NOT EXISTS public.risultati_sezione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sezione_id uuid NOT NULL REFERENCES public.sezioni(id) ON DELETE CASCADE,
  elezione_id uuid NOT NULL REFERENCES public.elezioni(id) ON DELETE CASCADE,
  schede_totali int CHECK (schede_totali IS NULL OR schede_totali >= 0),
  schede_bianche int CHECK (schede_bianche IS NULL OR schede_bianche >= 0),
  schede_nulle int CHECK (schede_nulle IS NULL OR schede_nulle >= 0),
  schede_contestate int CHECK (schede_contestate IS NULL OR schede_contestate >= 0),
  stato text NOT NULL DEFAULT 'draft' CHECK (stato IN ('draft','submitted','verified')),
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sezione_id, elezione_id)
);
CREATE INDEX IF NOT EXISTS risultati_sezione_sezione_idx ON public.risultati_sezione(sezione_id);
CREATE INDEX IF NOT EXISTS risultati_sezione_elezione_idx ON public.risultati_sezione(elezione_id);

-- Voti totali per lista
CREATE TABLE IF NOT EXISTS public.voti_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risultato_sezione_id uuid NOT NULL REFERENCES public.risultati_sezione(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES public.liste(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, lista_id)
);

-- Preferenze per candidato
CREATE TABLE IF NOT EXISTS public.preferenze_candidato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risultato_sezione_id uuid NOT NULL REFERENCES public.risultati_sezione(id) ON DELETE CASCADE,
  candidato_id uuid NOT NULL REFERENCES public.candidati(id) ON DELETE CASCADE,
  voti int NOT NULL DEFAULT 0 CHECK (voti >= 0),
  UNIQUE (risultato_sezione_id, candidato_id)
);

-- Trigger updated_at su risultati_sezione
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_risultati_updated ON public.risultati_sezione;
CREATE TRIGGER trg_risultati_updated
  BEFORE UPDATE ON public.risultati_sezione
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
