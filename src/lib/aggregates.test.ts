import { describe, expect, it } from 'vitest';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from './database.types';
import {
  computeAggregati,
  computeCopertura,
  computeProiezione,
} from './aggregates';

// ---------- Fixtures helpers ----------

const now = '2026-01-01T00:00:00Z';

function sezione(id: string, numero: number, giornata_id = 'g1'): SezioneRow {
  return {
    id,
    giornata_id,
    numero,
    indirizzo: null,
    ubicazione: null,
    lat: null,
    lng: null,
    circoscrizione: null,
    note: null,
    accessibilita: null,
  };
}

function risultato(
  id: string,
  sezione_id: string,
  elezione_id: string,
  stato: RisultatoSezioneRow['stato'],
  schede: Partial<
    Pick<
      RisultatoSezioneRow,
      'schede_totali' | 'schede_bianche' | 'schede_nulle' | 'schede_contestate'
    >
  > = {}
): RisultatoSezioneRow {
  return {
    id,
    sezione_id,
    elezione_id,
    schede_totali: schede.schede_totali ?? null,
    schede_bianche: schede.schede_bianche ?? null,
    schede_nulle: schede.schede_nulle ?? null,
    schede_contestate: schede.schede_contestate ?? null,
    stato,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
}

function lista(id: string, nome: string, elezione_id = 'e1'): ListaRow {
  return { id, elezione_id, nome, simbolo_url: null, ordine: 0, created_at: now };
}

function candidato(
  id: string,
  nome: string,
  cognome: string,
  lista_id: string
): CandidatoRow {
  return { id, lista_id, nome, cognome, ordine: 0, note: null, created_at: now };
}

function votoLista(
  id: string,
  risultato_sezione_id: string,
  lista_id: string,
  voti: number
): VotoListaRow {
  return { id, risultato_sezione_id, lista_id, voti };
}

function preferenza(
  id: string,
  risultato_sezione_id: string,
  candidato_id: string,
  voti: number
): PreferenzaCandidatoRow {
  return { id, risultato_sezione_id, candidato_id, voti };
}

// ---------- computeCopertura ----------

describe('computeCopertura', () => {
  it('calcola copertura parziale con una sezione coperta su tre', () => {
    const sezioni = [sezione('s1', 1), sezione('s2', 2), sezione('s3', 3)];
    const risultati = [risultato('r1', 's2', 'e1', 'submitted')];

    const cov = computeCopertura(sezioni, risultati, 'e1');

    expect(cov.totali).toBe(3);
    expect(cov.coperte).toBe(1);
    expect(cov.pct).toBeCloseTo(1 / 3, 5);
    expect(cov.mancanti).toEqual([1, 3]);
  });

  it('ritorna 0% e mancanti=tutti quando non ci sono risultati', () => {
    const sezioni = [sezione('s1', 5), sezione('s2', 3)];

    const cov = computeCopertura(sezioni, [], 'e1');

    expect(cov.totali).toBe(2);
    expect(cov.coperte).toBe(0);
    expect(cov.pct).toBe(0);
    // mancanti ordinati asc per numero
    expect(cov.mancanti).toEqual([3, 5]);
  });

  it('ritorna 100% quando tutte le sezioni hanno risultato submitted/verified', () => {
    const sezioni = [sezione('s1', 1), sezione('s2', 2)];
    const risultati = [
      risultato('r1', 's1', 'e1', 'submitted'),
      risultato('r2', 's2', 'e1', 'verified'),
    ];

    const cov = computeCopertura(sezioni, risultati, 'e1');

    expect(cov.coperte).toBe(2);
    expect(cov.pct).toBe(1);
    expect(cov.mancanti).toEqual([]);
  });

  it('non conta risultati di altre elezioni né risultati draft', () => {
    const sezioni = [sezione('s1', 1), sezione('s2', 2)];
    const risultati = [
      // stessa sezione ma elezione diversa → non conta
      risultato('r1', 's1', 'e2', 'submitted'),
      // stesso elezione ma draft → non conta
      risultato('r2', 's2', 'e1', 'draft'),
    ];

    const cov = computeCopertura(sezioni, risultati, 'e1');

    expect(cov.coperte).toBe(0);
    expect(cov.pct).toBe(0);
    expect(cov.mancanti).toEqual([1, 2]);
  });

  it('gestisce la lista di sezioni vuota', () => {
    const cov = computeCopertura([], [], 'e1');
    expect(cov.totali).toBe(0);
    expect(cov.coperte).toBe(0);
    expect(cov.pct).toBe(0);
    expect(cov.mancanti).toEqual([]);
  });
});

// ---------- computeAggregati ----------

describe('computeAggregati', () => {
  it('aggrega voti/preferenze/schede e ordina desc; filtra draft', () => {
    const liste = [lista('L1', 'Lista Alfa'), lista('L2', 'Lista Beta')];
    const candidati = [
      candidato('C1', 'Anna', 'Rossi', 'L1'),
      candidato('C2', 'Mario', 'Bianchi', 'L1'),
      candidato('C3', 'Luca', 'Verdi', 'L2'),
    ];

    const risultati = [
      risultato('R1', 's1', 'e1', 'submitted', {
        schede_totali: 100,
        schede_bianche: 2,
        schede_nulle: 3,
        schede_contestate: 1,
      }),
      risultato('R2', 's2', 'e1', 'verified', {
        schede_totali: 80,
        schede_bianche: 1,
        schede_nulle: null, // null → 0
        schede_contestate: 0,
      }),
      // draft: NON deve rientrare nei totali
      risultato('R3', 's3', 'e1', 'draft', {
        schede_totali: 999,
        schede_bianche: 999,
        schede_nulle: 999,
        schede_contestate: 999,
      }),
      // altra elezione: NON deve rientrare
      risultato('R4', 's4', 'e2', 'submitted', {
        schede_totali: 500,
      }),
    ];

    const votiLista = [
      // R1: L1=40, L2=30
      votoLista('v1', 'R1', 'L1', 40),
      votoLista('v2', 'R1', 'L2', 30),
      // R2: L1=20, L2=25
      votoLista('v3', 'R2', 'L1', 20),
      votoLista('v4', 'R2', 'L2', 25),
      // R3 draft → deve essere filtrato fuori
      votoLista('v5', 'R3', 'L1', 9999),
      // R4 altra elezione → filtrato fuori
      votoLista('v6', 'R4', 'L1', 8888),
    ];

    const preferenze = [
      // C1: 10 + 5 = 15, C2: 2, C3: 7 + 3 = 10
      preferenza('p1', 'R1', 'C1', 10),
      preferenza('p2', 'R1', 'C2', 2),
      preferenza('p3', 'R1', 'C3', 7),
      preferenza('p4', 'R2', 'C1', 5),
      preferenza('p5', 'R2', 'C3', 3),
      // R3 draft → filtrato
      preferenza('p6', 'R3', 'C1', 9999),
    ];

    const agg = computeAggregati(liste, candidati, risultati, votiLista, preferenze, 'e1');

    // Totali schede: solo R1 + R2
    expect(agg.totaliSchede.totali).toBe(180);
    expect(agg.totaliSchede.bianche).toBe(3);
    expect(agg.totaliSchede.nulle).toBe(3); // null di R2 → 0
    expect(agg.totaliSchede.contestate).toBe(1);

    // Voti per lista: L1=60, L2=55 → sorted desc
    expect(agg.votiPerLista).toHaveLength(2);
    expect(agg.votiPerLista[0]).toMatchObject({ lista_id: 'L1', nome: 'Lista Alfa', voti: 60 });
    expect(agg.votiPerLista[1]).toMatchObject({ lista_id: 'L2', nome: 'Lista Beta', voti: 55 });
    // pct calcolato su totale 115
    expect(agg.votiPerLista[0].pct).toBeCloseTo(60 / 115, 5);
    expect(agg.votiPerLista[1].pct).toBeCloseTo(55 / 115, 5);

    // Preferenze: C1=15, C3=10, C2=2
    expect(agg.preferenzePerCandidato).toHaveLength(3);
    expect(agg.preferenzePerCandidato[0]).toMatchObject({
      candidato_id: 'C1',
      nome: 'Anna',
      cognome: 'Rossi',
      lista_id: 'L1',
      voti: 15,
    });
    expect(agg.preferenzePerCandidato[1]).toMatchObject({ candidato_id: 'C3', voti: 10 });
    expect(agg.preferenzePerCandidato[2]).toMatchObject({ candidato_id: 'C2', voti: 2 });

    expect(agg.topLista?.lista_id).toBe('L1');
    expect(agg.topCandidato?.candidato_id).toBe('C1');
  });

  it('ritorna strutture vuote e top null quando non ci sono risultati submitted/verified', () => {
    const risultati = [risultato('R1', 's1', 'e1', 'draft', { schede_totali: 10 })];
    const votiLista = [votoLista('v1', 'R1', 'L1', 5)];

    const agg = computeAggregati(
      [lista('L1', 'Lista Alfa')],
      [],
      risultati,
      votiLista,
      [],
      'e1'
    );

    expect(agg.totaliSchede).toEqual({ totali: 0, bianche: 0, nulle: 0, contestate: 0 });
    expect(agg.votiPerLista).toEqual([]);
    expect(agg.preferenzePerCandidato).toEqual([]);
    expect(agg.topLista).toBeNull();
    expect(agg.topCandidato).toBeNull();
  });
});

// ---------- computeProiezione ----------

describe('computeProiezione', () => {
  it('ritorna null quando la copertura è sotto soglia minima', () => {
    const copertura = { totali: 100, coperte: 5, pct: 0.05, mancanti: [] };
    const aggregati = {
      totaliSchede: { totali: 500, bianche: 0, nulle: 0, contestate: 0 },
      votiPerLista: [{ lista_id: 'L1', nome: 'Alfa', voti: 100, pct: 1 }],
      preferenzePerCandidato: [],
      topLista: null,
      topCandidato: null,
    };

    expect(computeProiezione(aggregati, copertura)).toBeNull();
    // anche soglia custom
    expect(computeProiezione(aggregati, copertura, 0.5)).toBeNull();
  });

  it('scala correttamente voti e schede quando la copertura supera la soglia', () => {
    // 100 sezioni totali, 20 coperte → k = 5
    const copertura = { totali: 100, coperte: 20, pct: 0.2, mancanti: [] };
    const aggregati = {
      totaliSchede: { totali: 400, bianche: 10, nulle: 5, contestate: 0 },
      votiPerLista: [
        { lista_id: 'L1', nome: 'Alfa', voti: 120, pct: 0.6 },
        { lista_id: 'L2', nome: 'Beta', voti: 80, pct: 0.4 },
      ],
      preferenzePerCandidato: [],
      topLista: null,
      topCandidato: null,
    };

    const proj = computeProiezione(aggregati, copertura);

    expect(proj).not.toBeNull();
    expect(proj!.schedeProiezione).toBe(2000); // 400 * 5
    expect(proj!.votiPerLista).toEqual([
      { lista_id: 'L1', nome: 'Alfa', votiAttuali: 120, votiProiezione: 600 },
      { lista_id: 'L2', nome: 'Beta', votiAttuali: 80, votiProiezione: 400 },
    ]);
  });

  it('ritorna null quando copertura.coperte è zero (evita division by zero)', () => {
    const copertura = { totali: 100, coperte: 0, pct: 0, mancanti: [] };
    const aggregati = {
      totaliSchede: { totali: 0, bianche: 0, nulle: 0, contestate: 0 },
      votiPerLista: [],
      preferenzePerCandidato: [],
      topLista: null,
      topCandidato: null,
    };

    expect(computeProiezione(aggregati, copertura, 0)).toBeNull();
  });
});
