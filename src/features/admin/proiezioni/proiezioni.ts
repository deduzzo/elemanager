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
