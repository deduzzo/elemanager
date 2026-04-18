import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PreferenzaCandidatoAgg } from '@/lib/aggregates';
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

type ChartDatum = {
  candidato_id: string;
  label: string;
  fullName: string;
  voti: number;
};

export function TopCandidatiChart({ data }: { data: PreferenzaCandidatoAgg[] }) {
  const chartData: ChartDatum[] = data.map((c) => ({
    candidato_id: c.candidato_id,
    label: `${c.nome.charAt(0)}. ${c.cognome}`,
    fullName: `${c.nome} ${c.cognome}`,
    voti: c.voti,
  }));

  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Top candidati</h3>
      {chartData.length === 0 ? (
        <EmptyState
          title="Nessuna preferenza"
          description="Le preferenze compariranno quando arriveranno i primi risultati."
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ left: 4, right: 8, top: 4, bottom: 24 }}>
            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={48}
            />
            <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e8f0',
              }}
              labelStyle={{ color: '#cbd5e1' }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as ChartDatum | undefined;
                return item?.fullName ?? '';
              }}
              formatter={(value) => Number(value).toLocaleString('it-IT')}
            />
            <Bar dataKey="voti" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
