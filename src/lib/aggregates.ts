// Pure aggregation + projection functions for dashboard.
// No side effects, no I/O — safe to unit test.

import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from './database.types';

export type Copertura = {
  totali: number;
  coperte: number;
  pct: number;
  mancanti: number[];
};

export type VotoListaAgg = {
  lista_id: string;
  nome: string;
  voti: number;
  pct: number;
};

export type PreferenzaCandidatoAgg = {
  candidato_id: string;
  nome: string;
  cognome: string;
  lista_id: string;
  voti: number;
};

export type TotaliSchede = {
  totali: number;
  bianche: number;
  nulle: number;
  contestate: number;
};

export type AggregatiElezione = {
  totaliSchede: TotaliSchede;
  votiPerLista: VotoListaAgg[];
  preferenzePerCandidato: PreferenzaCandidatoAgg[];
  topLista: VotoListaAgg | null;
  topCandidato: PreferenzaCandidatoAgg | null;
};

export type Proiezione = {
  votiPerLista: Array<{
    lista_id: string;
    nome: string;
    votiAttuali: number;
    votiProiezione: number;
  }>;
  schedeProiezione: number;
};

/**
 * Copertura sezioni per una specifica elezione.
 * Una sezione è "coperta" se esiste un risultato per (sezione_id, elezione_id)
 * con stato in ('submitted','verified').
 */
export function computeCopertura(
  sezioni: SezioneRow[],
  risultati: RisultatoSezioneRow[],
  elezioneId: string
): Copertura {
  const sezioniCoperte = new Set<string>();
  for (const r of risultati) {
    if (
      r.elezione_id === elezioneId &&
      (r.stato === 'submitted' || r.stato === 'verified')
    ) {
      sezioniCoperte.add(r.sezione_id);
    }
  }

  const totali = sezioni.length;
  let coperte = 0;
  const mancanti: number[] = [];
  for (const s of sezioni) {
    if (sezioniCoperte.has(s.id)) {
      coperte += 1;
    } else {
      mancanti.push(s.numero);
    }
  }
  mancanti.sort((a, b) => a - b);

  const pct = totali > 0 ? coperte / totali : 0;

  return { totali, coperte, pct, mancanti };
}

/**
 * Aggregati per una specifica elezione: solo risultati submitted/verified.
 * I draft sono in lavorazione e non entrano nei totali.
 */
export function computeAggregati(
  liste: ListaRow[],
  candidati: CandidatoRow[],
  risultati: RisultatoSezioneRow[],
  votiLista: VotoListaRow[],
  preferenze: PreferenzaCandidatoRow[],
  elezioneId: string
): AggregatiElezione {
  const risultatiEle = risultati.filter(
    (r) => r.elezione_id === elezioneId && r.stato !== 'draft'
  );
  const riskIds = new Set(risultatiEle.map((r) => r.id));

  const votiListaFiltered = votiLista.filter((vl) => riskIds.has(vl.risultato_sezione_id));
  const preferenzeFiltered = preferenze.filter((p) => riskIds.has(p.risultato_sezione_id));

  // Totali schede
  const totaliSchede: TotaliSchede = {
    totali: 0,
    bianche: 0,
    nulle: 0,
    contestate: 0,
  };
  for (const r of risultatiEle) {
    totaliSchede.totali += r.schede_totali ?? 0;
    totaliSchede.bianche += r.schede_bianche ?? 0;
    totaliSchede.nulle += r.schede_nulle ?? 0;
    totaliSchede.contestate += r.schede_contestate ?? 0;
  }

  // Voti per lista: group by lista_id
  const listaIndex = new Map<string, ListaRow>();
  for (const l of liste) listaIndex.set(l.id, l);

  const votiByLista = new Map<string, number>();
  for (const vl of votiListaFiltered) {
    votiByLista.set(vl.lista_id, (votiByLista.get(vl.lista_id) ?? 0) + vl.voti);
  }
  const totaleVotiListe = Array.from(votiByLista.values()).reduce((a, b) => a + b, 0);

  const votiPerLista: VotoListaAgg[] = Array.from(votiByLista.entries()).map(
    ([lista_id, voti]) => {
      const lista = listaIndex.get(lista_id);
      return {
        lista_id,
        nome: lista?.nome ?? '',
        voti,
        pct: totaleVotiListe > 0 ? voti / totaleVotiListe : 0,
      };
    }
  );
  votiPerLista.sort((a, b) => b.voti - a.voti);

  // Preferenze per candidato: group by candidato_id
  const candidatoIndex = new Map<string, CandidatoRow>();
  for (const c of candidati) candidatoIndex.set(c.id, c);

  const prefByCandidato = new Map<string, number>();
  for (const p of preferenzeFiltered) {
    prefByCandidato.set(
      p.candidato_id,
      (prefByCandidato.get(p.candidato_id) ?? 0) + p.voti
    );
  }

  const preferenzePerCandidato: PreferenzaCandidatoAgg[] = Array.from(
    prefByCandidato.entries()
  ).map(([candidato_id, voti]) => {
    const c = candidatoIndex.get(candidato_id);
    return {
      candidato_id,
      nome: c?.nome ?? '',
      cognome: c?.cognome ?? '',
      lista_id: c?.lista_id ?? '',
      voti,
    };
  });
  preferenzePerCandidato.sort((a, b) => b.voti - a.voti);

  return {
    totaliSchede,
    votiPerLista,
    preferenzePerCandidato,
    topLista: votiPerLista[0] ?? null,
    topCandidato: preferenzePerCandidato[0] ?? null,
  };
}

/**
 * Proiezione lineare: scala i voti attuali per (totali/coperte).
 * Ritorna null se la copertura è sotto la soglia minima (default 10%),
 * per evitare estrapolazioni troppo rumorose.
 */
export function computeProiezione(
  aggregati: AggregatiElezione,
  copertura: Copertura,
  sogliaMinima = 0.1
): Proiezione | null {
  if (copertura.pct < sogliaMinima) return null;
  if (copertura.coperte <= 0) return null;

  const k = copertura.totali / copertura.coperte;

  const votiPerLista = aggregati.votiPerLista.map((v) => ({
    lista_id: v.lista_id,
    nome: v.nome,
    votiAttuali: v.voti,
    votiProiezione: Math.round(v.voti * k),
  }));

  const schedeProiezione = Math.round(aggregati.totaliSchede.totali * k);

  return { votiPerLista, schedeProiezione };
}
