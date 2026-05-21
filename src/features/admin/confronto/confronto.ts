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
  ubicazione: string | null;
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
      ubicazione: s.ubicazione,
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
