import { useState } from 'react';
import type { ProiezioneCandidato } from '../proiezioni';

export function ProiezioneCandidatiTop({
  rows,
  listeNomeById,
}: {
  rows: ProiezioneCandidato[];
  listeNomeById: Map<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...rows].sort((a, b) => b.proiezione - a.proiezione);
  const visible = showAll ? sorted : sorted.slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Nessun candidato da proiettare.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <h3 className="text-sm font-semibold">
          Top candidati per preferenze proiettate{' '}
          <span className="text-xs text-slate-400">(stima)</span>
        </h3>
        {sorted.length > 10 && (
          <button
            type="button"
            className="text-xs text-neon-cyan hover:underline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Mostra solo top 10' : `Mostra tutti (${sorted.length})`}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Candidato</th>
            <th className="px-4 py-2">Lista</th>
            <th className="px-4 py-2 text-right">Pref. reali</th>
            <th className="px-4 py-2 text-right">Proiezione</th>
            <th className="px-4 py-2 text-right">Banda</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((c, i) => (
            <tr key={c.candidato_id} className="border-t border-white/5">
              <td className="px-4 py-2 text-slate-400">{i + 1}</td>
              <td className="px-4 py-2">
                {c.cognome} {c.nome}
              </td>
              <td className="px-4 py-2 text-slate-300">
                {listeNomeById.get(c.lista_id) ?? ''}
              </td>
              <td className="px-4 py-2 text-right">{c.voti_reali}</td>
              <td className="px-4 py-2 text-right font-semibold">
                {Math.round(c.proiezione)}
              </td>
              <td className="px-4 py-2 text-right text-xs text-slate-400">
                {Math.round(c.banda_min)} – {Math.round(c.banda_max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
