import type { AggregatiElezione, Copertura } from '@/lib/aggregates';

type Props = {
  copertura: Copertura;
  aggregati: AggregatiElezione;
};

const nf = new Intl.NumberFormat('it-IT');

function Card({
  title,
  value,
  sub,
  extra,
}: {
  title: string;
  value: string;
  sub?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="glass p-4 rounded-2xl flex flex-col gap-1 min-h-[112px]">
      <div className="text-xs uppercase tracking-wider text-slate-400">{title}</div>
      <div className="text-2xl font-semibold bg-gradient-neon bg-clip-text text-transparent">
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {extra}
    </div>
  );
}

export function KpiCards({ copertura, aggregati }: Props) {
  const pctInt = Math.round(copertura.pct * 100);
  const topLista = aggregati.topLista;
  const topCandidato = aggregati.topCandidato;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        title="Copertura"
        value={`${pctInt}%`}
        sub={`${copertura.coperte} / ${copertura.totali} sezioni`}
        extra={
          <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-neon transition-all duration-500"
              style={{ width: `${pctInt}%` }}
            />
          </div>
        }
      />
      <Card
        title="Schede scrutinate"
        value={nf.format(aggregati.totaliSchede.totali)}
        sub={`Bianche: ${nf.format(aggregati.totaliSchede.bianche)} · Nulle: ${nf.format(aggregati.totaliSchede.nulle)} · Contestate: ${nf.format(aggregati.totaliSchede.contestate)}`}
      />
      <Card
        title="Top lista"
        value={topLista ? nf.format(topLista.voti) : '—'}
        sub={
          topLista
            ? `${topLista.nome} · ${(topLista.pct * 100).toFixed(1)}% dei voti`
            : 'Nessun voto'
        }
      />
      <Card
        title="Top preferenza"
        value={topCandidato ? nf.format(topCandidato.voti) : '—'}
        sub={
          topCandidato
            ? `${topCandidato.nome} ${topCandidato.cognome}`
            : 'Nessuna preferenza'
        }
      />
    </div>
  );
}
