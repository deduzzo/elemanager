import { describe, it, expect } from 'vitest';
import { coperturePerCircoscrizione } from './proiezioni';
import type {
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';
import { proiezioneListe, type ProiezioneLista } from './proiezioni';
import type { ListaRow, VotoListaRow } from '@/lib/database.types';
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
