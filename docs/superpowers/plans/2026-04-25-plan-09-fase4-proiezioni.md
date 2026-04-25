# Fase 4 — Proiezioni statistiche pesate per circoscrizione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare la pagina admin `/admin/proiezioni` con 6 widget (KPI, bar chart liste, top candidati, sezioni mancanti, matrice circoscrizione × lista, export CSV) basata su pure functions di proiezione pesata per circoscrizione, come da spec `docs/superpowers/specs/2026-04-25-elemanager-fase4-proiezioni-design.md`.

**Architecture:** Nessuna nuova tabella o migration. Pure functions in `proiezioni.ts` (unit-testate via Vitest, TDD). Hook bundle `useProiezioniData(elezioneId)` orchestra fetch parallele con `useQueries` + realtime. Pagina single-page con widget React usando Recharts (già nel progetto) e `papaparse.unparse` per CSV.

**Tech Stack:** React 18 + Vite + TS + Tailwind, TanStack Query, Recharts, papaparse, Vitest, Playwright. Tutto già presente nel `package.json`.

---

## File Structure

**Pure functions + tests:**
- Create: `src/features/admin/proiezioni/proiezioni.ts`
- Create: `src/features/admin/proiezioni/proiezioni.test.ts`

**Hook bundle:**
- Create: `src/lib/queries/proiezioni.ts`

**CSV utility:**
- Create: `src/features/admin/proiezioni/csvExport.ts`
- Create: `src/features/admin/proiezioni/csvExport.test.ts`

**Page + widgets:**
- Create: `src/features/admin/proiezioni/ProiezioniPage.tsx`
- Create: `src/features/admin/proiezioni/components/KPIHeader.tsx`
- Create: `src/features/admin/proiezioni/components/ProiezioneListeChart.tsx`
- Create: `src/features/admin/proiezioni/components/ProiezioneCandidatiTop.tsx`
- Create: `src/features/admin/proiezioni/components/SezioniMancantiList.tsx`
- Create: `src/features/admin/proiezioni/components/MatriceCircoscrizioneListe.tsx`
- Create: `src/features/admin/proiezioni/components/ExportCsvButtons.tsx`

**Routing + menu:**
- Modify: `src/app/router.tsx`
- Modify: `src/features/admin/AdminLayout.tsx`
- Modify: `src/features/admin/AdminIndexPage.tsx`

**E2E:**
- Create: `tests/e2e/fase4-proiezioni.spec.ts`

**Docs:**
- Modify: `README.md`

---

## Task 1: Pure functions — coperture per circoscrizione (TDD)

**Files:**
- Create: `src/features/admin/proiezioni/proiezioni.ts`
- Create: `src/features/admin/proiezioni/proiezioni.test.ts`

- [ ] **Step 1: Scrivere il test FAIL**

Creare `src/features/admin/proiezioni/proiezioni.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { coperturePerCircoscrizione } from './proiezioni';
import type {
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';

const sez = (
  id: string,
  numero: number,
  circoscrizione: number | null,
  giornata_id = 'g1',
): SezioneRow => ({
  id,
  giornata_id,
  numero,
  indirizzo: null,
  ubicazione: null,
  lat: null,
  lng: null,
  circoscrizione,
  note: null,
  accessibilita: null,
});

const rs = (overrides: Partial<RisultatoSezioneRow>): RisultatoSezioneRow => ({
  id: overrides.id ?? 'rs',
  sezione_id: overrides.sezione_id ?? 'sez',
  elezione_id: overrides.elezione_id ?? 'el1',
  schede_totali: null,
  schede_bianche: null,
  schede_nulle: null,
  schede_contestate: null,
  stato: overrides.stato ?? 'submitted',
  created_by: null,
  updated_by: null,
  created_at: '2026-04-25T00:00:00Z',
  updated_at: '2026-04-25T00:00:00Z',
});

describe('coperturePerCircoscrizione', () => {
  it('raggruppa sezioni per circoscrizione e calcola coverage e total', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1), sez('s2', 2, 1), sez('s3', 3, 2)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted' }),
        rs({ id: 'r2', sezione_id: 's3', stato: 'verified' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([
      { circoscrizione: 1, total: 2, coverage: 1 },
      { circoscrizione: 2, total: 1, coverage: 1 },
    ]);
  });

  it('sezioni con circoscrizione null sono raggruppate come 0', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, null), sez('s2', 2, null), sez('s3', 3, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([
      { circoscrizione: 0, total: 2, coverage: 1 },
      { circoscrizione: 1, total: 1, coverage: 0 },
    ]);
  });

  it('ignora risultati di altre elezioni', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted', elezione_id: 'altra' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([{ circoscrizione: 1, total: 1, coverage: 0 }]);
  });

  it('ignora risultati in stato draft', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'draft' }),
      ],
      elezioneId: 'el1',
    });
    expect(result[0].coverage).toBe(0);
  });
});
```

- [ ] **Step 2: Verificare che il test fallisca**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: FAIL con "Cannot find module './proiezioni'".

- [ ] **Step 3: Implementare `coperturePerCircoscrizione`**

Creare `src/features/admin/proiezioni/proiezioni.ts`:

```typescript
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  StatoRisultato,
  VotoListaRow,
} from '@/lib/database.types';

const CONTA_STATI: ReadonlySet<StatoRisultato> = new Set(['submitted', 'verified']);

export type CoperturaCircoscrizione = {
  circoscrizione: number;
  coverage: number;
  total: number;
};

export function coperturePerCircoscrizione(input: {
  sezioni: SezioneRow[];
  risultatiSezione: RisultatoSezioneRow[];
  elezioneId: string;
}): CoperturaCircoscrizione[] {
  const { sezioni, risultatiSezione, elezioneId } = input;

  const totByCirc = new Map<number, number>();
  const sezToCirc = new Map<string, number>();
  for (const s of sezioni) {
    const c = s.circoscrizione ?? 0;
    totByCirc.set(c, (totByCirc.get(c) ?? 0) + 1);
    sezToCirc.set(s.id, c);
  }

  const covByCirc = new Map<number, number>();
  for (const r of risultatiSezione) {
    if (r.elezione_id !== elezioneId) continue;
    if (!CONTA_STATI.has(r.stato)) continue;
    const c = sezToCirc.get(r.sezione_id);
    if (c === undefined) continue;
    covByCirc.set(c, (covByCirc.get(c) ?? 0) + 1);
  }

  const circs = Array.from(totByCirc.keys()).sort((a, b) => a - b);
  return circs.map((c) => ({
    circoscrizione: c,
    total: totByCirc.get(c) ?? 0,
    coverage: covByCirc.get(c) ?? 0,
  }));
}
```

- [ ] **Step 4: Verificare che i test passino**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/proiezioni/proiezioni.ts src/features/admin/proiezioni/proiezioni.test.ts
git commit -m "feat(proiezioni): coperturePerCircoscrizione + unit test"
```

---

## Task 2: Pure functions — proiezione liste con banda (TDD)

**Files:**
- Modify: `src/features/admin/proiezioni/proiezioni.ts`
- Modify: `src/features/admin/proiezioni/proiezioni.test.ts`

- [ ] **Step 1: Aggiungere i test FAIL per `proiezioneListe`**

Aggiungere in `proiezioni.test.ts` (in fondo, dopo i describe esistenti):

```typescript
import { proiezioneListe, type ProiezioneLista } from './proiezioni';
import type { ListaRow, VotoListaRow } from '@/lib/database.types';

const lista = (id: string, nome: string, elezione_id = 'el1'): ListaRow => ({
  id,
  elezione_id,
  nome,
  simbolo_url: null,
  ordine: 0,
  created_at: '2026-04-25T00:00:00Z',
});

