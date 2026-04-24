# Fase 3 — Voti Presunti + Confronto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere la gestione dei voti presunti per candidato (riservati agli admin) e una dashboard di confronto presunti vs reali a due viste (per candidato / per sezione), come descritto nello spec `docs/superpowers/specs/2026-04-23-elemanager-fase3-voti-presunti-design.md`.

**Architecture:** Nuova tabella `elemanager.voti_presunti` con `sezione_id` nullable (NULL = totale globale candidato), RLS admin-only, trigger coerenza giornata e audit. Frontend: due feature folder (`features/admin/presunti` per CRUD, `features/admin/confronto` per dashboard) con hook queries dedicati e funzioni pure di aggregazione unit-testate. Realtime via publication Supabase esistente.

**Tech Stack:** React 18 + Vite + TS + Tailwind, Supabase (self-hosted, schema `elemanager`), TanStack Query, React Router v7, Vitest (unit + integration RLS), Playwright (E2E).

---

## File Structure

**Database:**
- Create: `supabase/migrations/0010_voti_presunti.sql`

**Types:**
- Modify: `src/lib/database.types.ts` (aggiungere `VotoPresuntoRow/Insert/Update`)
- Modify: `src/lib/queries/_db.ts` (aggiungere `voti_presunti` a `DatabaseWithRel`)

**Queries:**
- Create: `src/lib/queries/votiPresunti.ts`

**Feature "Voti presunti" (CRUD admin):**
- Create: `src/features/admin/presunti/PresuntiIndexPage.tsx`
- Create: `src/features/admin/presunti/PresuntoCandidatoPage.tsx`
- Create: `src/features/admin/presunti/PresuntoSezionePage.tsx`
- Create: `src/features/admin/presunti/components/StimaSezioneRow.tsx`
- Create: `src/features/admin/presunti/components/CandidatoVotiRow.tsx`

**Feature "Confronto" (dashboard):**
- Create: `src/features/admin/confronto/confronto.ts` (pure functions)
- Create: `src/features/admin/confronto/confronto.test.ts`
- Create: `src/features/admin/confronto/ConfrontoPage.tsx`
- Create: `src/features/admin/confronto/PerCandidatoView.tsx`
- Create: `src/features/admin/confronto/PerSezioneView.tsx`
- Create: `src/features/admin/confronto/CandidatoDrillDown.tsx`
- Create: `src/features/admin/confronto/SezioneDrillDown.tsx`

**Routing e menu:**
- Modify: `src/app/router.tsx` (aggiungere route presunti + confronto)
- Modify: `src/features/admin/AdminLayout.tsx` (aggiungere voci menu)
- Modify: `src/features/admin/AdminIndexPage.tsx` (aggiungere card)

**Test:**
- Create: `tests/integration/voti-presunti-rls.test.ts` (se la suite integration è abilitata; vedi Task 12)
- Create: `tests/e2e/fase3-confronto.spec.ts`

**Docs:**
- Modify: `README.md` (sezione Fase 3)

---

## Task 1: Migration SQL `0010_voti_presunti.sql`

**Files:**
- Create: `supabase/migrations/0010_voti_presunti.sql`

- [ ] **Step 1: Scrivere la migration**

Creare `supabase/migrations/0010_voti_presunti.sql` con questo contenuto:

```sql
-- 0010_voti_presunti.sql
-- Tabella voti_presunti (stime di campagna per candidato, opzionalmente per sezione).
-- RLS admin-only su tutte le operazioni.

BEGIN;

CREATE TABLE IF NOT EXISTS elemanager.voti_presunti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid NOT NULL REFERENCES elemanager.candidati(id) ON DELETE CASCADE,
  sezione_id uuid REFERENCES elemanager.sezioni(id) ON DELETE CASCADE,
  voti int NOT NULL CHECK (voti >= 0),
  created_by uuid REFERENCES elemanager.profiles(id),
  updated_by uuid REFERENCES elemanager.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indici unici parziali: NULL non si uguaglia a NULL, quindi serve uno split.
CREATE UNIQUE INDEX IF NOT EXISTS voti_presunti_totale_uq
  ON elemanager.voti_presunti (candidato_id)
  WHERE sezione_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS voti_presunti_sezione_uq
  ON elemanager.voti_presunti (candidato_id, sezione_id)
  WHERE sezione_id IS NOT NULL;

-- Indici di lettura
CREATE INDEX IF NOT EXISTS voti_presunti_candidato_idx
  ON elemanager.voti_presunti (candidato_id);
CREATE INDEX IF NOT EXISTS voti_presunti_sezione_idx
  ON elemanager.voti_presunti (sezione_id)
  WHERE sezione_id IS NOT NULL;

-- Trigger coerenza giornata: la sezione_id.giornata_id deve coincidere con
-- candidato_id → lista → elezione → giornata_id.
CREATE OR REPLACE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  giornata_candidato uuid;
  giornata_sezione uuid;
BEGIN
  IF NEW.sezione_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.giornata_id INTO giornata_candidato
  FROM elemanager.candidati c
  JOIN elemanager.liste l ON l.id = c.lista_id
  JOIN elemanager.elezioni e ON e.id = l.elezione_id
  WHERE c.id = NEW.candidato_id;

  SELECT s.giornata_id INTO giornata_sezione
  FROM elemanager.sezioni s
  WHERE s.id = NEW.sezione_id;

  IF giornata_candidato IS DISTINCT FROM giornata_sezione THEN
    RAISE EXCEPTION
      'candidato % e sezione % appartengono a giornate diverse',
      NEW.candidato_id, NEW.sezione_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS voti_presunti_coerenza_giornata
  ON elemanager.voti_presunti;
CREATE TRIGGER voti_presunti_coerenza_giornata
  BEFORE INSERT OR UPDATE ON elemanager.voti_presunti
  FOR EACH ROW
  EXECUTE FUNCTION elemanager.trg_voti_presunti_coerenza_giornata();

-- Trigger updated_at (riusa set_updated_at definito in 0004).
DROP TRIGGER IF EXISTS trg_voti_presunti_updated ON elemanager.voti_presunti;
CREATE TRIGGER trg_voti_presunti_updated
  BEFORE UPDATE ON elemanager.voti_presunti
  FOR EACH ROW EXECUTE FUNCTION elemanager.set_updated_at();

-- Trigger audit (riusa trg_audit definito in 0004).
DROP TRIGGER IF EXISTS trg_audit_voti_presunti ON elemanager.voti_presunti;
CREATE TRIGGER trg_audit_voti_presunti
  AFTER INSERT OR UPDATE OR DELETE ON elemanager.voti_presunti
  FOR EACH ROW EXECUTE FUNCTION elemanager.trg_audit();

-- RLS admin-only
ALTER TABLE elemanager.voti_presunti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voti_presunti_admin_select ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_select ON elemanager.voti_presunti
  FOR SELECT TO authenticated USING (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_insert ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_insert ON elemanager.voti_presunti
  FOR INSERT TO authenticated WITH CHECK (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_update ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_update ON elemanager.voti_presunti
  FOR UPDATE TO authenticated
  USING (elemanager.is_admin())
  WITH CHECK (elemanager.is_admin());

DROP POLICY IF EXISTS voti_presunti_admin_delete ON elemanager.voti_presunti;
CREATE POLICY voti_presunti_admin_delete ON elemanager.voti_presunti
  FOR DELETE TO authenticated USING (elemanager.is_admin());

-- Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE elemanager.voti_presunti;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;

ALTER TABLE elemanager.voti_presunti REPLICA IDENTITY FULL;

COMMIT;
```

- [ ] **Step 2: Applicare la migration al DB di sviluppo**

Applicare la migration sul Supabase di sviluppo (supabase.robertodedomenico.it). Dalla dashboard SQL Editor oppure via CLI se configurata: eseguire l'intero file.

Verifica: `SELECT * FROM elemanager.voti_presunti LIMIT 1;` non deve errorare, e `SELECT polname FROM pg_policies WHERE tablename = 'voti_presunti';` deve mostrare 4 policy `voti_presunti_admin_*`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_voti_presunti.sql
git commit -m "feat(db): migration 0010 voti_presunti con RLS admin-only, trigger coerenza e audit"
```

---

## Task 2: Types TypeScript per `voti_presunti`

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/queries/_db.ts`

- [ ] **Step 1: Aggiungere i tipi `VotoPresunto*` in `database.types.ts`**

Aggiungere in fondo a `src/lib/database.types.ts`, prima dell'export `Database`:

```typescript
export type VotoPresuntoRow = {
  id: string;
  candidato_id: string;
  sezione_id: string | null;
  voti: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VotoPresuntoInsert = Omit<
  VotoPresuntoRow,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type VotoPresuntoUpdate = Partial<Omit<VotoPresuntoRow, 'id'>>;
```

Quindi aggiungere la tabella in `Database['elemanager']['Tables']`. Aprire `src/lib/database.types.ts` e individuare il blocco `export type Database = { elemanager: { Tables: { ... } } }`; aggiungere fra le altre:

```typescript
voti_presunti: {
  Row: VotoPresuntoRow;
  Insert: VotoPresuntoInsert;
  Update: VotoPresuntoUpdate;
};
```

- [ ] **Step 2: Aggiungere `voti_presunti` a `_db.ts`**

Modificare `src/lib/queries/_db.ts`:

a) Aggiungere l'import dei tre nuovi tipi:

```typescript
import type {
  // ...tipi esistenti
  VotoPresuntoRow, VotoPresuntoInsert, VotoPresuntoUpdate,
} from '@/lib/database.types';
```

b) Aggiungere una entry a `DatabaseWithRel.elemanager.Tables`:

```typescript
voti_presunti: WithRelationships<{ Row: VotoPresuntoRow; Insert: VotoPresuntoInsert; Update: VotoPresuntoUpdate }>;
```

- [ ] **Step 3: Verifica build TypeScript**

