import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProiezioneLista } from '../proiezioni';

export function ProiezioneListeChart({ rows }: { rows: ProiezioneLista[] }) {
  const data = [...rows]
    .sort((a, b) => b.proiezione - a.proiezione)
    .map((r) => ({
      nome: r.nome,
      proiezione: Math.round(r.proiezione),
      voti_reali: r.voti_reali,
      banda_min: Math.round(r.banda_min),
      banda_max: Math.round(r.banda_max),
      // ErrorBar accetta deviazioni: [downValue, upValue]
      err: [
        Math.round(r.proiezione - r.banda_min),
        Math.round(r.banda_max - r.proiezione),
      ],
    }));

  if (data.length === 0) {
    return (
      <div className="glass p-6 rounded-2xl text-slate-300">
        Nessuna lista da proiettare per questa elezione.
      </div>
    );
  }

  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="text-sm font-semibold mb-3">
        Proiezione voti per lista <span className="text-xs text-slate-400">(stima)</span>
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 40)}>
        <BarChart layout="vertical" data={data} margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" stroke="#94a3b8" />
          <YAxis dataKey="nome" type="category" width={140} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
            formatter={(value, name) => {
              if (name === 'proiezione') return [`${value} (proiezione)`, 'Proiezione'];
              return [value as number, name as string];
            }}
          />
          <Bar dataKey="proiezione" fill="#22d3ee" radius={[0, 8, 8, 0]}>
            <ErrorBar dataKey="err" width={8} stroke="#ef4444" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
