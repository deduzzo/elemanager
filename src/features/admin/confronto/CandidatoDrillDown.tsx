import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useVotiPresuntiByCandidato } from '@/lib/queries/votiPresunti';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import { candidatoDrillDown } from './confronto';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
} from '@/lib/database.types';

function useCandContext(candidatoId: string | undefined) {
  return useQuery({
    queryKey: ['cand_ctx', candidatoId],
    enabled: !!candidatoId,
    queryFn: async () => {
      const { data: c, error } = await db
        .from('candidati')
        .select('*')
        .eq('id', candidatoId as string)
        .single();
      if (error) throw error;
      const cand = c as CandidatoRow;
      const { data: l } = await db
        .from('liste')
        .select('*')
        .eq('id', cand.lista_id)
        .single();
      const lista = l as ListaRow;
      const { data: el } = await db
        .from('elezioni')
        .select('giornata_id')
        .eq('id', lista.elezione_id)
        .single();
      return {
        candidato: cand,
        lista,
        giornataId: (el as { giornata_id: string }).giornata_id,
      };
    },
  });
}

function useRisultatiAndPrefsByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['drill_candidato_bundle', elezioneId]],
    enabled: !!elezioneId,
  });
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['drill_candidato_bundle', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['drill_candidato_bundle', elezioneId],
    enabled: !!elezioneId,
    queryFn: async () => {
      const { data: rs, error: eR } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (eR) throw eR;
      const rsArr = (rs ?? []) as RisultatoSezioneRow[];
      const { data: pref, error: eP } = await db
        .from('preferenze_candidato')
        .select('*')
        .in(
          'risultato_sezione_id',
          rsArr.map((r) => r.id).length > 0 ? rsArr.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000']
        );
      if (eP) throw eP;
      return {
        risultati: rsArr,
        preferenze: (pref ?? []) as PreferenzaCandidatoRow[],
      };
    },
  });
}

const stateLabel: Record<string, string> = {
  submitted: '✓ submitted',
  verified: '✓ verified',
  draft: '~ draft',
  assente: '⏳ in attesa',
};

export function CandidatoDrillDown() {
  const { candidatoId } = useParams<{ candidatoId: string }>();
  const [sp] = useSearchParams();
  const elezioneId = sp.get('elezione') ?? undefined;

  const { data: ctx, isLoading: lc } = useCandContext(candidatoId);
  const { data: bundle, isLoading: lb } = useRisultatiAndPrefsByElezione(elezioneId);
  const { data: presunti = [] } = useVotiPresuntiByCandidato(candidatoId);
  const { data: sezioni = [] } = useSezioniByGiornata(ctx?.giornataId);

  const drill = useMemo(() => {
    if (!ctx || !bundle || !candidatoId) return [];
    return candidatoDrillDown({
      candidatoId,
      presunti,
      preferenze: bundle.preferenze,
      risultatiSezione: bundle.risultati,
      sezioni,
    });
  }, [ctx, bundle, candidatoId, presunti, sezioni]);

  if (lc || lb || !ctx) return <Skeleton className="h-40" />;

  const totaleRow = presunti.find((p) => p.sezione_id === null);
  const reale = drill.reduce((a, r) => a + (r.reale ?? 0), 0);
  const presuntoTot = totaleRow?.voti ?? null;
  const deltaTot = presuntoTot === null ? null : reale - presuntoTot;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${ctx.candidato.cognome} ${ctx.candidato.nome}`}
        subtitle={`Lista: ${ctx.lista.nome}`}
      />
      <Link
        to={`/admin/confronto`}
        className="text-sm text-neon-cyan hover:underline"
      >
        ← Torna al confronto
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Reale (sezioni con risultato)</div>
          <div className="text-2xl font-semibold">{reale}</div>
        </div>
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Presunto totale</div>
          <div className="text-2xl font-semibold">
            {presuntoTot === null ? <span className="text-slate-500">—</span> : presuntoTot}
          </div>
        </div>
        <div className="glass p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Δ</div>
          <div
            className={`text-2xl font-semibold ${
              deltaTot === null
                ? 'text-slate-500'
                : deltaTot >= 0
                ? 'text-green-400'
                : 'text-neon-pink'
            }`}
          >
            {deltaTot === null ? '—' : deltaTot > 0 ? `+${deltaTot}` : deltaTot}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Sezione</th>
              <th className="px-4 py-2 text-right">Presunto</th>
              <th className="px-4 py-2 text-right">Reale</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Δ %</th>
              <th className="px-4 py-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {drill.map((r) => (
              <tr key={r.sezione_id} className="border-t border-white/5">
                <td className="px-4 py-2">Sez. {r.numero}</td>
                <td className="px-4 py-2 text-right">{r.presunto}</td>
                <td className="px-4 py-2 text-right">
                  {r.reale === null ? <span className="text-slate-500">—</span> : r.reale}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.delta === null ? '—' : r.delta > 0 ? `+${r.delta}` : r.delta}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.deltaPerc === null ? '—' : `${r.deltaPerc.toFixed(1)}%`}
                </td>
                <td className="px-4 py-2 text-slate-300">
                  {stateLabel[r.statoSezione] ?? r.statoSezione}
                </td>
              </tr>
            ))}
            {drill.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={6}>
                  Nessuna stima per sezione per questo candidato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