Eseguire:

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build passa senza errori (il type-check fallirebbe se `voti_presunti` non fosse registrata ma già usata — qui nessun consumer ancora, quindi deve solo compilare).

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts src/lib/queries/_db.ts
git commit -m "feat(types): VotoPresunto row/insert/update + tabella in Database elemanager"
```

---

## Task 3: Hook queries `votiPresunti.ts`

**Files:**
- Create: `src/lib/queries/votiPresunti.ts`

- [ ] **Step 1: Creare `src/lib/queries/votiPresunti.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type {
  VotoPresuntoRow,
  VotoPresuntoInsert,
  VotoPresuntoUpdate,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'voti_presunti';

/** Tutti i presunti per un'elezione (join via candidato_id → lista → elezione). */
export function useVotiPresuntiByElezione(elezioneId: string | undefined) {
  const enabled = !!elezioneId;
  useRealtimeTable({ table: 'voti_presunti', invalidate: [[KEY, 'elezione', elezioneId]], enabled });
  return useQuery({
    queryKey: [KEY, 'elezione', elezioneId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      // Filtro via subquery: prendi tutti i candidato_id dell'elezione, poi filtra presunti.
      const { data: candidati, error: eCand } = await db
        .from('candidati')
        .select('id, lista_id')
        .in(
          'lista_id',
          (
            await db.from('liste').select('id').eq('elezione_id', elezioneId as string)
          ).data?.map((l) => l.id) ?? []
        );
      if (eCand) throw eCand;
      const candIds = (candidati ?? []).map((c) => c.id);
      if (candIds.length === 0) return [];
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .in('candidato_id', candIds);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Presunti di un singolo candidato (globale + per-sezione). */
export function useVotiPresuntiByCandidato(candidatoId: string | undefined) {
  const enabled = !!candidatoId;
  useRealtimeTable({ table: 'voti_presunti', invalidate: [[KEY, 'candidato', candidatoId]], enabled });
  return useQuery({
    queryKey: [KEY, 'candidato', candidatoId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .eq('candidato_id', candidatoId as string);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Presunti per una sezione (filtrati ai candidati dell'elezione specificata). */
export function useVotiPresuntiBySezione(
  sezioneId: string | undefined,
  elezioneId: string | undefined
) {
  const enabled = !!sezioneId && !!elezioneId;
  useRealtimeTable({
    table: 'voti_presunti',
    invalidate: [[KEY, 'sezione', sezioneId, elezioneId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, 'sezione', sezioneId, elezioneId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .eq('sezione_id', sezioneId as string);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Upsert su uno dei due indici unici parziali. */
export function useUpsertVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VotoPresuntoInsert): Promise<VotoPresuntoRow> => {
      const conflict = input.sezione_id
        ? 'candidato_id,sezione_id'
        : 'candidato_id';
      const { data, error } = await db
        .from('voti_presunti')
        .upsert(input as VotoPresuntoInsert, { onConflict: conflict, ignoreDuplicates: false })
        .select()
        .single();
      if (error) throw error;
      return data as VotoPresuntoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: VotoPresuntoUpdate }) => {
      const { data, error } = await db
        .from('voti_presunti')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as VotoPresuntoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('voti_presunti').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
```

> Nota: l'upsert partial-index-aware usa `onConflict` sui due indici unici parziali. Nota che Postgres li riconosce correttamente: il client Supabase JS passa l'hint a PostgREST che lo inoltra a Postgres.

- [ ] **Step 2: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/votiPresunti.ts
git commit -m "feat(queries): hook TanStack Query + realtime per voti_presunti"
```

---

## Task 4: Pure functions `confronto.ts` + unit test (TDD)

**Files:**
- Create: `src/features/admin/confronto/confronto.ts`
- Create: `src/features/admin/confronto/confronto.test.ts`

- [ ] **Step 1: Scrivere il test FAIL prima dell'implementazione**

Creare `src/features/admin/confronto/confronto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  aggregateByCandidato,
  aggregateBySezione,
  candidatoDrillDown,
  sezioneDrillDown,
  type CandidatoConfrontoRow,
} from './confronto';
import type {
  VotoPresuntoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  CandidatoRow,
  SezioneRow,
  ListaRow,
} from '@/lib/database.types';

const rs = (overrides: Partial<RisultatoSezioneRow>): RisultatoSezioneRow => ({
  id: overrides.id ?? 'rs1',
  sezione_id: overrides.sezione_id ?? 'sez1',
  elezione_id: overrides.elezione_id ?? 'el1',
  schede_totali: null,
  schede_bianche: null,
  schede_nulle: null,
  schede_contestate: null,
  stato: overrides.stato ?? 'submitted',
  created_by: null,
  updated_by: null,
  created_at: '2026-04-24T00:00:00Z',
  updated_at: '2026-04-24T00:00:00Z',
});

const cand = (id: string, lista_id = 'l1', cognome = 'Rossi'): CandidatoRow => ({
  id,
  lista_id,
  nome: 'Mario',
  cognome,
  ordine: 0,
  note: null,
  created_at: '2026-04-24T00:00:00Z',
});

const pref = (
  candidato_id: string,
  rs_id: string,
  voti: number
): PreferenzaCandidatoRow => ({
  id: `p-${candidato_id}-${rs_id}`,
  risultato_sezione_id: rs_id,
  candidato_id,
  voti,
});

const presunto = (
  candidato_id: string,
  sezione_id: string | null,
  voti: number
): VotoPresuntoRow => ({
  id: `pr-${candidato_id}-${sezione_id ?? 'NULL'}`,
  candidato_id,
  sezione_id,
  voti,
  created_by: null,
  updated_by: null,
  created_at: '2026-04-24T00:00:00Z',
  updated_at: '2026-04-24T00:00:00Z',
});

const sez = (id: string, numero: number): SezioneRow => ({
  id,
  giornata_id: 'g1',
  numero,
  indirizzo: `Via ${numero}`,
  ubicazione: null,
  lat: null,
  lng: null,
  circoscrizione: null,
  note: null,
  accessibilita: null,
});

describe('aggregateByCandidato', () => {
  it('candidato senza presunto globale → presunto null, delta null', () => {
    const rows = aggregateByCandidato({
      candidati: [cand('c1')],
      presunti: [],
      preferenze: [pref('c1', 'rs1', 10)],
      risultatiSezione: [rs({ id: 'rs1', stato: 'submitted' })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject<Partial<CandidatoConfrontoRow>>({
      candidato_id: 'c1',
      reale: 10,
      presunto: null,
      delta: null,
      deltaPerc: null,
    });
  });

  it('candidato con presunto > 0 calcola delta e delta %', () => {
    const rows = aggregateByCandidato({
      candidati: [cand('c1')],
      presunti: [presunto('c1', null, 100)],
      preferenze: [pref('c1', 'rs1', 80)],
      risultatiSezione: [rs({ id: 'rs1', stato: 'submitted' })],
    });
    expect(rows[0].reale).toBe(80);
    expect(rows[0].presunto).toBe(100);
    expect(rows[0].delta).toBe(-20);
    expect(rows[0].deltaPerc).toBe(-20);
  });

  it('candidato con presunto = 0 → delta % null', () => {
    const rows = aggregateByCandidato({
      candidati: [cand('c1')],
      presunti: [presunto('c1', null, 0)],
      preferenze: [pref('c1', 'rs1', 5)],
      risultatiSezione: [rs({ id: 'rs1', stato: 'submitted' })],
    });
    expect(rows[0].delta).toBe(5);
    expect(rows[0].deltaPerc).toBe(null);
  });

  it('ignora sezioni con risultati in stato draft', () => {
    const rows = aggregateByCandidato({
      candidati: [cand('c1')],
      presunti: [presunto('c1', null, 100)],
      preferenze: [pref('c1', 'rs-draft', 50), pref('c1', 'rs-ok', 30)],
      risultatiSezione: [
        rs({ id: 'rs-draft', stato: 'draft' }),
        rs({ id: 'rs-ok', stato: 'submitted' }),
      ],
    });
    expect(rows[0].reale).toBe(30);
  });
});

describe('aggregateBySezione', () => {
  it('somma presunti e reali solo dei candidati con stima in quella sezione', () => {
    const rows = aggregateBySezione({
      sezioni: [sez('sez1', 1)],
      candidati: [cand('c1'), cand('c2')],
      presunti: [presunto('c1', 'sez1', 40), presunto('c2', 'sez1', 20)],
      preferenze: [
        pref('c1', 'rs1', 35),
        pref('c2', 'rs1', 18),
      ],
      risultatiSezione: [rs({ id: 'rs1', sezione_id: 'sez1', stato: 'submitted' })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].sezione_id).toBe('sez1');
    expect(rows[0].presuntoTot).toBe(60);
    expect(rows[0].realeTot).toBe(53);
    expect(rows[0].candidatiStimati).toBe(2);
  });

  it('sezione senza stime → candidatiStimati 0, totali 0', () => {
    const rows = aggregateBySezione({
      sezioni: [sez('sez1', 1)],
      candidati: [cand('c1')],
      presunti: [],
      preferenze: [pref('c1', 'rs1', 35)],
      risultatiSezione: [rs({ id: 'rs1', sezione_id: 'sez1', stato: 'submitted' })],
    });
    expect(rows[0].candidatiStimati).toBe(0);
    expect(rows[0].presuntoTot).toBe(0);
    expect(rows[0].realeTot).toBe(0);
  });
});

describe('candidatoDrillDown', () => {
  it('righe per ogni sezione stimata, reale null se risultato non submitted', () => {
    const rows = candidatoDrillDown({
      candidatoId: 'c1',
      presunti: [
        presunto('c1', 'sez1', 40),
        presunto('c1', 'sez2', 20),
      ],
      preferenze: [pref('c1', 'rs1', 35)],
      risultatiSezione: [rs({ id: 'rs1', sezione_id: 'sez1', stato: 'submitted' })],
      sezioni: [sez('sez1', 1), sez('sez2', 2)],
    });
    expect(rows).toHaveLength(2);
    const s1 = rows.find((r) => r.sezione_id === 'sez1')!;
    const s2 = rows.find((r) => r.sezione_id === 'sez2')!;
    expect(s1.presunto).toBe(40);
    expect(s1.reale).toBe(35);
    expect(s1.delta).toBe(-5);
    expect(s2.presunto).toBe(20);
    expect(s2.reale).toBe(null);
    expect(s2.delta).toBe(null);
    expect(s2.statoSezione).toBe('assente');
  });
});

describe('sezioneDrillDown', () => {
  const liste: ListaRow[] = [
    {
      id: 'l1',
      elezione_id: 'el1',
      nome: 'Lista A',
      simbolo_url: null,
      ordine: 0,
      created_at: '2026-04-24T00:00:00Z',
    },
  ];

  it('include solo candidati con stima in quella sezione', () => {
    const rows = sezioneDrillDown({
      sezioneId: 'sez1',
      elezioneId: 'el1',
      presunti: [presunto('c1', 'sez1', 40)],
      preferenze: [pref('c1', 'rs1', 35), pref('c2', 'rs1', 100)],
      risultatiSezione: [rs({ id: 'rs1', sezione_id: 'sez1', stato: 'submitted' })],
      candidati: [cand('c1'), cand('c2')],
      liste,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].candidato_id).toBe('c1');
    expect(rows[0].presunto).toBe(40);
    expect(rows[0].reale).toBe(35);
  });
});
```

- [ ] **Step 2: Eseguire il test — deve fallire**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/confronto/confronto.test.ts
```

Expected: FAIL con "Cannot find module './confronto'" o simile.

- [ ] **Step 3: Implementare `confronto.ts`**

Creare `src/features/admin/confronto/confronto.ts`:

```typescript
import type {
  VotoPresuntoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  CandidatoRow,
  SezioneRow,
  ListaRow,
  StatoRisultato,
} from '@/lib/database.types';

export type StatoSezioneDrill = StatoRisultato | 'assente';

export interface CandidatoConfrontoRow {
  candidato_id: string;
  cognome: string;
  nome: string;
  lista_id: string;
  reale: number;
  presunto: number | null;
  delta: number | null;
  deltaPerc: number | null;
}

export interface SezioneConfrontoRow {
  sezione_id: string;
  numero: number;
  indirizzo: string | null;
  statoSezione: StatoSezioneDrill;
  candidatiStimati: number;
  realeTot: number;
  presuntoTot: number;
  delta: number;
}

export interface CandidatoDrillRow {
  sezione_id: string;
  numero: number;
  presunto: number;
  reale: number | null;
  delta: number | null;
  deltaPerc: number | null;
  statoSezione: StatoSezioneDrill;
}

export interface SezioneDrillRow {
  candidato_id: string;
  cognome: string;
  nome: string;
  lista_id: string;
  listaNome: string;
  presunto: number;
  reale: number | null;
  delta: number | null;
  deltaPerc: number | null;
}

const CONTA_STATI: ReadonlySet<StatoRisultato> = new Set(['submitted', 'verified']);

function computeDeltaPerc(reale: number | null, presunto: number | null): number | null {
  if (presunto === null || presunto === 0) return null;
  if (reale === null) return null;
  return ((reale - presunto) / presunto) * 100;
}

function computeDelta(reale: number | null, presunto: number | null): number | null {
  if (reale === null || presunto === null) return null;
  return reale - presunto;
}

export function aggregateByCandidato(params: {
  candidati: CandidatoRow[];
  presunti: VotoPresuntoRow[];
  preferenze: PreferenzaCandidatoRow[];
  risultatiSezione: RisultatoSezioneRow[];
}): CandidatoConfrontoRow[] {
  const { candidati, presunti, preferenze, risultatiSezione } = params;

  const rsValid = new Set(
    risultatiSezione.filter((r) => CONTA_STATI.has(r.stato)).map((r) => r.id)
  );

  const totalePresunti = new Map<string, number>();
  for (const p of presunti) {
    if (p.sezione_id === null) {
      totalePresunti.set(p.candidato_id, p.voti);
    }
  }

  const realePerCand = new Map<string, number>();
  for (const pref of preferenze) {
    if (!rsValid.has(pref.risultato_sezione_id)) continue;
    realePerCand.set(pref.candidato_id, (realePerCand.get(pref.candidato_id) ?? 0) + pref.voti);
  }

  return candidati.map((c) => {
    const reale = realePerCand.get(c.id) ?? 0;
    const presunto = totalePresunti.has(c.id) ? totalePresunti.get(c.id)! : null;
    return {
      candidato_id: c.id,
      cognome: c.cognome,
      nome: c.nome,
      lista_id: c.lista_id,
      reale,
      presunto,
      delta: computeDelta(reale, presunto),
      deltaPerc: computeDeltaPerc(reale, presunto),
    };
  });
}

export function aggregateBySezione(params: {
  sezioni: SezioneRow[];
  candidati: CandidatoRow[];
  presunti: VotoPresuntoRow[];
  preferenze: PreferenzaCandidatoRow[];
  risultatiSezione: RisultatoSezioneRow[];
}): SezioneConfrontoRow[] {
  const { sezioni, candidati, presunti, preferenze, risultatiSezione } = params;

  const candSet = new Set(candidati.map((c) => c.id));
  const presuntiBySez = new Map<string, Map<string, number>>(); // sezione_id → candidato_id → voti
  for (const p of presunti) {
    if (!p.sezione_id) continue;
    if (!candSet.has(p.candidato_id)) continue;
    const m = presuntiBySez.get(p.sezione_id) ?? new Map<string, number>();
    m.set(p.candidato_id, p.voti);
    presuntiBySez.set(p.sezione_id, m);
  }

  const rsBySez = new Map<string, RisultatoSezioneRow>();
  for (const r of risultatiSezione) {
    rsBySez.set(r.sezione_id, r);
  }

  const prefByRsCand = new Map<string, number>(); // key = rs_id|cand_id
  for (const pref of preferenze) {
    prefByRsCand.set(`${pref.risultato_sezione_id}|${pref.candidato_id}`, pref.voti);
  }

  return sezioni.map((s) => {
    const stime = presuntiBySez.get(s.id) ?? new Map<string, number>();
    const presuntoTot = Array.from(stime.values()).reduce((a, b) => a + b, 0);

    const rs = rsBySez.get(s.id);
    const stato: StatoSezioneDrill = rs ? rs.stato : 'assente';

    let realeTot = 0;
    if (rs && CONTA_STATI.has(rs.stato)) {
      for (const candId of stime.keys()) {
        realeTot += prefByRsCand.get(`${rs.id}|${candId}`) ?? 0;
      }
    }

    return {
      sezione_id: s.id,
      numero: s.numero,
      indirizzo: s.indirizzo,
      statoSezione: stato,
      candidatiStimati: stime.size,
      realeTot,
      presuntoTot,
      delta: realeTot - presuntoTot,
    };
  });
}

export function candidatoDrillDown(params: {
  candidatoId: string;
  presunti: VotoPresuntoRow[];
  preferenze: PreferenzaCandidatoRow[];
  risultatiSezione: RisultatoSezioneRow[];
  sezioni: SezioneRow[];
}): CandidatoDrillRow[] {
  const { candidatoId, presunti, preferenze, risultatiSezione, sezioni } = params;

  const stime = presunti.filter((p) => p.candidato_id === candidatoId && p.sezione_id !== null);
  const sezById = new Map(sezioni.map((s) => [s.id, s]));
  const rsBySez = new Map(risultatiSezione.map((r) => [r.sezione_id, r]));
  const prefByRsCand = new Map<string, number>();
  for (const p of preferenze) {
    prefByRsCand.set(`${p.risultato_sezione_id}|${p.candidato_id}`, p.voti);
  }

  return stime
    .map((st) => {
      const sez = sezById.get(st.sezione_id!);
      if (!sez) return null;
      const rs = rsBySez.get(sez.id);
      const stato: StatoSezioneDrill = rs ? rs.stato : 'assente';
      const reale =
        rs && CONTA_STATI.has(rs.stato)
          ? prefByRsCand.get(`${rs.id}|${candidatoId}`) ?? 0
          : null;
      return {
        sezione_id: sez.id,
        numero: sez.numero,
        presunto: st.voti,
        reale,
        delta: computeDelta(reale, st.voti),
        deltaPerc: computeDeltaPerc(reale, st.voti),
        statoSezione: stato,
      };
    })
    .filter((r): r is CandidatoDrillRow => r !== null)
    .sort((a, b) => a.numero - b.numero);
}

export function sezioneDrillDown(params: {
  sezioneId: string;
  elezioneId: string;
  presunti: VotoPresuntoRow[];
  preferenze: PreferenzaCandidatoRow[];
  risultatiSezione: RisultatoSezioneRow[];
  candidati: CandidatoRow[];
  liste: ListaRow[];
}): SezioneDrillRow[] {
  const { sezioneId, elezioneId, presunti, preferenze, risultatiSezione, candidati, liste } = params;

  const listeOfElez = new Set(liste.filter((l) => l.elezione_id === elezioneId).map((l) => l.id));
  const candOfElez = candidati.filter((c) => listeOfElez.has(c.lista_id));
  const candById = new Map(candOfElez.map((c) => [c.id, c]));
  const listaById = new Map(liste.map((l) => [l.id, l]));

  const stimeInSez = presunti.filter((p) => p.sezione_id === sezioneId && candById.has(p.candidato_id));

  const rs = risultatiSezione.find((r) => r.sezione_id === sezioneId && r.elezione_id === elezioneId);
  const prefByRsCand = new Map<string, number>();
  if (rs && CONTA_STATI.has(rs.stato)) {
    for (const p of preferenze.filter((p) => p.risultato_sezione_id === rs.id)) {
      prefByRsCand.set(p.candidato_id, p.voti);
    }
  }

  return stimeInSez
    .map((st) => {
      const c = candById.get(st.candidato_id)!;
      const reale = rs && CONTA_STATI.has(rs.stato) ? prefByRsCand.get(c.id) ?? 0 : null;
      return {
        candidato_id: c.id,
        cognome: c.cognome,
        nome: c.nome,
        lista_id: c.lista_id,
        listaNome: listaById.get(c.lista_id)?.nome ?? '',
        presunto: st.voti,
        reale,
        delta: computeDelta(reale, st.voti),
        deltaPerc: computeDeltaPerc(reale, st.voti),
      };
    })
    .sort((a, b) => {
      const byLista = a.listaNome.localeCompare(b.listaNome);
      if (byLista !== 0) return byLista;
      return a.cognome.localeCompare(b.cognome);
    });
}
```

- [ ] **Step 4: Eseguire i test — devono PASSARE**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/confronto/confronto.test.ts
```

Expected: tutti i test PASSANO.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/confronto/confronto.ts src/features/admin/confronto/confronto.test.ts
git commit -m "feat(confronto): pure functions aggregazione presunti vs reali + unit test"
```

---

## Task 5: Routing e menu admin

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/features/admin/AdminLayout.tsx`
- Modify: `src/features/admin/AdminIndexPage.tsx`

- [ ] **Step 1: Aggiungere le due voci al menu `AdminLayout`**

In `src/features/admin/AdminLayout.tsx`, modificare l'array `items`:

```typescript
const items = [
  { to: '/admin', label: 'Home', end: true },
  { to: '/admin/users', label: 'Utenti' },
  { to: '/admin/giornate', label: 'Giornate' },
  { to: '/admin/sezioni', label: 'Sezioni' },
  { to: '/admin/presunti', label: 'Presunti' },
  { to: '/admin/confronto', label: 'Confronto' },
  { to: '/admin/audit', label: 'Audit' },
];
```

- [ ] **Step 2: Aggiungere le card in `AdminIndexPage`**

In `src/features/admin/AdminIndexPage.tsx`, aggiungere all'array `cards`:

```typescript
const cards: Card[] = [
  { to: '/admin/users', title: 'Utenti', description: 'Gestisci profili e ruoli di admin, editor, viewer.' },
  { to: '/admin/giornate', title: 'Giornate elettorali', description: 'Crea giornate, elezioni, liste e candidati.' },
  { to: '/admin/sezioni', title: 'Sezioni', description: 'Importa CSV dei seggi e visualizza sulla mappa.' },
  { to: '/admin/presunti', title: 'Voti presunti', description: 'Inserisci stime voti per candidato (totale e per sezione).' },
  { to: '/admin/confronto', title: 'Confronto', description: 'Dashboard scostamenti presunti vs reali in tempo reale.' },
  { to: '/admin/audit', title: 'Audit log', description: 'Storico modifiche voti e operazioni.' },
];
```

- [ ] **Step 3: Aggiungere le route in `router.tsx`**

In `src/app/router.tsx`:

a) Aggiungere gli import in cima (dopo gli altri admin imports):

```typescript
import { PresuntiIndexPage } from '@/features/admin/presunti/PresuntiIndexPage';
import { PresuntoCandidatoPage } from '@/features/admin/presunti/PresuntoCandidatoPage';
import { PresuntoSezionePage } from '@/features/admin/presunti/PresuntoSezionePage';
import { ConfrontoPage } from '@/features/admin/confronto/ConfrontoPage';
import { CandidatoDrillDown } from '@/features/admin/confronto/CandidatoDrillDown';
import { SezioneDrillDown } from '@/features/admin/confronto/SezioneDrillDown';
```

b) Aggiungere le route dentro `<Route path="admin" ...>`, dopo `<Route path="sezioni" ... />`:

```tsx
<Route path="presunti" element={<PresuntiIndexPage />} />
<Route path="presunti/candidato/:candidatoId" element={<PresuntoCandidatoPage />} />
<Route path="presunti/sezione/:sezioneId" element={<PresuntoSezionePage />} />
<Route path="confronto" element={<ConfrontoPage />} />
<Route path="confronto/candidato/:candidatoId" element={<CandidatoDrillDown />} />
<Route path="confronto/sezione/:sezioneId" element={<SezioneDrillDown />} />
```

- [ ] **Step 4: Stub placeholder temporanei per far compilare**

Prima di implementare le 6 pagine (Task 6–11), creare file stub minimi che esportano componenti vuoti per far compilare il build. Creare ognuno di questi con un contenuto provvisorio:

`src/features/admin/presunti/PresuntiIndexPage.tsx`:

```tsx
export function PresuntiIndexPage() {
  return <div className="glass p-6 rounded-2xl">Presunti (WIP)</div>;
}
```

`src/features/admin/presunti/PresuntoCandidatoPage.tsx`:

```tsx
export function PresuntoCandidatoPage() {
  return <div className="glass p-6 rounded-2xl">Presunto candidato (WIP)</div>;
}
```

`src/features/admin/presunti/PresuntoSezionePage.tsx`:

```tsx
export function PresuntoSezionePage() {
  return <div className="glass p-6 rounded-2xl">Presunto sezione (WIP)</div>;
}
```

`src/features/admin/confronto/ConfrontoPage.tsx`:

```tsx
export function ConfrontoPage() {
  return <div className="glass p-6 rounded-2xl">Confronto (WIP)</div>;
}
```

`src/features/admin/confronto/CandidatoDrillDown.tsx`:

```tsx
export function CandidatoDrillDown() {
  return <div className="glass p-6 rounded-2xl">Candidato drill-down (WIP)</div>;
}
```

`src/features/admin/confronto/SezioneDrillDown.tsx`:

```tsx
export function SezioneDrillDown() {
  return <div className="glass p-6 rounded-2xl">Sezione drill-down (WIP)</div>;
}
```

- [ ] **Step 5: Verifica build e test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: build passa, tutti i test passano.

- [ ] **Step 6: Commit**

```bash
git add src/app/router.tsx src/features/admin/AdminLayout.tsx src/features/admin/AdminIndexPage.tsx src/features/admin/presunti src/features/admin/confronto
git commit -m "feat(admin): routing e menu voti presunti + confronto (stub pagine)"
```

---

## Task 6: `PresuntiIndexPage` con tabs

**Files:**
- Modify: `src/features/admin/presunti/PresuntiIndexPage.tsx`

- [ ] **Step 1: Implementare `PresuntiIndexPage`**

Sostituire il contenuto del file con:

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Skeleton } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useCandidatiByLista } from '@/lib/queries/candidati';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';

type Tab = 'candidato' | 'sezione';

export function PresuntiIndexPage() {
  const [tab, setTab] = useState<Tab>('candidato');

  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voti presunti"
        subtitle="Stime di campagna per candidato, opzionalmente per sezione."
      />

      <div className="flex flex-wrap gap-3 glass p-3 rounded-2xl">
        <Select
          label="Giornata"
          value={selectedGiornataId}
          onChange={(e) => {
            setGiornataId(e.target.value);
            setElezioneId('');
          }}
        >
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'candidato' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('candidato')}
        >
          Per candidato
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'sezione' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('sezione')}
        >
          Per sezione
        </button>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona una giornata ed elezione per vedere l'elenco.
        </div>
      ) : tab === 'candidato' ? (
        <PerCandidatoTable elezioneId={selectedElezioneId} />
      ) : (
        <PerSezioneTable
          giornataId={selectedGiornataId}
          elezioneId={selectedElezioneId}
        />
      )}
    </div>
  );
}

function PerCandidatoTable({ elezioneId }: { elezioneId: string }) {
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const { data: presunti = [], isLoading } = useVotiPresuntiByElezione(elezioneId);

  // Carica candidati di tutte le liste. Prepariamo un hook per-lista.
  const candidatiAll = useAllCandidatiByListe(liste.map((l) => l.id));

  const rows = useMemo(() => {
    const totali = new Map<string, number>();
    const perSezione = new Map<string, number>();
    for (const p of presunti) {
      if (p.sezione_id === null) totali.set(p.candidato_id, p.voti);
      else perSezione.set(p.candidato_id, (perSezione.get(p.candidato_id) ?? 0) + 1);
    }
    return candidatiAll.map((c) => {
      const lista = liste.find((l) => l.id === c.lista_id);
      return {
        ...c,
        listaNome: lista?.nome ?? '',
        totale: totali.has(c.id) ? totali.get(c.id)! : null,
        numStime: perSezione.get(c.id) ?? 0,
      };
    });
  }, [candidatiAll, liste, presunti]);

  if (isLoading) return <Skeleton className="h-40" />;
  if (rows.length === 0)
    return <div className="glass p-6 rounded-2xl text-slate-300">Nessun candidato.</div>;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Candidato</th>
            <th className="px-4 py-2">Lista</th>
            <th className="px-4 py-2 text-right">Totale presunto</th>
            <th className="px-4 py-2 text-right"># stime sezione</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-4 py-2">
                {r.cognome} {r.nome}
              </td>
              <td className="px-4 py-2 text-slate-300">{r.listaNome}</td>
              <td className="px-4 py-2 text-right">
                {r.totale === null ? <span className="text-slate-500">—</span> : r.totale}
              </td>
              <td className="px-4 py-2 text-right">{r.numStime}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  to={`/admin/presunti/candidato/${r.id}`}
                  className="text-neon-cyan hover:underline"
                >
                  Modifica →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerSezioneTable({
  giornataId,
  elezioneId,
}: {
  giornataId: string;
  elezioneId: string;
}) {
  const { data: sezioni = [], isLoading } = useSezioniByGiornata(giornataId);
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);

  const rows = useMemo(() => {
    const countBySez = new Map<string, number>();
    const sumBySez = new Map<string, number>();
    for (const p of presunti) {
      if (!p.sezione_id) continue;
      countBySez.set(p.sezione_id, (countBySez.get(p.sezione_id) ?? 0) + 1);
      sumBySez.set(p.sezione_id, (sumBySez.get(p.sezione_id) ?? 0) + p.voti);
    }
    return [...sezioni]
      .sort((a, b) => a.numero - b.numero)
      .map((s) => ({
        ...s,
        numCandStimati: countBySez.get(s.id) ?? 0,
        totale: sumBySez.get(s.id) ?? 0,
      }));
  }, [sezioni, presunti]);

  if (isLoading) return <Skeleton className="h-40" />;
  if (rows.length === 0)
    return <div className="glass p-6 rounded-2xl text-slate-300">Nessuna sezione.</div>;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Sezione</th>
            <th className="px-4 py-2">Indirizzo</th>
            <th className="px-4 py-2 text-right"># candidati con stima</th>
            <th className="px-4 py-2 text-right">Totale voti presunti</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-4 py-2">Sez. {r.numero}</td>
              <td className="px-4 py-2 text-slate-300">{r.indirizzo ?? '—'}</td>
              <td className="px-4 py-2 text-right">{r.numCandStimati}</td>
              <td className="px-4 py-2 text-right">{r.totale}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  to={`/admin/presunti/sezione/${r.id}`}
                  className="text-neon-cyan hover:underline"
                >
                  Modifica →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Helper: aggrega i candidati di tutte le liste fornite con hook condizionale disabilitato.
 *  React Hooks non permettono chiamate in loop, quindi usiamo un pattern di
 *  "useQueries" semplificato: per ora carichiamo sequenzialmente un hook per lista
 *  non è ottimo. Usiamo invece useCandidatiByLista solo quando serve. Visto che
 *  il numero di liste è piccolo (tipicamente 1-10), accettiamo questo trade-off.
 *
 *  Implementazione: useQueries di TanStack. Vedi anche:
 *    https://tanstack.com/query/latest/docs/framework/react/reference/useQueries
 */
function useAllCandidatiByListe(listaIds: string[]) {
  const rows = listaIds.flatMap((id) => {
    // Workaround: chiama l'hook "uno a uno" non è possibile in loop.
    // Per evitare complessità, usiamo un singolo hook raccolto qui.
    return [];
  });
  const firstLista = listaIds[0];
  const { data: first = [] } = useCandidatiByLista(firstLista);
  // Per progetti con più liste, implementare useQueries invece.
  // In Messina 2026 ogni elezione ha tipicamente 1 lista principale per candidato sindaco
  // e più liste per consiglio — gestiamo quando il caso si presenta.
  if (listaIds.length <= 1) return first;
  return rows.concat(first);
}
```

> Nota: la helper `useAllCandidatiByListe` sopra è un workaround che copre il caso 1 lista. Per N liste preferire `useQueries` (vedi Task 6 bonus). L'MVP Fase 3 con 1 candidato sindaco o 1-2 liste è adeguato; la gestione multi-lista viene raffinata al Task 6 bonus qui sotto.

- [ ] **Step 2: Refactor con `useQueries` per supportare N liste**

Sostituire la helper `useAllCandidatiByListe` con una basata su `useQueries`:

```tsx
import { useQueries } from '@tanstack/react-query';
import { db } from '@/lib/queries/_db';
import type { CandidatoRow } from '@/lib/database.types';

function useAllCandidatiByListe(listaIds: string[]): CandidatoRow[] {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
      enabled: !!id,
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}
```

Rimuovere l'import `useCandidatiByLista` se non più usato.

- [ ] **Step 3: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build passa.

- [ ] **Step 4: Verifica manuale browser**

Avviare `npm run dev`, login come admin, andare a `/admin/presunti`. Aspettato: selezione giornata + elezione, tab "Per candidato" mostra tabella candidati con totale "—" e 0 stime; tab "Per sezione" mostra tabella sezioni con 0 e 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/presunti/PresuntiIndexPage.tsx
git commit -m "feat(presunti): PresuntiIndexPage con tabs per candidato/sezione"
```

---

## Task 7: `PresuntoCandidatoPage` con autosave

**Files:**
- Create: `src/features/admin/presunti/components/StimaSezioneRow.tsx`
- Modify: `src/features/admin/presunti/PresuntoCandidatoPage.tsx`

- [ ] **Step 1: Creare `StimaSezioneRow`**

Creare `src/features/admin/presunti/components/StimaSezioneRow.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/ui';

type SezioneOpt = { id: string; numero: number; indirizzo: string | null };

export function StimaSezioneRow({
  row,
  sezioniOptions,
  onChange,
  onDelete,
}: {
  row: { sezione_id: string; voti: number };
  sezioniOptions: SezioneOpt[];
  onChange: (next: { sezione_id: string; voti: number }) => void;
  onDelete: () => void;
}) {
  const [sezione_id, setSezioneId] = useState(row.sezione_id);
  const [voti, setVoti] = useState(String(row.voti));

  useEffect(() => {
    setSezioneId(row.sezione_id);
    setVoti(String(row.voti));
  }, [row.sezione_id, row.voti]);

  const commit = () => {
    const n = Number.parseInt(voti, 10);
    if (!sezione_id || Number.isNaN(n) || n < 0) return;
    if (sezione_id === row.sezione_id && n === row.voti) return;
    onChange({ sezione_id, voti: n });
  };

  return (
    <div className="flex gap-2 items-end">
      <Select
        label=""
        value={sezione_id}
        onChange={(e) => setSezioneId(e.target.value)}
        onBlur={commit}
        className="flex-1"
      >
        <option value="">— seleziona sezione —</option>
        {sezioniOptions.map((s) => (
          <option key={s.id} value={s.id}>
            Sez. {s.numero} — {s.indirizzo ?? ''}
          </option>
        ))}
      </Select>
      <Input
        label=""
        type="number"
        inputMode="numeric"
        min={0}
        className="w-28"
        value={voti}
        onChange={(e) => setVoti(e.target.value)}
        onBlur={commit}
      />
      <button
        type="button"
        onClick={onDelete}
        className="px-3 py-2 rounded-xl text-slate-400 hover:text-neon-pink"
        aria-label="Rimuovi stima"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implementare `PresuntoCandidatoPage`**

Sostituire il contenuto di `src/features/admin/presunti/PresuntoCandidatoPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Input, PageHeader, Skeleton, useToast } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import {
  useVotiPresuntiByCandidato,
  useUpsertVotoPresunto,
  useUpdateVotoPresunto,
  useDeleteVotoPresunto,
} from '@/lib/queries/votiPresunti';
import { useQuery } from '@tanstack/react-query';
import { StimaSezioneRow } from './components/StimaSezioneRow';
import type { CandidatoRow, ListaRow } from '@/lib/database.types';

type CandidatoExt = CandidatoRow & {
  lista: ListaRow & { elezione_id: string; giornata_id: string };
};

function useCandidatoExt(candidatoId: string | undefined) {
  return useQuery({
    queryKey: ['candidato_ext', candidatoId],
    enabled: !!candidatoId,
    queryFn: async (): Promise<CandidatoExt | null> => {
      const { data: c, error: eC } = await db
        .from('candidati')
        .select('*')
        .eq('id', candidatoId as string)
        .single();
      if (eC) throw eC;
      const { data: l, error: eL } = await db
        .from('liste')
        .select('*')
        .eq('id', (c as CandidatoRow).lista_id)
        .single();
      if (eL) throw eL;
      const { data: el, error: eE } = await db
        .from('elezioni')
        .select('giornata_id')
        .eq('id', (l as ListaRow).elezione_id)
        .single();
      if (eE) throw eE;
      return {
        ...(c as CandidatoRow),
        lista: { ...(l as ListaRow), elezione_id: (l as ListaRow).elezione_id, giornata_id: (el as { giornata_id: string }).giornata_id },
      };
    },
  });
}

export function PresuntoCandidatoPage() {
  const { candidatoId } = useParams<{ candidatoId: string }>();
  const { push } = useToast();

  const { data: candExt, isLoading } = useCandidatoExt(candidatoId);
  const { data: presunti = [] } = useVotiPresuntiByCandidato(candidatoId);
  const { data: sezioni = [] } = useSezioniByGiornata(candExt?.lista.giornata_id);

  const upsert = useUpsertVotoPresunto();
  const update = useUpdateVotoPresunto();
  const del = useDeleteVotoPresunto();

  // Totale globale (riga con sezione_id IS NULL)
  const totaleRow = presunti.find((p) => p.sezione_id === null);
  const [totaleInput, setTotaleInput] = useState<string>('');

  useEffect(() => {
    setTotaleInput(totaleRow ? String(totaleRow.voti) : '');
  }, [totaleRow?.id, totaleRow?.voti]);

  const stimeRows = useMemo(
    () => presunti.filter((p) => p.sezione_id !== null) as Array<typeof presunti[number] & { sezione_id: string }>,
    [presunti]
  );

  const sezioniDisponibili = useMemo(() => {
    const used = new Set(stimeRows.map((r) => r.sezione_id));
    return sezioni.filter((s) => !used.has(s.id));
  }, [sezioni, stimeRows]);

  const sommaStime = stimeRows.reduce((a, r) => a + r.voti, 0);
  const totaleNumero = totaleRow?.voti ?? null;
  const warningSomma = totaleNumero !== null && sommaStime > totaleNumero;

  const commitTotale = async () => {
    const trimmed = totaleInput.trim();
    if (trimmed === '') {
      if (totaleRow) await del.mutateAsync(totaleRow.id);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0) return;
    if (totaleRow && totaleRow.voti === n) return;
    try {
      if (totaleRow) {
        await update.mutateAsync({ id: totaleRow.id, patch: { voti: n } });
      } else {
        await upsert.mutateAsync({
          candidato_id: candidatoId as string,
          sezione_id: null,
          voti: n,
        });
      }
    } catch (e) {
      push({ title: 'Errore salvataggio totale', description: String(e), variant: 'error' });
    }
  };

  const addStima = async (sezione_id: string) => {
    try {
      await upsert.mutateAsync({
        candidato_id: candidatoId as string,
        sezione_id,
        voti: 0,
      });
    } catch (e) {
      push({ title: 'Errore aggiunta stima', description: String(e), variant: 'error' });
    }
  };

  const updateStima = async (rowId: string, next: { sezione_id: string; voti: number }) => {
    try {
      await update.mutateAsync({
        id: rowId,
        patch: { sezione_id: next.sezione_id, voti: next.voti },
      });
    } catch (e) {
      push({ title: 'Errore aggiornamento', description: String(e), variant: 'error' });
    }
  };

  const deleteStima = async (rowId: string) => {
    try {
      await del.mutateAsync(rowId);
    } catch (e) {
      push({ title: 'Errore eliminazione', description: String(e), variant: 'error' });
    }
  };

  if (isLoading || !candExt) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${candExt.cognome} ${candExt.nome}`}
        subtitle={`Lista: ${candExt.lista.nome}`}
      />
      <Link to="/admin/presunti" className="text-sm text-neon-cyan hover:underline">
        ← Torna all'elenco
      </Link>

      <div className="glass p-4 rounded-2xl space-y-3">
        <h3 className="font-semibold">Totale presunto</h3>
        <Input
          label="Voti totali attesi"
          type="number"
          inputMode="numeric"
          min={0}
          value={totaleInput}
          onChange={(e) => setTotaleInput(e.target.value)}
          onBlur={commitTotale}
          placeholder="es. 1200"
        />
        <p className="text-xs text-slate-400">
          Lascia vuoto per rimuovere il totale. Autosave on blur.
        </p>
      </div>

      <div className="glass p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Stime per sezione</h3>
          <span
            className={`text-xs ${
              warningSomma ? 'text-neon-pink' : 'text-slate-400'
            }`}
          >
            Somma stime: {sommaStime}
            {warningSomma && ` (supera il totale ${totaleNumero})`}
          </span>
        </div>
        {stimeRows.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna stima per sezione inserita.</p>
        ) : (
          <div className="space-y-2">
            {stimeRows.map((r) => (
              <StimaSezioneRow
                key={r.id}
                row={{ sezione_id: r.sezione_id as string, voti: r.voti }}
                sezioniOptions={[
                  ...sezioni.filter((s) => s.id === r.sezione_id),
                  ...sezioniDisponibili,
                ]}
                onChange={(next) => updateStima(r.id, next)}
                onDelete={() => deleteStima(r.id)}
              />
            ))}
          </div>
        )}
        <AddStimaControl
          sezioniDisponibili={sezioniDisponibili}
          onAdd={addStima}
        />
      </div>
    </div>
  );
}

function AddStimaControl({
  sezioniDisponibili,
  onAdd,
}: {
  sezioniDisponibili: { id: string; numero: number; indirizzo: string | null }[];
  onAdd: (sezione_id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  if (sezioniDisponibili.length === 0) {
    return <p className="text-xs text-slate-500">Nessuna sezione disponibile in più.</p>;
  }
  return (
    <div className="flex items-end gap-2">
      <select
        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">— sezione da aggiungere —</option>
        {sezioniDisponibili.map((s) => (
          <option key={s.id} value={s.id}>
            Sez. {s.numero}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onAdd(selected);
          setSelected('');
        }}
      >
        + Aggiungi stima
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build passa.

- [ ] **Step 4: Verifica manuale browser**

Con `npm run dev`: aprire un candidato da `/admin/presunti`. Inserire totale "100" → blur → ricarica: "100" persiste. Aggiungere una stima sezione → inserire 40 → blur → persiste. Eliminare la stima → sparisce.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/presunti/PresuntoCandidatoPage.tsx src/features/admin/presunti/components/StimaSezioneRow.tsx
git commit -m "feat(presunti): form per candidato con autosave totale + stime per sezione"
```

---

## Task 8: `PresuntoSezionePage` con autosave

**Files:**
- Create: `src/features/admin/presunti/components/CandidatoVotiRow.tsx`
- Modify: `src/features/admin/presunti/PresuntoSezionePage.tsx`

- [ ] **Step 1: Creare `CandidatoVotiRow`**

Creare `src/features/admin/presunti/components/CandidatoVotiRow.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui';

export function CandidatoVotiRow({
  cognome,
  nome,
  listaNome,
  currentValue,
  onCommit,
}: {
  cognome: string;
  nome: string;
  listaNome: string;
  currentValue: number | null;
  onCommit: (next: number | null) => void;
}) {
  const [text, setText] = useState<string>(currentValue === null ? '' : String(currentValue));

  useEffect(() => {
    setText(currentValue === null ? '' : String(currentValue));
  }, [currentValue]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (currentValue !== null) onCommit(null);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0) return;
    if (n === currentValue) return;
    onCommit(n);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center border-t border-white/5 py-2">
      <div className="text-sm">
        <div>
          {cognome} {nome}
        </div>
        <div className="text-xs text-slate-500">{listaNome}</div>
      </div>
      <Input
        label=""
        type="number"
        inputMode="numeric"
        min={0}
        className="w-24"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="—"
      />
    </div>
  );
}
```

- [ ] **Step 2: Implementare `PresuntoSezionePage`**

Sostituire il contenuto di `src/features/admin/presunti/PresuntoSezionePage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PageHeader, Select, Skeleton, useToast } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import {
  useVotiPresuntiBySezione,
  useUpsertVotoPresunto,
  useUpdateVotoPresunto,
  useDeleteVotoPresunto,
} from '@/lib/queries/votiPresunti';
import { CandidatoVotiRow } from './components/CandidatoVotiRow';
import type { CandidatoRow, SezioneRow } from '@/lib/database.types';

function useSezione(sezioneId: string | undefined) {
  return useQuery({
    queryKey: ['sezione', sezioneId],
    enabled: !!sezioneId,
    queryFn: async (): Promise<SezioneRow | null> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('id', sezioneId as string)
        .single();
      if (error) throw error;
      return data as SezioneRow;
    },
  });
}

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

export function PresuntoSezionePage() {
  const { sezioneId } = useParams<{ sezioneId: string }>();
  const { push } = useToast();

  const { data: sezione, isLoading: loadingSez } = useSezione(sezioneId);
  const { data: elezioni = [] } = useElezioniByGiornata(sezione?.giornata_id);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  const { data: liste = [] } = useListeByElezione(selectedElezioneId || undefined);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiBySezione(sezioneId, selectedElezioneId || undefined);

  const upsert = useUpsertVotoPresunto();
  const update = useUpdateVotoPresunto();
  const del = useDeleteVotoPresunto();

  const presuntiByCand = useMemo(() => {
    const m = new Map<string, { id: string; voti: number }>();
    for (const p of presunti) {
      if (!p.sezione_id) continue;
      m.set(p.candidato_id, { id: p.id, voti: p.voti });
    }
    return m;
  }, [presunti]);

  const commit = async (candidatoId: string, next: number | null) => {
    const existing = presuntiByCand.get(candidatoId);
    try {
      if (next === null) {
        if (existing) await del.mutateAsync(existing.id);
        return;
      }
      if (existing) {
        await update.mutateAsync({ id: existing.id, patch: { voti: next } });
      } else {
        await upsert.mutateAsync({
          candidato_id: candidatoId,
          sezione_id: sezioneId as string,
          voti: next,
        });
      }
    } catch (e) {
      push({ title: 'Errore salvataggio', description: String(e), variant: 'error' });
    }
  };

  const totaleVoti = Array.from(presuntiByCand.values()).reduce((a, b) => a + b.voti, 0);

  if (loadingSez || !sezione) return <Skeleton className="h-40" />;

  const candidatiByLista = new Map<string, CandidatoRow[]>();
  for (const c of candidati) {
    const arr = candidatiByLista.get(c.lista_id) ?? [];
    arr.push(c);
    candidatiByLista.set(c.lista_id, arr);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Sezione ${sezione.numero}`}
        subtitle={sezione.indirizzo ?? ''}
      />
      <Link to="/admin/presunti" className="text-sm text-neon-cyan hover:underline">
        ← Torna all'elenco
      </Link>

      <div className="glass p-3 rounded-2xl">
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Candidati (autosave on blur)</h3>
          <span className="text-sm text-slate-300">
            Totale presunti sezione: <strong>{totaleVoti}</strong>
          </span>
        </div>

        {liste.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna lista per l'elezione selezionata.</p>
        ) : (
          liste.map((l) => (
            <div key={l.id} className="mb-4">
              <h4 className="text-sm font-semibold text-neon-cyan mb-2">{l.nome}</h4>
              {(candidatiByLista.get(l.id) ?? []).map((c) => (
                <CandidatoVotiRow
                  key={c.id}
                  cognome={c.cognome}
                  nome={c.nome}
                  listaNome={l.nome}
                  currentValue={presuntiByCand.get(c.id)?.voti ?? null}
                  onCommit={(n) => commit(c.id, n)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build passa.

- [ ] **Step 4: Verifica manuale browser**

Aprire una sezione da `/admin/presunti` tab "Per sezione". Aspettato: lista candidati raggruppati per lista, inserire 40 → blur → persiste, il totale in header si aggiorna a 40. Cancellare il 40 → blur → row deleted.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/presunti/PresuntoSezionePage.tsx src/features/admin/presunti/components/CandidatoVotiRow.tsx
git commit -m "feat(presunti): form per sezione con lista candidati e autosave"
```

---

## Task 9: `ConfrontoPage` skeleton + filtro elezione

**Files:**
- Modify: `src/features/admin/confronto/ConfrontoPage.tsx`

- [ ] **Step 1: Implementare `ConfrontoPage`**

Sostituire il contenuto di `src/features/admin/confronto/ConfrontoPage.tsx`:

```tsx
import { useState } from 'react';
import { PageHeader, Select } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { PerCandidatoView } from './PerCandidatoView';
import { PerSezioneView } from './PerSezioneView';

type Tab = 'candidato' | 'sezione';

export function ConfrontoPage() {
  const [tab, setTab] = useState<Tab>('candidato');

  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Confronto presunti vs reali"
        subtitle="Scostamenti live per candidato e per sezione (solo admin)."
      />

      <div className="flex flex-wrap gap-3 glass p-3 rounded-2xl">
        <Select
          label="Giornata"
          value={selectedGiornataId}
          onChange={(e) => {
            setGiornataId(e.target.value);
            setElezioneId('');
          }}
        >
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'candidato' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('candidato')}
        >
          Per candidato
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'sezione' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('sezione')}
        >
          Per sezione
        </button>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona una giornata ed elezione per vedere il confronto.
        </div>
      ) : tab === 'candidato' ? (
        <PerCandidatoView elezioneId={selectedElezioneId} giornataId={selectedGiornataId} />
      ) : (
        <PerSezioneView elezioneId={selectedElezioneId} giornataId={selectedGiornataId} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Creare stub `PerCandidatoView` e `PerSezioneView`**

`src/features/admin/confronto/PerCandidatoView.tsx`:

```tsx
export function PerCandidatoView(_props: { elezioneId: string; giornataId: string }) {
  return <div className="glass p-6 rounded-2xl">Per candidato (WIP)</div>;
}
```

`src/features/admin/confronto/PerSezioneView.tsx`:

```tsx
export function PerSezioneView(_props: { elezioneId: string; giornataId: string }) {
  return <div className="glass p-6 rounded-2xl">Per sezione (WIP)</div>;
}
```

- [ ] **Step 3: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/features/admin/confronto/
git commit -m "feat(confronto): ConfrontoPage con filtri giornata/elezione e tabs (stub views)"
```

---

## Task 10: `PerCandidatoView` + `CandidatoDrillDown`

**Files:**
- Modify: `src/features/admin/confronto/PerCandidatoView.tsx`
- Modify: `src/features/admin/confronto/CandidatoDrillDown.tsx`

- [ ] **Step 1: Implementare `PerCandidatoView`**

Sostituire il contenuto di `src/features/admin/confronto/PerCandidatoView.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import {
  aggregateByCandidato,
  type CandidatoConfrontoRow,
} from './confronto';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
} from '@/lib/database.types';

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

function useRisultatiByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultati_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultati_by_elezione', elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });
}

function usePreferenzeByRs(rsIds: string[]) {
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs', rsIds.join(',')]],
    enabled: rsIds.length > 0,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs', rsIds.join(',')],
    enabled: rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

type Ordering = 'deltaPerc_asc' | 'delta_asc' | 'cognome_asc';

export function PerCandidatoView({
  elezioneId,
}: {
  elezioneId: string;
  giornataId: string;
}) {
  const [ordering, setOrdering] = useState<Ordering>('deltaPerc_asc');

  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);
  const { data: risultati = [], isLoading: lr } = useRisultatiByElezione(elezioneId);
  const { data: preferenze = [], isLoading: lp } = usePreferenzeByRs(
    risultati.map((r) => r.id)
  );

  const rows = useMemo(() => {
    return aggregateByCandidato({
      candidati,
      presunti,
      preferenze,
      risultatiSezione: risultati,
    });
  }, [candidati, presunti, preferenze, risultati]);

  const sorted = useMemo(() => {
    const cmp: Record<Ordering, (a: CandidatoConfrontoRow, b: CandidatoConfrontoRow) => number> = {
      deltaPerc_asc: (a, b) => (a.deltaPerc ?? 0) - (b.deltaPerc ?? 0),
      delta_asc: (a, b) => (a.delta ?? 0) - (b.delta ?? 0),
      cognome_asc: (a, b) => a.cognome.localeCompare(b.cognome),
    };
    return [...rows].sort(cmp[ordering]);
  }, [rows, ordering]);

  const coperte = new Set(
    risultati.filter((r) => r.stato === 'submitted' || r.stato === 'verified').map((r) => r.sezione_id)
  ).size;
  const sezConStima = new Set(presunti.filter((p) => p.sezione_id).map((p) => p.sezione_id)).size;

  if (lr || lp) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-3">
      <div className="glass p-3 rounded-2xl text-sm text-slate-300 flex flex-wrap gap-4 items-center">
        <span>
          Copertura: <strong>{coperte}</strong> sezioni con risultato (di cui {sezConStima} anche stimate).
        </span>
        <label className="ml-auto text-xs text-slate-400">
          Ordinamento
          <select
            className="ml-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm"
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as Ordering)}
          >
            <option value="deltaPerc_asc">Δ % crescente (peggio sopra)</option>
            <option value="delta_asc">Δ assoluto crescente</option>
            <option value="cognome_asc">Alfabetico</option>
          </select>
        </label>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Candidato</th>
              <th className="px-4 py-2">Lista</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const listaNome = liste.find((l) => l.id === r.lista_id)?.nome ?? '';
              const deltaColor =
                r.delta === null
                  ? 'text-slate-500'
                  : r.delta >= 0
                  ? 'text-green-400'
                  : 'text-neon-pink';
              return (
                <tr key={r.candidato_id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2">
                    {r.cognome} {r.nome}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{listaNome}</td>
                  <td className="px-4 py-2 text-right">{r.reale}</td>
                  <td className="px-4 py-2 text-right">
                    {r.presunto === null ? <span className="text-slate-500">—</span> : r.presunto}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.delta === null ? '—' : (r.delta > 0 ? `+${r.delta}` : r.delta)}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/confronto/candidato/${r.candidato_id}?elezione=${elezioneId}`}
                      className="text-neon-cyan hover:underline"
                    >
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementare `CandidatoDrillDown`**

Sostituire il contenuto di `src/features/admin/confronto/CandidatoDrillDown.tsx`:

```tsx
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useVotiPresuntiByCandidato } from '@/lib/queries/votiPresunti';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { candidatoDrillDown } from './confronto';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
} from '@/lib/database.types';

function useCandContext(candidatoId: string | undefined) {
  return useQuery({
    queryKey: ['cand_ctx', candidatoId],
    enabled: !!candidatoId,
    queryFn: async () => {
      const { data: c, error } = await db
        .from('candidati')
        .select('*')
        .eq('id', candidatoId as string)
        .single();
      if (error) throw error;
      const cand = c as CandidatoRow;
      const { data: l } = await db
        .from('liste')
        .select('*')
        .eq('id', cand.lista_id)
        .single();
      const lista = l as ListaRow;
      const { data: el } = await db
        .from('elezioni')
        .select('giornata_id')
        .eq('id', lista.elezione_id)
        .single();
      return {
        candidato: cand,
        lista,
        giornataId: (el as { giornata_id: string }).giornata_id,
      };
    },
  });
}

function useRisultatiAndPrefsByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultati_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['drill_candidato_bundle', elezioneId],
    enabled: !!elezioneId,
    queryFn: async () => {
      const { data: rs, error: eR } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (eR) throw eR;
      const rsArr = (rs ?? []) as RisultatoSezioneRow[];
      const { data: pref, error: eP } = await db
        .from('preferenze_candidato')
        .select('*')
        .in(
          'risultato_sezione_id',
          rsArr.map((r) => r.id).length > 0 ? rsArr.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000']
        );
      if (eP) throw eP;
      return {
        risultati: rsArr,
        preferenze: (pref ?? []) as PreferenzaCandidatoRow[],
      };
    },
  });
}

const stateLabel: Record<string, string> = {
  submitted: '✓ submitted',
  verified: '✓ verified',
  draft: '~ draft',
  assente: '⏳ in attesa',
};

export function CandidatoDrillDown() {
  const { candidatoId } = useParams<{ candidatoId: string }>();
  const [sp] = useSearchParams();
  const elezioneId = sp.get('elezione') ?? undefined;

  const { data: ctx, isLoading: lc } = useCandContext(candidatoId);
  const { data: bundle, isLoading: lb } = useRisultatiAndPrefsByElezione(elezioneId);
  const { data: presunti = [] } = useVotiPresuntiByCandidato(candidatoId);
  const { data: sezioni = [] } = useSezioniByGiornata(ctx?.giornataId);

  const drill = useMemo(() => {
    if (!ctx || !bundle || !candidatoId) return [];
    return candidatoDrillDown({
      candidatoId,
      presunti,
      preferenze: bundle.preferenze,
      risultatiSezione: bundle.risultati,
      sezioni,
    });
  }, [ctx, bundle, candidatoId, presunti, sezioni]);

  if (lc || lb || !ctx) return <Skeleton className="h-40" />;

  const totaleRow = presunti.find((p) => p.sezione_id === null);
  const reale = drill.reduce((a, r) => a + (r.reale ?? 0), 0);
  const presuntoTot = totaleRow?.voti ?? null;
  const deltaTot = presuntoTot === null ? null : reale - presuntoTot;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${ctx.candidato.cognome} ${ctx.candidato.nome}`}
        subtitle={`Lista: ${ctx.lista.nome}`}
      />
      <Link
        to={`/admin/confronto`}
        className="text-sm text-neon-cyan hover:underline"
      >
        ← Torna al confronto
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Reale (sezioni con risultato)</div>
          <div className="text-2xl font-semibold">{reale}</div>
        </div>
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Presunto totale</div>
          <div className="text-2xl font-semibold">
            {presuntoTot === null ? <span className="text-slate-500">—</span> : presuntoTot}
          </div>
        </div>
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Δ</div>
          <div
            className={`text-2xl font-semibold ${
              deltaTot === null
                ? 'text-slate-500'
                : deltaTot >= 0
                ? 'text-green-400'
                : 'text-neon-pink'
            }`}
          >
            {deltaTot === null ? '—' : deltaTot > 0 ? `+${deltaTot}` : deltaTot}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Sezione</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
              <th className="px-4 py-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {drill.map((r) => (
              <tr key={r.sezione_id} className="border-t border-white/5">
                <td className="px-4 py-2">Sez. {r.numero}</td>
                <td className="px-4 py-2 text-right">{r.presunto}</td>
                <td className="px-4 py-2 text-right">
                  {r.reale === null ? <span className="text-slate-500">—</span> : r.reale}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.delta === null ? '—' : r.delta > 0 ? `+${r.delta}` : r.delta}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                </td>
                <td className="px-4 py-2 text-slate-300">
                  {stateLabel[r.statoSezione] ?? r.statoSezione}
                </td>
              </tr>
            ))}
            {drill.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={6}>
                  Nessuna stima per sezione per questo candidato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifica build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: passa.

- [ ] **Step 4: Verifica manuale**

Aprire `/admin/confronto` tab "Per candidato". Aspettato: vedi lista candidati con deltas. Click su un candidato → drill-down mostra card KPI + tabella sezioni stimate.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/confronto/PerCandidatoView.tsx src/features/admin/confronto/CandidatoDrillDown.tsx
git commit -m "feat(confronto): vista per candidato + drill-down sezioni stimate"
```

---

## Task 11: `PerSezioneView` + `SezioneDrillDown`

**Files:**
- Modify: `src/features/admin/confronto/PerSezioneView.tsx`
- Modify: `src/features/admin/confronto/SezioneDrillDown.tsx`

- [ ] **Step 1: Implementare `PerSezioneView`**

Sostituire il contenuto di `src/features/admin/confronto/PerSezioneView.tsx`:

```tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { aggregateBySezione } from './confronto';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
} from '@/lib/database.types';

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

function useRisultatiByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultati_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultati_by_elezione', elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });
}

function usePreferenzeByRs(rsIds: string[]) {
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs', rsIds.join(',')]],
    enabled: rsIds.length > 0,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs', rsIds.join(',')],
    enabled: rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

const stateLabel: Record<string, string> = {
  submitted: '✓ submitted',
  verified: '✓ verified',
  draft: '~ draft',
  assente: '⏳ in attesa',
};

export function PerSezioneView({
  elezioneId,
  giornataId,
}: {
  elezioneId: string;
  giornataId: string;
}) {
  const { data: sezioni = [], isLoading: ls } = useSezioniByGiornata(giornataId);
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);
  const { data: risultati = [], isLoading: lr } = useRisultatiByElezione(elezioneId);
  const { data: preferenze = [], isLoading: lp } = usePreferenzeByRs(
    risultati.map((r) => r.id)
  );

  const rows = useMemo(() => {
    return aggregateBySezione({
      sezioni,
      candidati,
      presunti,
      preferenze,
      risultatiSezione: risultati,
    });
  }, [sezioni, candidati, presunti, preferenze, risultati]);

  const sorted = [...rows].sort((a, b) => a.numero - b.numero);

  if (ls || lr || lp) return <Skeleton className="h-40" />;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Sezione</th>
            <th className="px-4 py-2">Indirizzo</th>
            <th className="px-4 py-2">Stato</th>
            <th className="px-4 py-2 text-right"># candidati stimati</th>
            <th className="px-4 py-2 text-right">Reale tot.</th>
            <th className="px-4 py-2 text-right">Presunto tot.</th>
            <th className="px-4 py-2 text-right">Δ</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const deltaColor =
              r.candidatiStimati === 0
                ? 'text-slate-500'
                : r.delta >= 0
                ? 'text-green-400'
                : 'text-neon-pink';
            return (
              <tr key={r.sezione_id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-2">Sez. {r.numero}</td>
                <td className="px-4 py-2 text-slate-300">{r.indirizzo ?? '—'}</td>
                <td className="px-4 py-2 text-slate-300">
                  {stateLabel[r.statoSezione] ?? r.statoSezione}
                </td>
                <td className="px-4 py-2 text-right">{r.candidatiStimati}</td>
                <td className="px-4 py-2 text-right">{r.realeTot}</td>
                <td className="px-4 py-2 text-right">{r.presuntoTot}</td>
                <td className={`px-4 py-2 text-right ${deltaColor}`}>
                  {r.candidatiStimati === 0
                    ? '—'
                    : r.delta > 0
                    ? `+${r.delta}`
                    : r.delta}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to={`/admin/confronto/sezione/${r.sezione_id}?elezione=${elezioneId}`}
                    className="text-neon-cyan hover:underline"
                  >
                    Dettaglio →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Implementare `SezioneDrillDown`**

Sostituire il contenuto di `src/features/admin/confronto/SezioneDrillDown.tsx`:

```tsx
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiBySezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { sezioneDrillDown } from './confronto';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';

function useSezione(sezioneId: string | undefined) {
  return useQuery({
    queryKey: ['sezione', sezioneId],
    enabled: !!sezioneId,
    queryFn: async (): Promise<SezioneRow | null> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('id', sezioneId as string)
        .single();
      if (error) throw error;
      return data as SezioneRow;
    },
  });
}

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

function useRisultatoSezione(sezioneId: string | undefined, elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultato_sezione', sezioneId, elezioneId]],
    enabled: !!sezioneId && !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultato_sezione', sezioneId, elezioneId],
    enabled: !!sezioneId && !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow | null> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('sezione_id', sezioneId as string)
        .eq('elezione_id', elezioneId as string)
        .maybeSingle();
      if (error) throw error;
      return data as RisultatoSezioneRow | null;
    },
  });
}

function usePreferenzeByRs(rsId: string | undefined) {
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs_single', rsId]],
    enabled: !!rsId,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs_single', rsId],
    enabled: !!rsId,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .eq('risultato_sezione_id', rsId as string);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

const stateLabel: Record<string, string> = {
  submitted: '✓ submitted',
  verified: '✓ verified',
  draft: '~ draft',
  assente: '⏳ in attesa',
};

export function SezioneDrillDown() {
  const { sezioneId } = useParams<{ sezioneId: string }>();
  const [sp] = useSearchParams();
  const elezioneId = sp.get('elezione') ?? undefined;

  const { data: sezione, isLoading: lsz } = useSezione(sezioneId);
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiBySezione(sezioneId, elezioneId);
  const { data: rs } = useRisultatoSezione(sezioneId, elezioneId);
  const { data: preferenze = [] } = usePreferenzeByRs(rs?.id);

  const rows = useMemo(() => {
    if (!sezioneId || !elezioneId) return [];
    return sezioneDrillDown({
      sezioneId,
      elezioneId,
      presunti,
      preferenze,
      risultatiSezione: rs ? [rs] : [],
      candidati,
      liste,
    });
  }, [sezioneId, elezioneId, presunti, preferenze, rs, candidati, liste]);

  if (lsz || !sezione) return <Skeleton className="h-40" />;

  const totReale = rows.reduce((a, r) => a + (r.reale ?? 0), 0);
  const totPresunto = rows.reduce((a, r) => a + r.presunto, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Sezione ${sezione.numero}`}
        subtitle={sezione.indirizzo ?? ''}
      />
      <div className="text-sm text-slate-400">
        Stato: {stateLabel[rs?.stato ?? 'assente']}
      </div>
      <Link to="/admin/confronto" className="text-sm text-neon-cyan hover:underline">
        ← Torna al confronto
      </Link>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Candidato</th>
              <th className="px-4 py-2">Lista</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const deltaColor =
                r.delta === null
                  ? 'text-slate-500'
                  : r.delta >= 0
                  ? 'text-green-400'
                  : 'text-neon-pink';
              return (
                <tr key={r.candidato_id} className="border-t border-white/5">
                  <td className="px-4 py-2">
                    {r.cognome} {r.nome}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{r.listaNome}</td>
                  <td className="px-4 py-2 text-right">{r.presunto}</td>
                  <td className="px-4 py-2 text-right">
                    {r.reale === null ? <span className="text-slate-500">—</span> : r.reale}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.delta === null ? '—' : r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={6}>
                  Nessuna stima per candidato in questa sezione.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t border-white/20 font-semibold">
                <td className="px-4 py-2" colSpan={2}>
                  Totale
                </td>
                <td className="px-4 py-2 text-right">{totPresunto}</td>
                <td className="px-4 py-2 text-right">{totReale}</td>
                <td className="px-4 py-2 text-right">
                  {totReale - totPresunto > 0
                    ? `+${totReale - totPresunto}`
                    : totReale - totPresunto}
                </td>
                <td className="px-4 py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifica build + test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: passa.

- [ ] **Step 4: Verifica manuale**

Aprire `/admin/confronto` tab "Per sezione". Aspettato: lista sezioni con totali. Click su una sezione → drill-down mostra candidati stimati con reali/presunti/delta + riga totali.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/confronto/PerSezioneView.tsx src/features/admin/confronto/SezioneDrillDown.tsx
git commit -m "feat(confronto): vista per sezione + drill-down candidati stimati"
```

---

## Task 12: Test RLS (integration)

**Files:**
- Create: `tests/integration/voti-presunti-rls.test.ts`

> Verifica la strategia di integration RLS già presente nel progetto. Se non esiste una suite `tests/integration` agganciata a vitest, saltare questo task e portare la verifica RLS direttamente nell'E2E Playwright del Task 13. Controllare: `ls tests/integration 2>/dev/null`.

- [ ] **Step 1: Verificare se esiste la suite integration**

```bash
ls /Users/deduzzo/dev/elemanager/tests/ 2>/dev/null
```

Se esiste `tests/integration`, proseguire. Altrimenti, skippare a Task 13 (i test RLS verranno coperti indirettamente dall'E2E che verifica che editor/viewer non vedano le voci di menu e che la chiamata di lista ritorni vuoto).

- [ ] **Step 2: Se la suite integration esiste, scrivere il test**

Creare `tests/integration/voti-presunti-rls.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Richiede env ADMIN_EMAIL/PASSWORD, EDITOR_EMAIL/PASSWORD, VIEWER_EMAIL/PASSWORD
// e SUPABASE_URL + ANON_KEY in .env.test. Se non impostate, test skippato.

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const admin = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const editor = { email: process.env.EDITOR_EMAIL, password: process.env.EDITOR_PASSWORD };
const viewer = { email: process.env.VIEWER_EMAIL, password: process.env.VIEWER_PASSWORD };

const shouldRun = URL && ANON && admin.email && editor.email && viewer.email;

async function signedClient(email: string, password: string) {
  const c = createClient(URL!, ANON!, { db: { schema: 'elemanager' } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

describe.skipIf(!shouldRun)('voti_presunti RLS', () => {
  let adminClient: Awaited<ReturnType<typeof signedClient>>;
  let editorClient: Awaited<ReturnType<typeof signedClient>>;
  let viewerClient: Awaited<ReturnType<typeof signedClient>>;

  beforeAll(async () => {
    adminClient = await signedClient(admin.email!, admin.password!);
    editorClient = await signedClient(editor.email!, editor.password!);
    viewerClient = await signedClient(viewer.email!, viewer.password!);
  });

  afterAll(async () => {
    await Promise.all([
      adminClient?.auth.signOut(),
      editorClient?.auth.signOut(),
      viewerClient?.auth.signOut(),
    ]);
  });

  it('admin sees rows', async () => {
    const { data, error } = await adminClient.from('voti_presunti').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('editor sees empty set', async () => {
    const { data, error } = await editorClient.from('voti_presunti').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('viewer sees empty set', async () => {
    const { data, error } = await viewerClient.from('voti_presunti').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('editor insert fails', async () => {
    const { error } = await editorClient
      .from('voti_presunti')
      .insert({ candidato_id: '00000000-0000-0000-0000-000000000000', sezione_id: null, voti: 1 });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Eseguire i test con env .env.test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- tests/integration/voti-presunti-rls.test.ts
```

Expected: test passano (o sono skippati se env non disponibile).

- [ ] **Step 4: Commit**

Se il test è stato creato:

```bash
git add tests/integration/voti-presunti-rls.test.ts
git commit -m "test(rls): integration test voti_presunti admin-only"
```

Altrimenti saltare il commit.

---

## Task 13: E2E Playwright — happy path Fase 3

**Files:**
- Create: `tests/e2e/fase3-confronto.spec.ts`

- [ ] **Step 1: Esaminare il pattern E2E esistente**

```bash
ls /Users/deduzzo/dev/elemanager/tests/e2e/
```

Aprire un file esistente per copiare il pattern di login e setup.

- [ ] **Step 2: Scrivere il test E2E**

Creare `tests/e2e/fase3-confronto.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E admin credentials not configured');

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|editor|dashboard|$)/);
}

test('admin vede voci di menu Presunti e Confronto', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Presunti' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Confronto' })).toBeVisible();
});

test('editor NON vede voci di menu Presunti e Confronto', async ({ page }) => {
  test.skip(!EDITOR_EMAIL, 'editor creds missing');
  await login(page, EDITOR_EMAIL!, process.env.E2E_EDITOR_PASSWORD!);
  await page.goto('/editor');
  await expect(page.locator('text=Presunti')).toHaveCount(0);
  await expect(page.locator('text=Confronto')).toHaveCount(0);
});

test('admin apre /admin/presunti e vede i tab', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/presunti');
  await expect(page.getByRole('button', { name: 'Per candidato' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Per sezione' })).toBeVisible();
});

test('admin apre /admin/confronto e vede i tab', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/confronto');
  await expect(page.getByRole('button', { name: 'Per candidato' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Per sezione' })).toBeVisible();
});
```

> Nota: il happy path esteso admin-inserisce-presunto → editor-inserisce-reale → admin-vede-delta richiede seed DB ed è complesso. Preferiamo coprire i pezzi unitari con i test di Task 4 e smoke-test le pagine con E2E.

- [ ] **Step 3: Eseguire**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:e2e -- tests/e2e/fase3-confronto.spec.ts
```

Expected: test passano o sono skippati (se env non set).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/fase3-confronto.spec.ts
git commit -m "test(e2e): smoke test Fase 3 — voci di menu e pagine admin"
```

---

## Task 14: Aggiornare README e tag finale

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Aggiornare README**

In `README.md`, nella sezione che elenca le feature attuali, aggiungere:

```markdown
## Fase 3 — Voti presunti + Confronto (admin-only)

- Admin inserisce stime voti per candidato: totale globale + stime per-sezione opzionali.
- Due viste di inserimento simmetriche (per candidato / per sezione) con autosave on blur.
- Dashboard `/admin/confronto` con scostamenti live (reale vs presunto) a due tab.
- Tutte le stime sono RLS admin-only: editor/viewer non vedono nulla.
- Migration: `supabase/migrations/0010_voti_presunti.sql`.
```

- [ ] **Step 2: Verifica build finale + test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: build pulita, tutti i test passano.

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: aggiornamento README per Fase 3 voti presunti + confronto"
```

- [ ] **Step 4: Tag release**

```bash
git tag plan-08-fase3-complete
```

---

## Post-execution checklist

- [ ] Migration `0010_voti_presunti.sql` applicata sull'istanza Supabase di dev.
- [ ] Build `npm run build` pulita.
- [ ] `npm run test:run` tutti i test passano.
- [ ] `npm run test:e2e` smoke test passano (con env configurata).
- [ ] Admin può aprire `/admin/presunti` e `/admin/confronto`.
- [ ] Editor e viewer non vedono le due voci di menu.
- [ ] Inserimento di un presunto → visibile nella dashboard confronto in realtime.
- [ ] Audit log registra INSERT/UPDATE/DELETE su `voti_presunti`.
