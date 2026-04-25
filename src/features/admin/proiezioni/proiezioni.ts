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
    const delta = proiezione * sigma;
    const bandaMin = Math.max(0, proiezione - delta);
    const bandaMax = proiezione + delta;

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
    const delta = proiezione * sigma;
    return {
      candidato_id: c.id,
      cognome: c.cognome,
      nome: c.nome,
      lista_id: c.lista_id,
      voti_reali: votiReali,
      proiezione,
      banda_min: Math.max(0, proiezione - delta),
      banda_max: proiezione + delta,
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