const vl = (
  rs_id: string,
  lista_id: string,
  voti: number,
): VotoListaRow => ({
  id: `vl-${rs_id}-${lista_id}`,
  risultato_sezione_id: rs_id,
  lista_id,
  voti,
});

describe('proiezioneListe', () => {
  it('singola circoscrizione, 5/10 sezioni coperte, lista 100 voti → proiezione 200', () => {
    const sezioni = Array.from({ length: 10 }, (_, i) => sez(`s${i}`, i + 1, 1));
    const risultati = sezioni
      .slice(0, 5)
      .map((s, i) => rs({ id: `r${i}`, sezione_id: s.id, stato: 'submitted' }));
    const voti = risultati.map((r) => vl(r.id, 'L1', 20));
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].voti_reali).toBe(100);
    expect(result[0].proiezione).toBe(200);
  });

  it('due circoscrizioni eterogenee → proiezione = somma proiezioni per C', () => {
    const sezioniC1 = [sez('a1', 1, 1), sez('a2', 2, 1)];
    const sezioniC2 = [sez('b1', 3, 2), sez('b2', 4, 2), sez('b3', 5, 2), sez('b4', 6, 2)];
    const sezioni = [...sezioniC1, ...sezioniC2];
    const risultati = [
      rs({ id: 'r1', sezione_id: 'a1', stato: 'submitted' }),
      rs({ id: 'r2', sezione_id: 'b1', stato: 'submitted' }),
      rs({ id: 'r3', sezione_id: 'b2', stato: 'submitted' }),
    ];
    const voti = [vl('r1', 'L1', 50), vl('r2', 'L1', 10), vl('r3', 'L1', 20)];
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    // C1: 50 voti / 1 coperta × 2 totale = 100
    // C2: 30 voti / 2 coperte × 4 totale = 60
    expect(result[0].proiezione).toBe(160);
  });

  it('circoscrizione con 0 sezioni coperte → fallback alla media globale', () => {
    const sezioni = [
      sez('a1', 1, 1),
      sez('a2', 2, 1),
      sez('b1', 3, 2),
      sez('b2', 4, 2),
    ];
    const risultati = [
      rs({ id: 'r1', sezione_id: 'a1', stato: 'submitted' }),
      rs({ id: 'r2', sezione_id: 'a2', stato: 'submitted' }),
    ];
    const voti = [vl('r1', 'L1', 10), vl('r2', 'L1', 10)];
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    // C1 coverage 2 → proiezione_C1 = 20
    // C2 coverage 0 → fallback = (20 / 2 globale) × 2 = 20
    // Totale: 40
    expect(result[0].proiezione).toBe(40);
  });

  it('coverage globale 0 → tutte le proiezioni 0', () => {
    const sezioni = [sez('a1', 1, 1)];
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A')],
      sezioni,
      risultatiSezione: [],
      votiLista: [],
      elezioneId: 'el1',
    });
    expect(result[0].voti_reali).toBe(0);
    expect(result[0].proiezione).toBe(0);
  });

  it('banda di confidenza con N=1 circoscrizione coperta → ±15% default', () => {
    const sezioni = [sez('a1', 1, 1), sez('a2', 2, 1)];
    const risultati = [rs({ id: 'r1', sezione_id: 'a1', stato: 'submitted' })];
    const voti = [vl('r1', 'L1', 100)];
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    expect(result[0].proiezione).toBe(200);
    expect(result[0].banda_min).toBe(170); // 200 × 0.85
    expect(result[0].banda_max).toBe(230); // 200 × 1.15
  });

  it('banda di confidenza con N=3 → calcolata da σ relativa', () => {
    // 3 circoscrizioni tutte coperte, lista L1 con quote diverse → σ > 0
    const sezioni = [sez('a', 1, 1), sez('b', 2, 2), sez('c', 3, 3)];
    const risultati = [
      rs({ id: 'r1', sezione_id: 'a', stato: 'submitted' }),
      rs({ id: 'r2', sezione_id: 'b', stato: 'submitted' }),
      rs({ id: 'r3', sezione_id: 'c', stato: 'submitted' }),
    ];
    const voti = [
      vl('r1', 'L1', 30),
      vl('r1', 'L2', 70),
      vl('r2', 'L1', 50),
      vl('r2', 'L2', 50),
      vl('r3', 'L1', 70),
      vl('r3', 'L2', 30),
    ];
    const result = proiezioneListe({
      liste: [lista('L1', 'Lista A'), lista('L2', 'Lista B')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    const l1 = result.find((r) => r.lista_id === 'L1')!;
    expect(l1.proiezione).toBe(150); // 30+50+70
    // σ delle quote {0.3, 0.5, 0.7} = sqrt((((-0.2)² + 0² + 0.2²) / 3)) ≈ 0.1633
    expect(l1.banda_min).toBeCloseTo(150 * (1 - 0.1633), 0);
    expect(l1.banda_max).toBeCloseTo(150 * (1 + 0.1633), 0);
  });
});
```

- [ ] **Step 2: Verificare che i test falliscano**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: FAIL su `proiezioneListe is not a function`.

- [ ] **Step 3: Implementare `proiezioneListe`**

Aggiungere in `src/features/admin/proiezioni/proiezioni.ts`:

```typescript
export type ProiezioneLista = {
  lista_id: string;
  nome: string;
  voti_reali: number;
  proiezione: number;
  banda_min: number;
  banda_max: number;
};

const BANDA_DEFAULT_PCT = 0.15;

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function proiezioneListe(input: {
  liste: ListaRow[];
  sezioni: SezioneRow[];
  risultatiSezione: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
  elezioneId: string;
}): ProiezioneLista[] {
  const { liste, sezioni, risultatiSezione, votiLista, elezioneId } = input;

  const sezToCirc = new Map<string, number>();
  for (const s of sezioni) sezToCirc.set(s.id, s.circoscrizione ?? 0);

  const coperture = coperturePerCircoscrizione({ sezioni, risultatiSezione, elezioneId });

  // rs validi (per elezione + stato)
  const rsValid = risultatiSezione.filter(
    (r) => r.elezione_id === elezioneId && CONTA_STATI.has(r.stato),
  );
  const rsValidIds = new Set(rsValid.map((r) => r.id));

  // voti per (lista, circoscrizione)
  // mappa rs_id → circ
  const rsIdToCirc = new Map<string, number>();
  for (const r of rsValid) {
    const c = sezToCirc.get(r.sezione_id);
    if (c !== undefined) rsIdToCirc.set(r.id, c);
  }

  // voti totali per (lista, circ) e per circ
  const votiPerListaCirc = new Map<string, Map<number, number>>(); // listaId → circ → voti
  const votiTotPerCirc = new Map<number, number>();
  for (const v of votiLista) {
    if (!rsValidIds.has(v.risultato_sezione_id)) continue;
    const c = rsIdToCirc.get(v.risultato_sezione_id);
    if (c === undefined) continue;
    let m = votiPerListaCirc.get(v.lista_id);
    if (!m) {
      m = new Map<number, number>();
      votiPerListaCirc.set(v.lista_id, m);
    }
    m.set(c, (m.get(c) ?? 0) + v.voti);
    votiTotPerCirc.set(c, (votiTotPerCirc.get(c) ?? 0) + v.voti);
  }

  // coverage globale = somma coverage_C
  const coverageGlobale = coperture.reduce((a, c) => a + c.coverage, 0);

  return liste.map((L) => {
    const perCirc = votiPerListaCirc.get(L.id) ?? new Map<number, number>();
    const votiReali = Array.from(perCirc.values()).reduce((a, b) => a + b, 0);
    const votiGlobaleL = votiReali;

    let proiezione = 0;
    const quotePerCircCoperte: number[] = [];
    for (const cop of coperture) {
      const votiLC = perCirc.get(cop.circoscrizione) ?? 0;
      if (cop.coverage > 0) {
        proiezione += votiLC * (cop.total / cop.coverage);
        const totC = votiTotPerCirc.get(cop.circoscrizione) ?? 0;
        if (totC > 0) quotePerCircCoperte.push(votiLC / totC);
      } else if (coverageGlobale > 0) {
        const mediaPerSezione = votiGlobaleL / coverageGlobale;
        proiezione += mediaPerSezione * cop.total;
      }
      // else: 0
    }

    const sigma = quotePerCircCoperte.length > 1
      ? stddev(quotePerCircCoperte)
      : BANDA_DEFAULT_PCT;
    const bandaMin = Math.max(0, proiezione * (1 - sigma));
    const bandaMax = proiezione * (1 + sigma);

    return {
      lista_id: L.id,
      nome: L.nome,
      voti_reali: votiReali,
      proiezione,
      banda_min: bandaMin,
      banda_max: bandaMax,
    };
  });
}
```

- [ ] **Step 4: Verificare che i test passino**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: tutti PASS (10 totali ora: 4 + 6).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/proiezioni/proiezioni.ts src/features/admin/proiezioni/proiezioni.test.ts
git commit -m "feat(proiezioni): proiezioneListe pesata per circoscrizione + banda di confidenza + unit test"
```

---

## Task 3: Pure functions — proiezione candidati + sezioni mancanti + matrice (TDD)

**Files:**
- Modify: `src/features/admin/proiezioni/proiezioni.ts`
- Modify: `src/features/admin/proiezioni/proiezioni.test.ts`

- [ ] **Step 1: Aggiungere test FAIL per `proiezioneCandidati`, `sezioniMancanti`, `matriceCircoscrizioneListe`**

Aggiungere in `proiezioni.test.ts`:

```typescript
import {
  proiezioneCandidati,
  sezioniMancanti,
  matriceCircoscrizioneListe,
} from './proiezioni';
import type { CandidatoRow, PreferenzaCandidatoRow } from '@/lib/database.types';

const cand = (id: string, lista_id = 'L1', cognome = 'Rossi'): CandidatoRow => ({
  id,
  lista_id,
  nome: 'Mario',
  cognome,
  ordine: 0,
  note: null,
  created_at: '2026-04-25T00:00:00Z',
});

const pref = (
  rs_id: string,
  candidato_id: string,
  voti: number,
): PreferenzaCandidatoRow => ({
  id: `p-${rs_id}-${candidato_id}`,
  risultato_sezione_id: rs_id,
  candidato_id,
  voti,
});

describe('proiezioneCandidati', () => {
  it('proietta i candidati con stessa logica delle liste', () => {
    const sezioni = [sez('a1', 1, 1), sez('a2', 2, 1)];
    const risultati = [rs({ id: 'r1', sezione_id: 'a1', stato: 'submitted' })];
    const result = proiezioneCandidati({
      candidati: [cand('c1', 'L1', 'Bianchi')],
      sezioni,
      risultatiSezione: risultati,
      preferenze: [pref('r1', 'c1', 30)],
      elezioneId: 'el1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].voti_reali).toBe(30);
    expect(result[0].proiezione).toBe(60); // 30 × 2/1
  });
});

describe('sezioniMancanti', () => {
  it('include sezioni con stato draft', () => {
    const sezioni = [sez('s1', 1, 1)];
    const risultati = [rs({ id: 'r1', sezione_id: 's1', stato: 'draft' })];
    const result = sezioniMancanti({ sezioni, risultatiSezione: risultati, elezioneId: 'el1' });
    expect(result).toHaveLength(1);
    expect(result[0].statoSezione).toBe('draft');
  });

  it('include sezioni senza alcun risultato_sezione', () => {
    const sezioni = [sez('s1', 1, 1)];
    const result = sezioniMancanti({ sezioni, risultatiSezione: [], elezioneId: 'el1' });
    expect(result).toHaveLength(1);
    expect(result[0].statoSezione).toBe('assente');
  });

  it('esclude sezioni in stato submitted o verified', () => {
    const sezioni = [sez('s1', 1, 1), sez('s2', 2, 1)];
    const risultati = [
      rs({ id: 'r1', sezione_id: 's1', stato: 'submitted' }),
      rs({ id: 'r2', sezione_id: 's2', stato: 'verified' }),
    ];
    const result = sezioniMancanti({ sezioni, risultatiSezione: risultati, elezioneId: 'el1' });
    expect(result).toHaveLength(0);
  });
});

describe('matriceCircoscrizioneListe', () => {
  it('somma per riga uguaglia totale lista, somma per colonna uguaglia totale circoscrizione', () => {
    const sezioni = [sez('a', 1, 1), sez('b', 2, 2)];
    const risultati = [
      rs({ id: 'r1', sezione_id: 'a', stato: 'submitted' }),
      rs({ id: 'r2', sezione_id: 'b', stato: 'submitted' }),
    ];
    const voti = [
      vl('r1', 'L1', 10),
      vl('r1', 'L2', 20),
      vl('r2', 'L1', 30),
      vl('r2', 'L2', 40),
    ];
    const result = matriceCircoscrizioneListe({
      liste: [lista('L1', 'A'), lista('L2', 'B')],
      sezioni,
      risultatiSezione: risultati,
      votiLista: voti,
      elezioneId: 'el1',
    });
    expect(result.length).toBe(2);
    const c1 = result.find((r) => r.circoscrizione === 1)!;
    expect(c1.celle.find((c) => c.lista_id === 'L1')!.voti_reali).toBe(10);
    expect(c1.celle.find((c) => c.lista_id === 'L2')!.voti_reali).toBe(20);
    const c2 = result.find((r) => r.circoscrizione === 2)!;
    expect(c2.celle.find((c) => c.lista_id === 'L1')!.voti_reali).toBe(30);
  });
});
```

- [ ] **Step 2: Verificare i test falliscono**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: FAIL su funzioni non definite.

- [ ] **Step 3: Implementare le 3 funzioni**

Aggiungere in `src/features/admin/proiezioni/proiezioni.ts`:

```typescript
export type ProiezioneCandidato = {
  candidato_id: string;
  cognome: string;
  nome: string;
  lista_id: string;
  voti_reali: number;
  proiezione: number;
  banda_min: number;
  banda_max: number;
};

export function proiezioneCandidati(input: {
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultatiSezione: RisultatoSezioneRow[];
  preferenze: PreferenzaCandidatoRow[];
  elezioneId: string;
}): ProiezioneCandidato[] {
  const { candidati, sezioni, risultatiSezione, preferenze, elezioneId } = input;

  // Riusiamo proiezioneListe trasformando candidati in liste virtuali
  // e preferenze in voti_lista virtuali. Più pratico: replichiamo la logica.

  const sezToCirc = new Map<string, number>();
  for (const s of sezioni) sezToCirc.set(s.id, s.circoscrizione ?? 0);

  const coperture = coperturePerCircoscrizione({ sezioni, risultatiSezione, elezioneId });

  const rsValid = risultatiSezione.filter(
    (r) => r.elezione_id === elezioneId && CONTA_STATI.has(r.stato),
  );
  const rsValidIds = new Set(rsValid.map((r) => r.id));

  const rsIdToCirc = new Map<string, number>();
  for (const r of rsValid) {
    const c = sezToCirc.get(r.sezione_id);
    if (c !== undefined) rsIdToCirc.set(r.id, c);
  }

  const prefPerCandCirc = new Map<string, Map<number, number>>();
  const prefTotPerCirc = new Map<number, number>();
  for (const p of preferenze) {
    if (!rsValidIds.has(p.risultato_sezione_id)) continue;
    const c = rsIdToCirc.get(p.risultato_sezione_id);
    if (c === undefined) continue;
    let m = prefPerCandCirc.get(p.candidato_id);
    if (!m) {
      m = new Map<number, number>();
      prefPerCandCirc.set(p.candidato_id, m);
    }
    m.set(c, (m.get(c) ?? 0) + p.voti);
    prefTotPerCirc.set(c, (prefTotPerCirc.get(c) ?? 0) + p.voti);
  }

  const coverageGlobale = coperture.reduce((a, c) => a + c.coverage, 0);

  return candidati.map((c) => {
    const perCirc = prefPerCandCirc.get(c.id) ?? new Map<number, number>();
    const votiReali = Array.from(perCirc.values()).reduce((a, b) => a + b, 0);

    let proiezione = 0;
    const quote: number[] = [];
    for (const cop of coperture) {
      const v = perCirc.get(cop.circoscrizione) ?? 0;
      if (cop.coverage > 0) {
        proiezione += v * (cop.total / cop.coverage);
        const totC = prefTotPerCirc.get(cop.circoscrizione) ?? 0;
        if (totC > 0) quote.push(v / totC);
      } else if (coverageGlobale > 0) {
        proiezione += (votiReali / coverageGlobale) * cop.total;
      }
    }

    const sigma = quote.length > 1 ? stddev(quote) : BANDA_DEFAULT_PCT;
    return {
      candidato_id: c.id,
      cognome: c.cognome,
      nome: c.nome,
      lista_id: c.lista_id,
      voti_reali: votiReali,
      proiezione,
      banda_min: Math.max(0, proiezione * (1 - sigma)),
      banda_max: proiezione * (1 + sigma),
    };
  });
}

export type SezioneMancante = {
  sezione_id: string;
  numero: number;
  indirizzo: string | null;
  ubicazione: string | null;
  circoscrizione: number;
  statoSezione: 'draft' | 'assente';
};

export function sezioniMancanti(input: {
  sezioni: SezioneRow[];
  risultatiSezione: RisultatoSezioneRow[];
  elezioneId: string;
}): SezioneMancante[] {
  const { sezioni, risultatiSezione, elezioneId } = input;
  const rsBySez = new Map<string, RisultatoSezioneRow>();
  for (const r of risultatiSezione) {
    if (r.elezione_id !== elezioneId) continue;
    rsBySez.set(r.sezione_id, r);
  }
  const out: SezioneMancante[] = [];
  for (const s of sezioni) {
    const rs = rsBySez.get(s.id);
    if (rs && CONTA_STATI.has(rs.stato)) continue;
    out.push({
      sezione_id: s.id,
      numero: s.numero,
      indirizzo: s.indirizzo,
      ubicazione: s.ubicazione,
      circoscrizione: s.circoscrizione ?? 0,
      statoSezione: rs ? 'draft' : 'assente',
    });
  }
  return out.sort((a, b) => a.circoscrizione - b.circoscrizione || a.numero - b.numero);
}

export type MatriceCella = {
  lista_id: string;
  voti_reali: number;
  proiezione: number;
};

export type MatriceRow = {
  circoscrizione: number;
  coverage: number;
  total: number;
  celle: MatriceCella[];
};

export function matriceCircoscrizioneListe(input: {
  liste: ListaRow[];
  sezioni: SezioneRow[];
  risultatiSezione: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
  elezioneId: string;
}): MatriceRow[] {
  const { liste, sezioni, risultatiSezione, votiLista, elezioneId } = input;

  const sezToCirc = new Map<string, number>();
  for (const s of sezioni) sezToCirc.set(s.id, s.circoscrizione ?? 0);

  const coperture = coperturePerCircoscrizione({ sezioni, risultatiSezione, elezioneId });

  const rsValid = risultatiSezione.filter(
    (r) => r.elezione_id === elezioneId && CONTA_STATI.has(r.stato),
  );
  const rsValidIds = new Set(rsValid.map((r) => r.id));
  const rsIdToCirc = new Map<string, number>();
  for (const r of rsValid) {
    const c = sezToCirc.get(r.sezione_id);
    if (c !== undefined) rsIdToCirc.set(r.id, c);
  }

  // somma voti per (circ, lista)
  const sums = new Map<string, number>(); // key = `${circ}|${lista}`
  for (const v of votiLista) {
    if (!rsValidIds.has(v.risultato_sezione_id)) continue;
    const c = rsIdToCirc.get(v.risultato_sezione_id);
    if (c === undefined) continue;
    const k = `${c}|${v.lista_id}`;
    sums.set(k, (sums.get(k) ?? 0) + v.voti);
  }

  return coperture.map((cop) => {
    const celle: MatriceCella[] = liste.map((L) => {
      const reali = sums.get(`${cop.circoscrizione}|${L.id}`) ?? 0;
      const proiezione = cop.coverage > 0 ? reali * (cop.total / cop.coverage) : 0;
      return { lista_id: L.id, voti_reali: reali, proiezione };
    });
    return {
      circoscrizione: cop.circoscrizione,
      coverage: cop.coverage,
      total: cop.total,
      celle,
    };
  });
}
```

- [ ] **Step 4: Verificare i test passano**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/proiezioni.test.ts
```

Expected: 14 PASS (4 + 6 + 4).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/proiezioni/proiezioni.ts src/features/admin/proiezioni/proiezioni.test.ts
git commit -m "feat(proiezioni): proiezioneCandidati + sezioniMancanti + matriceCircoscrizioneListe + unit test"
```

---

## Task 4: CSV utility (TDD)

**Files:**
- Create: `src/features/admin/proiezioni/csvExport.ts`
- Create: `src/features/admin/proiezioni/csvExport.test.ts`

- [ ] **Step 1: Test FAIL**

Creare `src/features/admin/proiezioni/csvExport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildListeCsv, buildCandidatiCsv, buildSezioniMancantiCsv } from './csvExport';
import type { ProiezioneLista, ProiezioneCandidato, SezioneMancante } from './proiezioni';

describe('buildListeCsv', () => {
  it('genera header + righe corrette', () => {
    const rows: ProiezioneLista[] = [
      { lista_id: 'L1', nome: 'Lista A', voti_reali: 100, proiezione: 200, banda_min: 170, banda_max: 230 },
    ];
    const csv = buildListeCsv(rows);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('nome_lista,voti_reali,proiezione,banda_min,banda_max');
    expect(lines[1]).toBe('Lista A,100,200,170,230');
  });

  it('escape virgolette nei nomi con virgole', () => {
    const rows: ProiezioneLista[] = [
      { lista_id: 'L1', nome: 'Lista, A', voti_reali: 0, proiezione: 0, banda_min: 0, banda_max: 0 },
    ];
    const csv = buildListeCsv(rows);
    expect(csv).toContain('"Lista, A"');
  });
});

describe('buildCandidatiCsv', () => {
  it('genera header + righe corrette', () => {
    const rows: ProiezioneCandidato[] = [
      {
        candidato_id: 'c1',
        cognome: 'Rossi',
        nome: 'Mario',
        lista_id: 'L1',
        voti_reali: 50,
        proiezione: 100,
        banda_min: 85,
        banda_max: 115,
      },
    ];
    const csv = buildCandidatiCsv(rows, new Map([['L1', 'Lista A']]));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('cognome,nome,lista,preferenze_reali,proiezione,banda_min,banda_max');
    expect(lines[1]).toBe('Rossi,Mario,Lista A,50,100,85,115');
  });
});

describe('buildSezioniMancantiCsv', () => {
  it('genera header + righe', () => {
    const rows: SezioneMancante[] = [
      {
        sezione_id: 's1',
        numero: 1,
        indirizzo: 'Via X',
        ubicazione: 'Scuola Y',
        circoscrizione: 1,
        statoSezione: 'draft',
      },
    ];
    const csv = buildSezioniMancantiCsv(rows);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('numero,indirizzo,ubicazione,circoscrizione,stato');
    expect(lines[1]).toBe('1,Via X,Scuola Y,1,draft');
  });
});
```

- [ ] **Step 2: Verificare FAIL**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/csvExport.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementare**

Creare `src/features/admin/proiezioni/csvExport.ts`:

```typescript
import Papa from 'papaparse';
import type {
  ProiezioneLista,
  ProiezioneCandidato,
  SezioneMancante,
} from './proiezioni';

function round(n: number): number {
  return Math.round(n);
}

export function buildListeCsv(rows: ProiezioneLista[]): string {
  const data = rows.map((r) => ({
    nome_lista: r.nome,
    voti_reali: r.voti_reali,
    proiezione: round(r.proiezione),
    banda_min: round(r.banda_min),
    banda_max: round(r.banda_max),
  }));
  return Papa.unparse(data, {
    columns: ['nome_lista', 'voti_reali', 'proiezione', 'banda_min', 'banda_max'],
  });
}

export function buildCandidatiCsv(
  rows: ProiezioneCandidato[],
  listeNomeById: Map<string, string>,
): string {
  const data = rows.map((r) => ({
    cognome: r.cognome,
    nome: r.nome,
    lista: listeNomeById.get(r.lista_id) ?? '',
    preferenze_reali: r.voti_reali,
    proiezione: round(r.proiezione),
    banda_min: round(r.banda_min),
    banda_max: round(r.banda_max),
  }));
  return Papa.unparse(data, {
    columns: [
      'cognome',
      'nome',
      'lista',
      'preferenze_reali',
      'proiezione',
      'banda_min',
      'banda_max',
    ],
  });
}

export function buildSezioniMancantiCsv(rows: SezioneMancante[]): string {
  const data = rows.map((r) => ({
    numero: r.numero,
    indirizzo: r.indirizzo ?? '',
    ubicazione: r.ubicazione ?? '',
    circoscrizione: r.circoscrizione,
    stato: r.statoSezione,
  }));
  return Papa.unparse(data, {
    columns: ['numero', 'indirizzo', 'ubicazione', 'circoscrizione', 'stato'],
  });
}

export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Verificare PASS**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:run -- src/features/admin/proiezioni/csvExport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/proiezioni/csvExport.ts src/features/admin/proiezioni/csvExport.test.ts
git commit -m "feat(proiezioni): CSV export utility per liste, candidati, sezioni mancanti + test"
```

---

## Task 5: Hook bundle `useProiezioniData`

**Files:**
- Create: `src/lib/queries/proiezioni.ts`

- [ ] **Step 1: Implementare il bundle**

Creare `src/lib/queries/proiezioni.ts`:

```typescript
import { useQueries, useQuery } from '@tanstack/react-query';
import { db } from './_db';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

export interface ProiezioniBundle {
  liste: ListaRow[];
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
  preferenze: PreferenzaCandidatoRow[];
  isLoading: boolean;
}

export function useProiezioniData(
  giornataId: string | undefined,
  elezioneId: string | undefined,
): ProiezioniBundle {
  const enabled = !!giornataId && !!elezioneId;

  // Realtime invalidations
  useRealtimeTable({ table: 'risultati_sezione', invalidate: [['proiezioni', elezioneId, 'rs']], enabled });
  useRealtimeTable({ table: 'voti_lista', invalidate: [['proiezioni', elezioneId, 'vl']], enabled });
  useRealtimeTable({ table: 'preferenze_candidato', invalidate: [['proiezioni', elezioneId, 'pc']], enabled });
  useRealtimeTable({ table: 'sezioni', invalidate: [['proiezioni', giornataId, 'sez']], enabled });

  const sezioniQ = useQuery({
    queryKey: ['proiezioni', giornataId, 'sez'],
    enabled,
    queryFn: async (): Promise<SezioneRow[]> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('giornata_id', giornataId as string);
      if (error) throw error;
      return (data ?? []) as SezioneRow[];
    },
  });

  const listeQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'liste'],
    enabled,
    queryFn: async (): Promise<ListaRow[]> => {
      const { data, error } = await db
        .from('liste')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as ListaRow[];
    },
  });

  const liste = listeQ.data ?? [];
  const candidatiResults = useQueries({
    queries: liste.map((l) => ({
      queryKey: ['candidati', l.id],
      enabled: !!l.id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', l.id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  const candidati = candidatiResults.flatMap((r) => (r.data ?? []) as CandidatoRow[]);

  const risultatiQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'rs'],
    enabled,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });

  const rsIds = (risultatiQ.data ?? []).map((r) => r.id);

  const votiQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'vl', rsIds.join(',')],
    enabled: enabled && rsIds.length > 0,
    queryFn: async (): Promise<VotoListaRow[]> => {
      const { data, error } = await db
        .from('voti_lista')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as VotoListaRow[];
    },
  });

  const prefQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'pc', rsIds.join(',')],
    enabled: enabled && rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });

  return {
    liste,
    candidati,
    sezioni: sezioniQ.data ?? [],
    risultati: risultatiQ.data ?? [],
    votiLista: votiQ.data ?? [],
    preferenze: prefQ.data ?? [],
    isLoading:
      sezioniQ.isLoading ||
      listeQ.isLoading ||
      candidatiResults.some((r) => r.isLoading) ||
      risultatiQ.isLoading ||
      votiQ.isLoading ||
      prefQ.isLoading,
  };
}
```

- [ ] **Step 2: Verificare build**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: build pulita.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/proiezioni.ts
git commit -m "feat(queries): hook bundle useProiezioniData con fetch parallele e realtime"
```

---

## Task 6: Routing + menu admin + stub pagina

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/features/admin/AdminLayout.tsx`
- Modify: `src/features/admin/AdminIndexPage.tsx`
- Create: `src/features/admin/proiezioni/ProiezioniPage.tsx`

- [ ] **Step 1: Stub `ProiezioniPage`**

Creare `src/features/admin/proiezioni/ProiezioniPage.tsx`:

```tsx
import { PageHeader } from '@/components/ui';

export function ProiezioniPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Proiezioni"
        subtitle="Stima del risultato finale pesata per circoscrizione (admin only)."
      />
      <div className="glass p-6 rounded-2xl text-slate-300">Proiezioni (WIP)</div>
    </div>
  );
}
```

- [ ] **Step 2: Aggiungere voce menu in `AdminLayout`**

In `src/features/admin/AdminLayout.tsx`, modificare `items`:

```typescript
const items = [
  { to: '/admin', label: 'Home', end: true },
  { to: '/admin/users', label: 'Utenti' },
  { to: '/admin/giornate', label: 'Giornate' },
  { to: '/admin/sezioni', label: 'Sezioni' },
  { to: '/admin/presunti', label: 'Presunti' },
  { to: '/admin/confronto', label: 'Confronto' },
  { to: '/admin/proiezioni', label: 'Proiezioni' },
  { to: '/admin/audit', label: 'Audit' },
];
```

- [ ] **Step 3: Aggiungere card in `AdminIndexPage`**

In `src/features/admin/AdminIndexPage.tsx`, aggiungere card dopo "Confronto":

```typescript
{ to: '/admin/proiezioni', title: 'Proiezioni', description: 'Stima del risultato finale pesata per circoscrizione + export CSV.' },
```

- [ ] **Step 4: Aggiungere route in `router.tsx`**

In `src/app/router.tsx`:

a) Import:

