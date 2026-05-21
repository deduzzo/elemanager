import { useMemo, useState } from 'react';
import { StarToggle } from '@/components/ui';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';
import { CandidatoDettaglioModal } from './drilldown/CandidatiDrillDownModal';

const nf = new Intl.NumberFormat('it-IT');

interface Props {
  liste: ListaRow[];
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  preferenze: PreferenzaCandidatoRow[];
}

/**
 * Griglia di card per i candidati marcati come preferito nell'elezione corrente.
 * Cliccando su una card si apre il dettaglio voti per sezione (modale).
 * Visibile a tutti (pubblica e privata): la lettura del flag `preferito` è
 * consentita anche ad anon per le elezioni pubbliche.
 */
export function PreferitiSection({
  liste,
  candidati,
  sezioni,
  risultati,
  preferenze,
}: Props) {
  const [sel, setSel] = useState<CandidatoRow | null>(null);

  const listaById = useMemo(
    () => new Map(liste.map((l) => [l.id, l])),
    [liste],
  );

  const preferitiAggregati = useMemo(() => {
    const preferiti = candidati.filter((c) => c.preferito);
    if (preferiti.length === 0) return [];
    const totaleByCand = new Map<string, number>();
    for (const p of preferenze) {
      totaleByCand.set(p.candidato_id, (totaleByCand.get(p.candidato_id) ?? 0) + p.voti);
    }
    return preferiti
      .map((c) => ({
        candidato: c,
        lista: listaById.get(c.lista_id) ?? null,
        voti: totaleByCand.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.voti - a.voti);
  }, [candidati, preferenze, listaById]);

  if (preferitiAggregati.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
        <span className="text-amber-300">★</span>
        Candidati preferiti
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {preferitiAggregati.map(({ candidato, lista, voti }) => (
          <button
            key={candidato.id}
            type="button"
            onClick={() => setSel(candidato)}
            className="glass rounded-2xl p-4 text-left hover:shadow-neon hover:border-amber-300/40 border border-white/10 transition-all"
          >
            <div className="flex items-start gap-2">
              <StarToggle
                candidatoId={candidato.id}
                preferito={candidato.preferito}
                alwaysShow
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate">
                  {candidato.cognome} {candidato.nome}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {lista?.nome ?? '—'}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Preferenze</span>
              <span className="text-xl font-semibold bg-gradient-neon bg-clip-text text-transparent font-mono">
                {nf.format(voti)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {sel && (
        <CandidatoDettaglioModal
          candidato={sel}
          onClose={() => setSel(null)}
          lista={listaById.get(sel.lista_id) ?? null}
          sezioni={sezioni}
          risultati={risultati}
          preferenze={preferenze}
        />
      )}
    </section>
  );
}
