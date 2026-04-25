import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import {
  aggregateByCandidato,
  type CandidatoConfrontoRow,
} from './confronto';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
} from '@/lib/database.types';

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

function useRisultatiByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultati_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultati_by_elezione', elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });
}

function usePreferenzeByRs(rsIds: string[]) {
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs', rsIds.join(',')]],
    enabled: rsIds.length > 0,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs', rsIds.join(',')],
    enabled: rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

type Ordering = 'deltaPerc_asc' | 'delta_asc' | 'cognome_asc';

export function PerCandidatoView({
  elezioneId,
}: {
  elezioneId: string;
  giornataId: string;
}) {
  const [ordering, setOrdering] = useState<Ordering>('deltaPerc_asc');

  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);
  const { data: risultati = [], isLoading: lr } = useRisultatiByElezione(elezioneId);
  const { data: preferenze = [], isLoading: lp } = usePreferenzeByRs(
    risultati.map((r) => r.id)
  );

  const rows = useMemo(() => {
    return aggregateByCandidato({
      candidati,
      presunti,
      preferenze,
      risultatiSezione: risultati,
    });
  }, [candidati, presunti, preferenze, risultati]);

  const sorted = useMemo(() => {
    const cmp: Record<Ordering, (a: CandidatoConfrontoRow, b: CandidatoConfrontoRow) => number> = {
      deltaPerc_asc: (a, b) => (a.deltaPerc ?? 0) - (b.deltaPerc ?? 0),
      delta_asc: (a, b) => (a.delta ?? 0) - (b.delta ?? 0),
      cognome_asc: (a, b) => a.cognome.localeCompare(b.cognome),
    };
    return [...rows].sort(cmp[ordering]);
  }, [rows, ordering]);

  const coperte = new Set(
    risultati.filter((r) => r.stato === 'submitted' || r.stato === 'verified').map((r) => r.sezione_id)
  ).size;
  const sezConStima = new Set(presunti.filter((p) => p.sezione_id).map((p) => p.sezione_id)).size;

  if (lr || lp) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-3">
      <div className="glass p-3 rounded-2xl text-sm text-slate-300 flex flex-wrap gap-4 items-center">
        <span>
          Copertura: <strong>{coperte}</strong> sezioni con risultato (di cui {sezConStima} anche stimate).
        </span>
        <label className="ml-auto text-xs text-slate-400">
          Ordinamento
          <select
            className="ml-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm"
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as Ordering)}
          >
            <option value="deltaPerc_asc">Δ % crescente (peggio sopra)</option>
            <option value="delta_asc">Δ assoluto crescente</option>
            <option value="cognome_asc">Alfabetico</option>
          </select>
        </label>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Candidato</th>
              <th className="px-4 py-2">Lista</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const listaNome = liste.find((l) => l.id === r.lista_id)?.nome ?? '';
              const deltaColor =
                r.delta === null
                  ? 'text-slate-500'
                  : r.delta >= 0
                  ? 'text-green-400'
                  : 'text-neon-pink';
              return (
                <tr key={r.candidato_id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2">
                    {r.cognome} {r.nome}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{listaNome}</td>
                  <td className="px-4 py-2 text-right">{r.reale}</td>
                  <td className="px-4 py-2 text-right">
                    {r.presunto === null ? <span className="text-slate-500">—</span> : r.presunto}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.delta === null ? '—' : (r.delta > 0 ? `+${r.delta}` : r.delta)}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/confronto/candidato/${r.candidato_id}?elezione=${elezioneId}`}
                      className="text-neon-cyan hover:underline"
                    >
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
