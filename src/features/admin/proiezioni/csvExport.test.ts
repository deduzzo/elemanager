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