```typescript
import { ProiezioniPage } from '@/features/admin/proiezioni/ProiezioniPage';
```

b) Route dentro `<Route path="admin">`, dopo `confronto/sezione/:sezioneId`:

```tsx
<Route path="proiezioni" element={<ProiezioniPage />} />
```

- [ ] **Step 5: Verifica build + test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: passa.

- [ ] **Step 6: Commit**

```bash
git add src/app/router.tsx src/features/admin/AdminLayout.tsx src/features/admin/AdminIndexPage.tsx src/features/admin/proiezioni/ProiezioniPage.tsx
git commit -m "feat(admin): routing e menu proiezioni (stub pagina)"
```

---

## Task 7: KPIHeader component

**Files:**
- Create: `src/features/admin/proiezioni/components/KPIHeader.tsx`

- [ ] **Step 1: Implementare il componente**

Creare `src/features/admin/proiezioni/components/KPIHeader.tsx`:

```tsx
import type { CoperturaCircoscrizione } from '../proiezioni';

function colorClass(pct: number): string {
  if (pct >= 80) return 'bg-green-400/20 text-green-300 border border-green-400/30';
  if (pct >= 50) return 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30';
  return 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30';
}

export function KPIHeader({
  coperture,
  ultimoUpdate,
}: {
  coperture: CoperturaCircoscrizione[];
  ultimoUpdate: { when: string; who: string } | null;
}) {
  const totalGlobale = coperture.reduce((a, c) => a + c.total, 0);
  const coverGlobale = coperture.reduce((a, c) => a + c.coverage, 0);
  const pctGlobale = totalGlobale === 0 ? 0 : (coverGlobale / totalGlobale) * 100;

  return (
    <div className="glass p-4 rounded-2xl space-y-4">
      <div>
        <div className="text-xs text-slate-400">Copertura globale</div>
        <div className="text-3xl font-semibold">
          {coverGlobale} / {totalGlobale} sezioni
          <span className="ml-3 text-base font-normal text-slate-300">
            ({pctGlobale.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-2 h-2 bg-white/5 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-neon"
            style={{ width: `${Math.min(100, pctGlobale)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-2">Per circoscrizione</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {coperture.map((c) => {
            const pct = c.total === 0 ? 0 : (c.coverage / c.total) * 100;
            return (
              <div
                key={c.circoscrizione}
                className={`px-3 py-2 rounded-xl text-sm ${colorClass(pct)}`}
              >
                <div className="font-medium">
                  Circoscrizione {c.circoscrizione === 0 ? '— (N/A)' : c.circoscrizione}
                </div>
                <div className="text-xs">
                  {c.coverage} / {c.total} ({pct.toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ultimoUpdate && (
        <div className="text-xs text-slate-400">
          Ultimo aggiornamento: {ultimoUpdate.when} — {ultimoUpdate.who}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/proiezioni/components/KPIHeader.tsx
git commit -m "feat(proiezioni): KPIHeader con copertura globale e per circoscrizione"
```

---

## Task 8: ProiezioneListeChart component

**Files:**
- Create: `src/features/admin/proiezioni/components/ProiezioneListeChart.tsx`

- [ ] **Step 1: Implementare**

Creare `src/features/admin/proiezioni/components/ProiezioneListeChart.tsx`:

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProiezioneLista } from '../proiezioni';

export function ProiezioneListeChart({ rows }: { rows: ProiezioneLista[] }) {
  const data = [...rows]
    .sort((a, b) => b.proiezione - a.proiezione)
    .map((r) => ({
      nome: r.nome,
      proiezione: Math.round(r.proiezione),
      voti_reali: r.voti_reali,
      banda_min: Math.round(r.banda_min),
      banda_max: Math.round(r.banda_max),
      // ErrorBar accetta deviazioni: [downValue, upValue]
      err: [
        Math.round(r.proiezione - r.banda_min),
        Math.round(r.banda_max - r.proiezione),
      ],
    }));

  if (data.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Nessuna lista da proiettare per questa elezione.
      </div>
    );
  }

  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="text-sm font-semibold mb-3">
        Proiezione voti per lista <span className="text-xs text-slate-400">(stima)</span>
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 40)}>
        <BarChart layout="vertical" data={data} margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" stroke="#94a3b8" />
          <YAxis dataKey="nome" type="category" width={140} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
            formatter={(value: number, name: string) => {
              if (name === 'proiezione') return [`${value} (proiezione)`, 'Proiezione'];
              return [value, name];
            }}
          />
          <Bar dataKey="proiezione" fill="#22d3ee" radius={[0, 8, 8, 0]}>
            <ErrorBar dataKey="err" width={8} stroke="#ef4444" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/proiezioni/components/ProiezioneListeChart.tsx
git commit -m "feat(proiezioni): ProiezioneListeChart bar chart con bande di confidenza"
```

---

## Task 9: ProiezioneCandidatiTop component

**Files:**
- Create: `src/features/admin/proiezioni/components/ProiezioneCandidatiTop.tsx`

- [ ] **Step 1: Implementare**

Creare `src/features/admin/proiezioni/components/ProiezioneCandidatiTop.tsx`:

```tsx
import { useState } from 'react';
import type { ProiezioneCandidato } from '../proiezioni';

export function ProiezioneCandidatiTop({
  rows,
  listeNomeById,
}: {
  rows: ProiezioneCandidato[];
  listeNomeById: Map<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...rows].sort((a, b) => b.proiezione - a.proiezione);
  const visible = showAll ? sorted : sorted.slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Nessun candidato da proiettare.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <h3 className="text-sm font-semibold">
          Top candidati per preferenze proiettate{' '}
          <span className="text-xs text-slate-400">(stima)</span>
        </h3>
        {sorted.length > 10 && (
          <button
            type="button"
            className="text-xs text-neon-cyan hover:underline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Mostra solo top 10' : `Mostra tutti (${sorted.length})`}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Candidato</th>
            <th className="px-4 py-2">Lista</th>
            <th className="px-4 py-2 text-right">Pref. reali</th>
            <th className="px-4 py-2 text-right">Proiezione</th>
            <th className="px-4 py-2 text-right">Banda</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((c, i) => (
            <tr key={c.candidato_id} className="border-t border-white/5">
              <td className="px-4 py-2 text-slate-400">{i + 1}</td>
              <td className="px-4 py-2">
                {c.cognome} {c.nome}
              </td>
              <td className="px-4 py-2 text-slate-300">
                {listeNomeById.get(c.lista_id) ?? ''}
              </td>
              <td className="px-4 py-2 text-right">{c.voti_reali}</td>
              <td className="px-4 py-2 text-right font-semibold">
                {Math.round(c.proiezione)}
              </td>
              <td className="px-4 py-2 text-right text-xs text-slate-400">
                {Math.round(c.banda_min)} – {Math.round(c.banda_max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
git add src/features/admin/proiezioni/components/ProiezioneCandidatiTop.tsx
git commit -m "feat(proiezioni): ProiezioneCandidatiTop con toggle mostra tutti"
```

---

## Task 10: SezioniMancantiList component

**Files:**
- Create: `src/features/admin/proiezioni/components/SezioniMancantiList.tsx`

- [ ] **Step 1: Implementare**

Creare `src/features/admin/proiezioni/components/SezioniMancantiList.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { CoperturaCircoscrizione, SezioneMancante } from '../proiezioni';

function colorClass(pct: number): string {
  if (pct >= 80) return 'bg-green-400/20 text-green-300';
  if (pct >= 50) return 'bg-yellow-400/20 text-yellow-200';
  return 'bg-neon-pink/20 text-neon-pink';
}

export function SezioniMancantiList({
  sezioni,
  coperture,
}: {
  sezioni: SezioneMancante[];
  coperture: CoperturaCircoscrizione[];
}) {
  const coperturaByCirc = new Map(coperture.map((c) => [c.circoscrizione, c]));
  const groups = new Map<number, SezioneMancante[]>();
  for (const s of sezioni) {
    const arr = groups.get(s.circoscrizione) ?? [];
    arr.push(s);
    groups.set(s.circoscrizione, arr);
  }

  if (sezioni.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-green-300">
        Tutte le sezioni sono coperte. ✓
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold">
          Sezioni mancanti ({sezioni.length})
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a - b)
          .map(([circ, items]) => {
            const cop = coperturaByCirc.get(circ);
            const pct = cop && cop.total > 0 ? (cop.coverage / cop.total) * 100 : 0;
            return (
              <div key={circ} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">
                    Circoscrizione {circ === 0 ? '— (N/A)' : circ}
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-xs ${colorClass(pct)}`}>
                    {cop ? `${cop.coverage}/${cop.total} (${pct.toFixed(0)}%)` : '—'}
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {items.map((s) => (
                    <li key={s.sezione_id} className="flex items-center justify-between">
                      <span>
                        Sez. {s.numero}{' '}
                        <span className="text-slate-400">— {s.indirizzo ?? '—'}</span>
                      </span>
                      <Link
                        to="/admin/sezioni"
                        className="text-xs text-neon-cyan hover:underline"
                      >
                        {s.statoSezione === 'draft' ? 'in bozza' : 'in attesa'} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
git add src/features/admin/proiezioni/components/SezioniMancantiList.tsx
git commit -m "feat(proiezioni): SezioniMancantiList raggruppata per circoscrizione"
```

---

## Task 11: MatriceCircoscrizioneListe component

**Files:**
- Create: `src/features/admin/proiezioni/components/MatriceCircoscrizioneListe.tsx`

- [ ] **Step 1: Implementare**

Creare `src/features/admin/proiezioni/components/MatriceCircoscrizioneListe.tsx`:

```tsx
import type { ListaRow } from '@/lib/database.types';
import type { MatriceRow } from '../proiezioni';

export function MatriceCircoscrizioneListe({
  rows,
  liste,
}: {
  rows: MatriceRow[];
  liste: ListaRow[];
}) {
  if (rows.length === 0 || liste.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Matrice non disponibile (mancano dati).
      </div>
    );
  }

  // Calcola totali per riga e per colonna
  const colonneTotali = new Map<string, { reali: number; proiezione: number }>();
  for (const L of liste) colonneTotali.set(L.id, { reali: 0, proiezione: 0 });

  const righeTotali = rows.map((r) => {
    let reali = 0;
    let proiezione = 0;
    for (const cell of r.celle) {
      reali += cell.voti_reali;
      proiezione += cell.proiezione;
      const colTot = colonneTotali.get(cell.lista_id)!;
      colTot.reali += cell.voti_reali;
      colTot.proiezione += cell.proiezione;
    }
    return { circoscrizione: r.circoscrizione, reali, proiezione };
  });

  const totaleReali = righeTotali.reduce((a, r) => a + r.reali, 0);
  const totaleProiezione = righeTotali.reduce((a, r) => a + r.proiezione, 0);

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold">Matrice circoscrizione × lista</h3>
        <p className="text-xs text-slate-400">Cella: voti reali / proiezione (stima)</p>
      </div>
      <table className="w-full text-sm min-w-max">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2 sticky left-0 bg-white/5">Circoscrizione</th>
            {liste.map((L) => (
              <th key={L.id} className="px-4 py-2 text-right">
                {L.nome}
              </th>
            ))}
            <th className="px-4 py-2 text-right">Totale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.circoscrizione} className="border-t border-white/5">
              <td className="px-4 py-2 sticky left-0 bg-white/5 font-medium">
                {r.circoscrizione === 0 ? '— (N/A)' : r.circoscrizione}{' '}
                <span className="text-xs text-slate-400">
                  ({r.coverage}/{r.total})
                </span>
              </td>
              {liste.map((L) => {
                const cell = r.celle.find((c) => c.lista_id === L.id);
                if (!cell) {
                  return (
                    <td key={L.id} className="px-4 py-2 text-right text-slate-500">
                      —
                    </td>
                  );
                }
                return (
                  <td key={L.id} className="px-4 py-2 text-right">
                    <div>{cell.voti_reali}</div>
                    <div className="text-xs text-slate-400">
                      → {Math.round(cell.proiezione)}
                    </div>
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right font-semibold">
                {righeTotali[i].reali}
                <div className="text-xs text-slate-400">
                  → {Math.round(righeTotali[i].proiezione)}
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-white/20 font-semibold">
            <td className="px-4 py-2 sticky left-0 bg-white/10">Totale</td>
            {liste.map((L) => {
              const t = colonneTotali.get(L.id)!;
              return (
                <td key={L.id} className="px-4 py-2 text-right">
                  {t.reali}
                  <div className="text-xs text-slate-400">
                    → {Math.round(t.proiezione)}
                  </div>
                </td>
              );
            })}
            <td className="px-4 py-2 text-right">
              {totaleReali}
              <div className="text-xs text-slate-400">
                → {Math.round(totaleProiezione)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
git add src/features/admin/proiezioni/components/MatriceCircoscrizioneListe.tsx
git commit -m "feat(proiezioni): MatriceCircoscrizioneListe read-only con totali per riga e colonna"
```

---

## Task 12: ExportCsvButtons component

**Files:**
- Create: `src/features/admin/proiezioni/components/ExportCsvButtons.tsx`

- [ ] **Step 1: Implementare**

Creare `src/features/admin/proiezioni/components/ExportCsvButtons.tsx`:

```tsx
import { Button } from '@/components/ui';
import {
  buildCandidatiCsv,
  buildListeCsv,
  buildSezioniMancantiCsv,
  triggerCsvDownload,
} from '../csvExport';
import type {
  ProiezioneCandidato,
  ProiezioneLista,
  SezioneMancante,
} from '../proiezioni';

export function ExportCsvButtons({
  liste,
  candidati,
  sezioni,
  listeNomeById,
}: {
  liste: ProiezioneLista[];
  candidati: ProiezioneCandidato[];
  sezioni: SezioneMancante[];
  listeNomeById: Map<string, string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="glass p-4 rounded-2xl flex flex-wrap gap-2">
      <Button
        variant="ghost"
        onClick={() => triggerCsvDownload(buildListeCsv(liste), `proiezione_liste_${today}.csv`)}
        disabled={liste.length === 0}
      >
        Export liste CSV
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          triggerCsvDownload(buildCandidatiCsv(candidati, listeNomeById), `proiezione_candidati_${today}.csv`)
        }
        disabled={candidati.length === 0}
      >
        Export candidati CSV
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          triggerCsvDownload(buildSezioniMancantiCsv(sezioni), `sezioni_mancanti_${today}.csv`)
        }
        disabled={sezioni.length === 0}
      >
        Export sezioni mancanti CSV
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build
git add src/features/admin/proiezioni/components/ExportCsvButtons.tsx
git commit -m "feat(proiezioni): ExportCsvButtons per liste, candidati, sezioni mancanti"
```

---

## Task 13: ProiezioniPage assembling tutti i widget

**Files:**
- Modify: `src/features/admin/proiezioni/ProiezioniPage.tsx`

- [ ] **Step 1: Sostituire lo stub con l'implementazione completa**

Sostituire il contenuto di `src/features/admin/proiezioni/ProiezioniPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PageHeader, Select, Skeleton } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useProiezioniData } from '@/lib/queries/proiezioni';
import {
  coperturePerCircoscrizione,
  matriceCircoscrizioneListe,
  proiezioneCandidati,
  proiezioneListe,
  sezioniMancanti,
} from './proiezioni';
import { KPIHeader } from './components/KPIHeader';
import { ProiezioneListeChart } from './components/ProiezioneListeChart';
import { ProiezioneCandidatiTop } from './components/ProiezioneCandidatiTop';
import { SezioniMancantiList } from './components/SezioniMancantiList';
import { MatriceCircoscrizioneListe } from './components/MatriceCircoscrizioneListe';
import { ExportCsvButtons } from './components/ExportCsvButtons';

const itTime = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

export function ProiezioniPage() {
  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  const bundle = useProiezioniData(selectedGiornataId || undefined, selectedElezioneId || undefined);

  const coperture = useMemo(
    () =>
      coperturePerCircoscrizione({
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        elezioneId: selectedElezioneId,
      }),
    [bundle.sezioni, bundle.risultati, selectedElezioneId],
  );

  const proiListe = useMemo(
    () =>
      proiezioneListe({
        liste: bundle.liste,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        votiLista: bundle.votiLista,
        elezioneId: selectedElezioneId,
      }),
    [bundle.liste, bundle.sezioni, bundle.risultati, bundle.votiLista, selectedElezioneId],
  );

  const proiCand = useMemo(
    () =>
      proiezioneCandidati({
        candidati: bundle.candidati,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        preferenze: bundle.preferenze,
        elezioneId: selectedElezioneId,
      }),
    [bundle.candidati, bundle.sezioni, bundle.risultati, bundle.preferenze, selectedElezioneId],
  );

  const mancanti = useMemo(
    () =>
      sezioniMancanti({
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        elezioneId: selectedElezioneId,
      }),
    [bundle.sezioni, bundle.risultati, selectedElezioneId],
  );

  const matrice = useMemo(
    () =>
      matriceCircoscrizioneListe({
        liste: bundle.liste,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        votiLista: bundle.votiLista,
        elezioneId: selectedElezioneId,
      }),
    [bundle.liste, bundle.sezioni, bundle.risultati, bundle.votiLista, selectedElezioneId],
  );

  const listeNomeById = useMemo(
    () => new Map(bundle.liste.map((l) => [l.id, l.nome])),
    [bundle.liste],
  );

  // Ultimo aggiornamento dal risultati submitted/verified più recente
  const ultimoUpdate = useMemo(() => {
    const counted = bundle.risultati.filter(
      (r) => r.elezione_id === selectedElezioneId && (r.stato === 'submitted' || r.stato === 'verified'),
    );
    if (counted.length === 0) return null;
    const latest = counted.reduce((a, b) =>
      new Date(b.updated_at) > new Date(a.updated_at) ? b : a,
    );
    return {
      when: itTime.format(new Date(latest.updated_at)),
      who: latest.updated_by ?? '—',
    };
  }, [bundle.risultati, selectedElezioneId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proiezioni"
        subtitle="Stima del risultato finale pesata per circoscrizione (admin only). I valori marcati 'proiezione' sono stime, non risultati definitivi."
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

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona giornata ed elezione per vedere le proiezioni.
        </div>
      ) : bundle.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <KPIHeader coperture={coperture} ultimoUpdate={ultimoUpdate} />
          <ProiezioneListeChart rows={proiListe} />
          <ProiezioneCandidatiTop rows={proiCand} listeNomeById={listeNomeById} />
          <SezioniMancantiList sezioni={mancanti} coperture={coperture} />
          <MatriceCircoscrizioneListe rows={matrice} liste={bundle.liste} />
          <ExportCsvButtons
            liste={proiListe}
            candidati={proiCand}
            sezioni={mancanti}
            listeNomeById={listeNomeById}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica build + test**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: tutto passa.

- [ ] **Step 3: Verifica manuale**

Avviare `npm run dev`, login admin, andare a `/admin/proiezioni`. Verificare i 6 widget visibili e funzionanti, scaricare un CSV di prova.

- [ ] **Step 4: Commit**

```bash
git add src/features/admin/proiezioni/ProiezioniPage.tsx
git commit -m "feat(proiezioni): ProiezioniPage compone tutti i 6 widget con bundle hook"
```

---

## Task 14: E2E smoke test

**Files:**
- Create: `tests/e2e/fase4-proiezioni.spec.ts`

- [ ] **Step 1: Scrivere il test**

Creare `tests/e2e/fase4-proiezioni.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL;
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E admin credentials not configured');

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /accedi|login|entra/i }).click();
  await page.waitForURL(/\/(admin|editor|dashboard|$)/);
}

test('admin vede voce di menu Proiezioni', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Proiezioni' })).toBeVisible();
});

test('editor NON vede voce di menu Proiezioni', async ({ page }) => {
  test.skip(!EDITOR_EMAIL || !EDITOR_PASSWORD, 'editor creds missing');
  await login(page, EDITOR_EMAIL!, EDITOR_PASSWORD!);
  await page.goto('/editor');
  await expect(page.locator('text=Proiezioni')).toHaveCount(0);
});

test('admin apre /admin/proiezioni e vede i selettori', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/proiezioni');
  await expect(page.getByLabel(/giornata/i)).toBeVisible();
  await expect(page.getByLabel(/elezione/i)).toBeVisible();
});

test('admin vede header Proiezioni', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/proiezioni');
  await expect(
    page.getByRole('heading', { name: /proiezioni/i }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Eseguire (skippa senza creds)**

```bash
cd /Users/deduzzo/dev/elemanager && npm run test:e2e -- tests/e2e/fase4-proiezioni.spec.ts
```

Expected: PASS o SKIP per credenziali mancanti.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/fase4-proiezioni.spec.ts
git commit -m "test(e2e): smoke test Fase 4 — voci di menu e pagina proiezioni"
```

---

## Task 15: README + tag

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Aggiornare README**

Aggiungere nel `README.md` dopo la sezione Fase 3:

```markdown
## Fase 4 — Proiezioni statistiche (admin-only)

- Pagina `/admin/proiezioni` con stima del risultato finale pesata per circoscrizione.
- 6 widget: KPI copertura, bar chart liste con bande di confidenza, top candidati per preferenze proiettate, sezioni mancanti raggruppate per circoscrizione, matrice circoscrizione × lista, export CSV per liste/candidati/sezioni mancanti.
- Algoritmo: per ogni circoscrizione la proiezione = voti × (totale/coperta); fallback alla media globale per circoscrizioni senza copertura.
- Realtime: si aggiorna live quando un editor chiude una sezione.
- Pure functions in `src/features/admin/proiezioni/proiezioni.ts` con 14+ unit test.
```

- [ ] **Step 2: Validazione finale**

```bash
cd /Users/deduzzo/dev/elemanager && npm run build && npm run test:run
```

Expected: tutto pulito.

- [ ] **Step 3: Commit + tag**

```bash
git add README.md
git commit -m "docs: aggiornamento README per Fase 4 proiezioni"
git tag plan-09-fase4-complete
```

- [ ] **Step 4: Log finale**

```bash
git log --oneline -25
```

---

## Post-execution checklist

- [ ] Tutti i 14+ unit test su `proiezioni.ts` passano.
- [ ] Build pulita.
- [ ] `/admin/proiezioni` visibile solo agli admin (visibilità menu).
- [ ] I 6 widget si caricano e si aggiornano in realtime alla chiusura di una sezione.
- [ ] I 3 export CSV scaricano file leggibili con header corretto.
- [ ] Tag `plan-09-fase4-complete` creato.
