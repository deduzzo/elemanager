import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useListeByElezione } from '@/lib/queries/liste';
import { useVotiPresuntiBySezione } from '@/lib/queries/votiPresunti';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { sezioneDrillDown } from './confronto';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';

function useSezione(sezioneId: string | undefined) {
  return useQuery({
    queryKey: ['sezione', sezioneId],
    enabled: !!sezioneId,
    queryFn: async (): Promise<SezioneRow | null> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('id', sezioneId as string)
        .single();
      if (error) throw error;
      return data as SezioneRow;
    },
  });
}

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

function useRisultatoSezione(sezioneId: string | undefined, elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultato_sezione', sezioneId, elezioneId]],
    enabled: !!sezioneId && !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultato_sezione', sezioneId, elezioneId],
    enabled: !!sezioneId && !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow | null> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('sezione_id', sezioneId as string)
        .eq('elezione_id', elezioneId as string)
        .maybeSingle();
      if (error) throw error;
      return data as RisultatoSezioneRow | null;
    },
  });
}

function usePreferenzeByRs(rsId: string | undefined) {
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs_single', rsId]],
    enabled: !!rsId,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs_single', rsId],
    enabled: !!rsId,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .eq('risultato_sezione_id', rsId as string);
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

export function SezioneDrillDown() {
  const { sezioneId } = useParams<{ sezioneId: string }>();
  const [sp] = useSearchParams();
  const elezioneId = sp.get('elezione') ?? undefined;

  const { data: sezione, isLoading: lsz } = useSezione(sezioneId);
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiBySezione(sezioneId, elezioneId);
  const { data: rs } = useRisultatoSezione(sezioneId, elezioneId);
  const { data: preferenze = [] } = usePreferenzeByRs(rs?.id);

  const rows = useMemo(() => {
    if (!sezioneId || !elezioneId) return [];
    return sezioneDrillDown({
      sezioneId,
      elezioneId,
      presunti,
      preferenze,
      risultatiSezione: rs ? [rs] : [],
      candidati,
      liste,
    });
  }, [sezioneId, elezioneId, presunti, preferenze, rs, candidati, liste]);

  if (lsz || !sezione) return <Skeleton className="h-40" />;

  const totReale = rows.reduce((a, r) => a + (r.reale ?? 0), 0);
  const totPresunto = rows.reduce((a, r) => a + r.presunto, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Sezione ${sezione.numero}`}
        subtitle={sezione.ubicazione ?? sezione.indirizzo ?? ''}
      />
      <div className="text-sm text-slate-400">
        Stato: {stateLabel[rs?.stato ?? 'assente']}
      </div>
      <Link to="/app/admin/confronto" className="text-sm text-neon-cyan hover:underline">
        ← Torna al confronto
      </Link>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Candidato</th>
              <th className="px-4 py-2">Lista</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const deltaColor =
                r.delta === null
                  ? 'text-slate-500'
                  : r.delta >= 0
                  ? 'text-green-400'
                  : 'text-neon-pink';
              return (
                <tr key={r.candidato_id} className="border-t border-white/5">
                  <td className="px-4 py-2">
                    {r.cognome} {r.nome}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{r.listaNome}</td>
                  <td className="px-4 py-2 text-right">{r.presunto}</td>
                  <td className="px-4 py-2 text-right">
                    {r.reale === null ? <span className="text-slate-500">—</span> : r.reale}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.delta === null ? '—' : r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaColor}`}>
                    {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={6}>
                  Nessuna stima per candidato in questa sezione.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t border-white/20 font-semibold">
                <td className="px-4 py-2" colSpan={2}>
                  Totale
                </td>
                <td className="px-4 py-2 text-right">{totPresunto}</td>
                <td className="px-4 py-2 text-right">{totReale}</td>
                <td className="px-4 py-2 text-right">
                  {totReale - totPresunto > 0
                    ? `+${totReale - totPresunto}`
                    : totReale - totPresunto}
                </td>
                <td className="px-4 py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
