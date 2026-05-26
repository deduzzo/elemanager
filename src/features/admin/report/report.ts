import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  StatoRisultato,
  VotoListaRow,
} from '@/lib/database.types';

export interface ReportListaVoto {
  lista_id: string;
  nome: string;
  voti: number;
}

export interface ReportPreferitoVoto {
  candidato_id: string;
  cognome: string;
  nome: string;
  listaNome: string;
  voti: number;
}

export interface ReportSezioneRow {
  sezione_id: string;
  numero: number;
  ubicazione: string | null;
  indirizzo: string | null;
  /** true quando non esiste alcun risultato_sezione per questa sezione/elezione. */
  mancante: boolean;
  stato: StatoRisultato | null;
  schedeTotali: number | null;
  schedeBianche: number | null;
  schedeNulle: number | null;
  votiLista: ReportListaVoto[];
  votiListaTot: number;
  preferiti: ReportPreferitoVoto[];
}

/**
 * Costruisce le righe del report per ogni sezione (ordinate per numero).
 *
 * Una sezione è `mancante` quando non ha alcun `risultato_sezione` per
 * l'elezione corrente. Se il risultato esiste mostra i voti anche in stato
 * `draft` (col badge stato), così il report riflette quanto effettivamente
 * inserito. `votiLista` elenca SEMPRE tutte le liste dell'elezione (0 se
 * mancante il voto), `preferiti` solo i candidati con `preferito = true`.
 */
export function buildReportSezioni(params: {
  sezioni: SezioneRow[];
  liste: ListaRow[];
  candidati: CandidatoRow[];
  risultatiSezione: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
  preferenze: PreferenzaCandidatoRow[];
}): ReportSezioneRow[] {
  const { sezioni, liste, candidati, risultatiSezione, votiLista, preferenze } = params;

  const listaById = new Map(liste.map((l) => [l.id, l]));
  const preferiti = candidati.filter((c) => c.preferito);

  // sezione_id → risultato_sezione (uno per sezione: i risultati arrivano già
  // filtrati per elezione).
  const rsBySez = new Map<string, RisultatoSezioneRow>();
  for (const r of risultatiSezione) rsBySez.set(r.sezione_id, r);

  // rs_id|lista_id → voti
  const votiListaByRs = new Map<string, number>();
  for (const v of votiLista) {
    votiListaByRs.set(`${v.risultato_sezione_id}|${v.lista_id}`, v.voti);
  }

  // rs_id|candidato_id → voti
  const prefByRs = new Map<string, number>();
  for (const p of preferenze) {
    prefByRs.set(`${p.risultato_sezione_id}|${p.candidato_id}`, p.voti);
  }

  return [...sezioni]
    .sort((a, b) => a.numero - b.numero)
    .map((s): ReportSezioneRow => {
      const rs = rsBySez.get(s.id) ?? null;
      const mancante = rs === null;

      const votiListaRows: ReportListaVoto[] = mancante
        ? []
        : liste.map((l) => ({
            lista_id: l.id,
            nome: l.nome,
            voti: votiListaByRs.get(`${rs!.id}|${l.id}`) ?? 0,
          }));

      const preferitiRows: ReportPreferitoVoto[] = mancante
        ? []
        : preferiti.map((c) => ({
            candidato_id: c.id,
            cognome: c.cognome,
            nome: c.nome,
            listaNome: listaById.get(c.lista_id)?.nome ?? '',
            voti: prefByRs.get(`${rs!.id}|${c.id}`) ?? 0,
          }));

      return {
        sezione_id: s.id,
        numero: s.numero,
        ubicazione: s.ubicazione,
        indirizzo: s.indirizzo,
        mancante,
        stato: rs?.stato ?? null,
        schedeTotali: rs?.schede_totali ?? null,
        schedeBianche: rs?.schede_bianche ?? null,
        schedeNulle: rs?.schede_nulle ?? null,
        votiLista: votiListaRows,
        votiListaTot: votiListaRows.reduce((a, b) => a + b.voti, 0),
        preferiti: preferitiRows,
      };
    });
}
