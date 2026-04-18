import type { Proiezione } from '@/lib/aggregates';

const nf = new Intl.NumberFormat('it-IT');

export function ProiezioneCard({ proiezione }: { proiezione: Proiezione | null }) {
  if (!proiezione) {
    return (
      <div className="glass p-4 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Proiezione finale
        </h3>
        <p className="text-sm text-slate-400">
          Proiezione non disponibile: servono almeno il 10% di sezioni inviate.
        </p>
      </div>
    );
  }

  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        Proiezione finale
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Stima lineare su {nf.format(proiezione.schedeProiezione)} schede
      </p>
      {proiezione.votiPerLista.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun voto aggregato.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {proiezione.votiPerLista.slice(0, 8).map((p) => (
            <li
              key={p.lista_id}
              className="flex justify-between border-b border-white/5 pb-1 last:border-0"
            >
              <span className="text-slate-200 truncate pr-2">{p.nome}</span>
              <span className="font-mono text-neon-cyan whitespace-nowrap">
                {nf.format(p.votiProiezione)}
                <span className="text-slate-500 text-xs ml-1">
                  (da {nf.format(p.votiAttuali)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
