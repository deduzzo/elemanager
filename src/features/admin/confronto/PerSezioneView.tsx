import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { aggregateBySezione } from './confronto';
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

const stateLabel: Record<string, string> = {
  submitted: '✓ submitted',
  verified: '✓ verified',
  draft: '~ draft',
  assente: '⏳ in attesa',
};

export function PerSezioneView({
  elezioneId,
  giornataId,
}: {
  elezioneId: string;
  giornataId: string;
}) {
  const { data: sezioni = [], isLoading: ls } = useSezioniByGiornata(giornataId);
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);
  const { data: risultati = [], isLoading: lr } = useRisultatiByElezione(elezioneId);
  const { data: preferenze = [], isLoading: lp } = usePreferenzeByRs(
    risultati.map((r) => r.id)
  );

  const rows = useMemo(() => {
    return aggregateBySezione({
      sezioni,
      candidati,
      presunti,
      preferenze,
      risultatiSezione: risultati,
    });
  }, [sezioni, candidati, presunti, preferenze, risultati]);

  const sorted = [...rows].sort((a, b) => a.numero - b.numero);

  if (ls || lr || lp) return <Skeleton className="h-40" />;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Sezione</th>
            <th className="px-4 py-2">Indirizzo</th>
            <th className="px-4 py-2">Stato</th>
            <th className="px-4 py-2 text-right"># candidati stimati</th>
            <th className="px-4 py-2 text-right">Reale tot.</th>
            <th className="px-4 py-2 text-right">Presunto tot.</th>
            <th className="px-4 py-2 text-right">Δ</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const deltaColor =
              r.candidatiStimati === 0
                ? 'text-slate-500'
                : r.delta >= 0
                ? 'text-green-400'
                : 'text-neon-pink';
            return (
              <tr key={r.sezione_id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-2">Sez. {r.numero}</td>
                <td className="px-4 py-2 text-slate-300">{r.indirizzo ?? '—'}</td>
                <td className="px-4 py-2 text-slate-300">
                  {stateLabel[r.statoSezione] ?? r.statoSezione}
                </td>
                <td className="px-4 py-2 text-right">{r.candidatiStimati}</td>
                <td className="px-4 py-2 text-right">{r.realeTot}</td>
                <td className="px-4 py-2 text-right">{r.presuntoTot}</td>
                <td className={`px-4 py-2 text-right ${deltaColor}`}>
                  {r.candidatiStimati === 0
                    ? '—'
                    : r.delta > 0
                    ? `+${r.delta}`
                    : r.delta}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to={`/app/admin/confronto/sezione/${r.sezione_id}?elezione=${elezioneId}`}
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
  );
}
