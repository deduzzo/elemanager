import type { ListaRow } from '@/lib/database.types';
import type { MatriceRow } from '../proiezioni';

export function MatriceCircoscrizioneListe({
  rows,
  liste,
}: {
  rows: MatriceRow[];
  liste: ListaRow[];
}) {
  if (rows.length === 0 || liste.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Matrice non disponibile (mancano dati).
      </div>
    );
  }

  // Calcola totali per riga e per colonna
  const colonneTotali = new Map<string, { reali: number; proiezione: number }>();
  for (const L of liste) colonneTotali.set(L.id, { reali: 0, proiezione: 0 });

  const righeTotali = rows.map((r) => {
    let reali = 0;
    let proiezione = 0;
    for (const cell of r.celle) {
      reali += cell.voti_reali;
      proiezione += cell.proiezione;
      const colTot = colonneTotali.get(cell.lista_id)!;
      colTot.reali += cell.voti_reali;
      colTot.proiezione += cell.proiezione;
    }
    return { circoscrizione: r.circoscrizione, reali, proiezione };
  });

  const totaleReali = righeTotali.reduce((a, r) => a + r.reali, 0);
  const totaleProiezione = righeTotali.reduce((a, r) => a + r.proiezione, 0);

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold">Matrice circoscrizione × lista</h3>
        <p className="text-xs text-slate-400">Cella: voti reali / proiezione (stima)</p>
      </div>
      <table className="w-full text-sm min-w-max">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2 sticky left-0 bg-white/5">Circoscrizione</th>
            {liste.map((L) => (
              <th key={L.id} className="px-4 py-2 text-right">
                {L.nome}
              </th>
            ))}
            <th className="px-4 py-2 text-right">Totale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.circoscrizione} className="border-t border-white/5">
              <td className="px-4 py-2 sticky left-0 bg-white/5 font-medium">
                {r.circoscrizione === 0 ? '— (N/A)' : r.circoscrizione}{' '}
                <span className="text-xs text-slate-400">
                  ({r.coverage}/{r.total})
                </span>
              </td>
              {liste.map((L) => {
                const cell = r.celle.find((c) => c.lista_id === L.id);
                if (!cell) {
                  return (
                    <td key={L.id} className="px-4 py-2 text-right text-slate-500">
                      —
                    </td>
                  );
                }
                return (
                  <td key={L.id} className="px-4 py-2 text-right">
                    <div>{cell.voti_reali}</div>
                    <div className="text-xs text-slate-400">
                      → {Math.round(cell.proiezione)}
                    </div>
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right font-semibold">
                {righeTotali[i].reali}
                <div className="text-xs text-slate-400">
                  → {Math.round(righeTotali[i].proiezione)}
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-white/20 font-semibold">
            <td className="px-4 py-2 sticky left-0 bg-white/10">Totale</td>
            {liste.map((L) => {
              const t = colonneTotali.get(L.id)!;
              return (
                <td key={L.id} className="px-4 py-2 text-right">
                  {t.reali}
                  <div className="text-xs text-slate-400">
                    → {Math.round(t.proiezione)}
                  </div>
                </td>
              );
            })}
            <td className="px-4 py-2 text-right">
              {totaleReali}
              <div className="text-xs text-slate-400">
                → {Math.round(totaleProiezione)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
