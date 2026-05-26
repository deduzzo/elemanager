import { describe, it, expect } from 'vitest';
import { buildReportSezioni, computeReportTotali } from './report';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from '@/lib/database.types';

const sez = (id: string, numero: number): SezioneRow => ({
  id,
  giornata_id: 'g1',
  numero,
  indirizzo: `Via ${numero}`,
  ubicazione: numero === 1 ? 'Scuola Verga' : null,
  lat: null,
  lng: null,
  circoscrizione: null,
  note: null,
  accessibilita: null,
});

const lista = (id: string, nome: string, ordine: number): ListaRow => ({
  id,
  elezione_id: 'el1',
  nome,
  simbolo_url: null,
  ordine,
  created_at: '2026-04-24T00:00:00Z',
});

const cand = (
  id: string,
  lista_id: string,
  cognome: string,
  preferito: boolean,
): CandidatoRow => ({
  id,
  lista_id,
  nome: 'Mario',
  cognome,
  ordine: 0,
  note: null,
  preferito,
  created_at: '2026-04-24T00:00:00Z',
});

const rs = (id: string, sezione_id: string): RisultatoSezioneRow => ({
  id,
  sezione_id,
  elezione_id: 'el1',
  schede_totali: 100,
  schede_bianche: null,
  schede_nulle: null,
  schede_contestate: null,
  stato: 'submitted',
  created_by: null,
  updated_by: null,
  created_at: '2026-04-24T00:00:00Z',
  updated_at: '2026-04-24T00:00:00Z',
});

const vl = (rs_id: string, lista_id: string, voti: number): VotoListaRow => ({
  id: `vl-${rs_id}-${lista_id}`,
  risultato_sezione_id: rs_id,
  lista_id,
  voti,
});

const pref = (rs_id: string, candidato_id: string, voti: number): PreferenzaCandidatoRow => ({
  id: `p-${rs_id}-${candidato_id}`,
  risultato_sezione_id: rs_id,
  candidato_id,
  voti,
});

describe('buildReportSezioni', () => {
  const liste = [lista('l1', 'Lista A', 0), lista('l2', 'Lista B', 1)];
  const candidati = [
    cand('c1', 'l1', 'Bianchi', true), // preferito
    cand('c2', 'l1', 'Verdi', false), // non preferito
    cand('c3', 'l2', 'Neri', true), // preferito
  ];

  it('sezione senza risultato → mancante, liste/preferiti vuoti', () => {
    const rows = buildReportSezioni({
      sezioni: [sez('s1', 1)],
      liste,
      candidati,
      risultatiSezione: [],
      votiLista: [],
      preferenze: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      numero: 1,
      ubicazione: 'Scuola Verga',
      mancante: true,
      stato: null,
      votiLista: [],
      votiListaTot: 0,
      preferiti: [],
    });
  });

  it('sezione inserita → tutte le liste (0 se assente) + solo candidati preferiti', () => {
    const rows = buildReportSezioni({
      sezioni: [sez('s1', 1)],
      liste,
      candidati,
      risultatiSezione: [rs('rs1', 's1')],
      votiLista: [vl('rs1', 'l1', 40)], // l2 assente → 0
      preferenze: [pref('rs1', 'c1', 12), pref('rs1', 'c2', 99)], // c2 non preferito: ignorato
    });
    const r = rows[0];
    expect(r.mancante).toBe(false);
    expect(r.stato).toBe('submitted');
    expect(r.schedeTotali).toBe(100);
    expect(r.votiLista).toEqual([
      { lista_id: 'l1', nome: 'Lista A', voti: 40 },
      { lista_id: 'l2', nome: 'Lista B', voti: 0 },
    ]);
    expect(r.votiListaTot).toBe(40);
    // solo c1 e c3 (preferiti); c3 senza preferenza → 0
    expect(r.preferiti.map((p) => [p.candidato_id, p.voti])).toEqual([
      ['c1', 12],
      ['c3', 0],
    ]);
    expect(r.preferiti.find((p) => p.candidato_id === 'c1')?.listaNome).toBe('Lista A');
  });

  it('ordina le sezioni per numero crescente', () => {
    const rows = buildReportSezioni({
      sezioni: [sez('s3', 3), sez('s1', 1), sez('s2', 2)],
      liste,
      candidati,
      risultatiSezione: [],
      votiLista: [],
      preferenze: [],
    });
    expect(rows.map((r) => r.numero)).toEqual([1, 2, 3]);
  });
});

describe('computeReportTotali', () => {
  const liste = [lista('l1', 'Lista A', 0), lista('l2', 'Lista B', 1)];
  const candidati = [
    cand('c1', 'l1', 'Bianchi', true),
    cand('c3', 'l2', 'Neri', true),
  ];

  it('somma liste e preferiti sulle sole sezioni inserite', () => {
    const rows = buildReportSezioni({
      sezioni: [sez('s1', 1), sez('s2', 2), sez('s3', 3)],
      liste,
      candidati,
      risultatiSezione: [rs('rs1', 's1'), rs('rs2', 's2')], // s3 mancante
      votiLista: [
        vl('rs1', 'l1', 40),
        vl('rs1', 'l2', 10),
        vl('rs2', 'l1', 5),
      ],
      preferenze: [pref('rs1', 'c1', 12), pref('rs2', 'c1', 3), pref('rs2', 'c3', 7)],
    });

    const t = computeReportTotali(rows);
    expect(t.sezioniInserite).toBe(2);
    expect(t.sezioniTotali).toBe(3);
    expect(t.schedeTotali).toBe(200); // 100 + 100
    expect(t.votiLista).toEqual([
      { lista_id: 'l1', nome: 'Lista A', voti: 45 },
      { lista_id: 'l2', nome: 'Lista B', voti: 10 },
    ]);
    expect(t.votiListaTot).toBe(55);
    expect(t.preferiti.map((p) => [p.candidato_id, p.voti])).toEqual([
      ['c1', 15],
      ['c3', 7],
    ]);
    expect(t.preferitiTot).toBe(22);
  });

  it('nessuna sezione inserita → tutto a zero', () => {
    const rows = buildReportSezioni({
      sezioni: [sez('s1', 1)],
      liste,
      candidati,
      risultatiSezione: [],
      votiLista: [],
      preferenze: [],
    });
    const t = computeReportTotali(rows);
    expect(t.sezioniInserite).toBe(0);
    expect(t.votiListaTot).toBe(0);
    expect(t.preferitiTot).toBe(0);
    expect(t.votiLista).toEqual([]);
  });
});
