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
