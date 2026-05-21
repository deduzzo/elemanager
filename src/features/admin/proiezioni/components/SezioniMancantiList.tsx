import { Link } from 'react-router-dom';
import type { CoperturaCircoscrizione, SezioneMancante } from '../proiezioni';

function colorClass(pct: number): string {
  if (pct >= 80) return 'bg-green-400/20 text-green-300';
  if (pct >= 50) return 'bg-yellow-400/20 text-yellow-200';
  return 'bg-neon-pink/20 text-neon-pink';
}

export function SezioniMancantiList({
  sezioni,
  coperture,
}: {
  sezioni: SezioneMancante[];
  coperture: CoperturaCircoscrizione[];
}) {
  const coperturaByCirc = new Map(coperture.map((c) => [c.circoscrizione, c]));
  const groups = new Map<number, SezioneMancante[]>();
  for (const s of sezioni) {
    const arr = groups.get(s.circoscrizione) ?? [];
    arr.push(s);
    groups.set(s.circoscrizione, arr);
  }

  if (sezioni.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-green-300">
        Tutte le sezioni sono coperte. ✓
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold">
          Sezioni mancanti ({sezioni.length})
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a - b)
          .map(([circ, items]) => {
            const cop = coperturaByCirc.get(circ);
            const pct = cop && cop.total > 0 ? (cop.coverage / cop.total) * 100 : 0;
            return (
              <div key={circ} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">
                    Circoscrizione {circ === 0 ? '— (N/A)' : circ}
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-xs ${colorClass(pct)}`}>
                    {cop ? `${cop.coverage}/${cop.total} (${pct.toFixed(0)}%)` : '—'}
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {items.map((s) => (
                    <li key={s.sezione_id} className="flex items-center justify-between">
                      <span>
                        Sez. {s.numero}{' '}
                        <span className="text-slate-400">— {s.indirizzo ?? '—'}</span>
                      </span>
                      <Link
                        to="/app/admin/sezioni"
                        className="text-xs text-neon-cyan hover:underline"
                      >
                        {s.statoSezione === 'draft' ? 'in bozza' : 'in attesa'} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>
    </div>
  );
}
