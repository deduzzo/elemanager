import type { CoperturaCircoscrizione } from '../proiezioni';

function colorClass(pct: number): string {
  if (pct >= 80) return 'bg-green-400/20 text-green-300 border border-green-400/30';
  if (pct >= 50) return 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30';
  return 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30';
}

export function KPIHeader({
  coperture,
  ultimoUpdate,
}: {
  coperture: CoperturaCircoscrizione[];
  ultimoUpdate: { when: string; who: string } | null;
}) {
  const totalGlobale = coperture.reduce((a, c) => a + c.total, 0);
  const coverGlobale = coperture.reduce((a, c) => a + c.coverage, 0);
  const pctGlobale = totalGlobale === 0 ? 0 : (coverGlobale / totalGlobale) * 100;

  return (
    <div className="glass p-4 rounded-2xl space-y-4">
      <div>
        <div className="text-xs text-slate-400">Copertura globale</div>
        <div className="text-3xl font-semibold">
          {coverGlobale} / {totalGlobale} sezioni
          <span className="ml-3 text-base font-normal text-slate-300">
            ({pctGlobale.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-2 h-2 bg-white/5 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-neon"
            style={{ width: `${Math.min(100, pctGlobale)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-2">Per circoscrizione</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {coperture.map((c) => {
            const pct = c.total === 0 ? 0 : (c.coverage / c.total) * 100;
            return (
              <div
                key={c.circoscrizione}
                className={`px-3 py-2 rounded-xl text-sm ${colorClass(pct)}`}
              >
                <div className="font-medium">
                  Circoscrizione {c.circoscrizione === 0 ? '— (N/A)' : c.circoscrizione}
                </div>
                <div className="text-xs">
                  {c.coverage} / {c.total} ({pct.toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ultimoUpdate && (
        <div className="text-xs text-slate-400">
          Ultimo aggiornamento: {ultimoUpdate.when} — {ultimoUpdate.who}
        </div>
      )}
    </div>
  );
}
