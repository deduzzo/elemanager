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
    newline: '\n',
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
    newline: '\n',
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
    newline: '\n',
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
