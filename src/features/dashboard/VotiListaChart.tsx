import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { VotoListaAgg } from '@/lib/aggregates';
import { EmptyState } from '@/components/ui';

const COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#60a5fa',
  '#c084fc',
];

export function VotiListaChart({ data }: { data: VotoListaAgg[] }) {
  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Voti per lista</h3>
      {data.length === 0 ? (
        <EmptyState
          title="Nessun voto aggregato"
          description="I dati compariranno quando saranno inviati i primi risultati."
        />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nome"
              stroke="#94a3b8"
              fontSize={11}
              width={120}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e8f0',
              }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(value) => Number(value).toLocaleString('it-IT')}
            />
            <Bar dataKey="voti" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
