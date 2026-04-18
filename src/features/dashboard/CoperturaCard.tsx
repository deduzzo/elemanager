import type { Copertura } from '@/lib/aggregates';

export function CoperturaCard({ copertura }: { copertura: Copertura }) {
  const visible = copertura.mancanti.slice(0, 20);
  const rest = Math.max(0, copertura.mancanti.length - visible.length);
  const pctInt = Math.round(copertura.pct * 100);

  return (
    <div className="glass p-4 rounded-2xl space-y-3">
      <h3 className="text-sm font-semibold text-slate-200">Copertura sezioni</h3>
      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-neon transition-all duration-500"
          style={{ width: `${pctInt}%` }}
        />
      </div>
      <div className="text-xs text-slate-400">
        {copertura.coperte} su {copertura.totali} · {pctInt}%
      </div>
      {copertura.mancanti.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 mb-1">
            Sezioni non ancora inviate:
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            {visible.map((n) => (
              <span
                key={n}
                className="px-2 py-0.5 bg-white/5 rounded font-mono text-slate-300"
              >
                {n}
              </span>
            ))}
            {rest > 0 && <span className="text-slate-500">+{rest} altre</span>}
          </div>
        </div>
      )}
      {copertura.totali > 0 && copertura.mancanti.length === 0 && (
        <div className="text-xs text-emerald-400">
          Tutte le sezioni sono state inviate.
        </div>
      )}
    </div>
  );
}
