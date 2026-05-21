import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ErrorBoundary, SkeletonCard, EmptyState } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useRisultatiByGiornata } from '@/lib/queries/risultati';
import {
  computeAggregati,
  computeCopertura,
  computeProiezione,
} from '@/lib/aggregates';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  VotoListaRow,
} from '@/lib/database.types';
import { KpiCards } from './KpiCards';
import { VotiListaChart } from './VotiListaChart';
import { TopCandidatiChart } from './TopCandidatiChart';
import { CoperturaCard } from './CoperturaCard';
import { ProiezioneCard } from './ProiezioneCard';
import { SezioniDrillDownModal } from './drilldown/SezioniDrillDownModal';
import { VotiListaDrillDownModal } from './drilldown/VotiListaDrillDownModal';
import { CandidatiDrillDownModal } from './drilldown/CandidatiDrillDownModal';

type DrillDown = null | 'sezioni' | 'liste' | 'candidati';

interface Props {
  giornataId: string | undefined;
  elezioneId: string | undefined;
}

/**
 * Componente dashboard "pura": data fetching + 4 card aggregate + 3 drill-down modali.
 * Usato sia dalla DashboardPage privata (con filtri esterni) sia dalla DashboardPublicaPage
 * (filtri fissati da URL).
 */
export function DashboardCore({ giornataId, elezioneId }: Props) {
  const [drill, setDrill] = useState<DrillDown>(null);

  const sezioniQ = useSezioniByGiornata(giornataId);
  const listeQ = useListeByElezione(elezioneId);
  const risultatiQ = useRisultatiByGiornata(giornataId);

  const sezioni = sezioniQ.data ?? [];
  const liste = listeQ.data ?? [];
  const risultatiAll = risultatiQ.data ?? [];

  const risultatiElezione = useMemo(
    () =>
      elezioneId
        ? risultatiAll.filter((r) => r.elezione_id === elezioneId)
        : [],
    [risultatiAll, elezioneId],
  );

  const candidatiQueries = useQueries({
    queries: liste.map((l) => ({
      queryKey: ['candidati', l.id],
      enabled: !!l.id,
      queryFn: async (): Promise<CandidatoRow[]> => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', l.id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });

  const allCandidati = useMemo<CandidatoRow[]>(
    () => candidatiQueries.flatMap((q) => q.data ?? []),
    [candidatiQueries],
  );
  const candidatiLoading = candidatiQueries.some((q) => q.isLoading);

  const votiListaQueries = useQueries({
    queries: risultatiElezione.map((r) => ({
      queryKey: ['voti-lista', r.id],
      enabled: !!r.id,
      queryFn: async (): Promise<VotoListaRow[]> => {
        const { data, error } = await db
          .from('voti_lista')
          .select('*')
          .eq('risultato_sezione_id', r.id);
        if (error) throw error;
        return (data ?? []) as VotoListaRow[];
      },
    })),
  });

  const preferenzeQueries = useQueries({
    queries: risultatiElezione.map((r) => ({
      queryKey: ['preferenze', r.id],
      enabled: !!r.id,
      queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
        const { data, error } = await db
          .from('preferenze_candidato')
          .select('*')
          .eq('risultato_sezione_id', r.id);
        if (error) throw error;
        return (data ?? []) as PreferenzaCandidatoRow[];
      },
    })),
  });

  const allVotiLista = useMemo<VotoListaRow[]>(
    () => votiListaQueries.flatMap((q) => q.data ?? []),
    [votiListaQueries],
  );
  const allPreferenze = useMemo<PreferenzaCandidatoRow[]>(
    () => preferenzeQueries.flatMap((q) => q.data ?? []),
    [preferenzeQueries],
  );

  const votiLoading = votiListaQueries.some((q) => q.isLoading);
  const preferenzeLoading = preferenzeQueries.some((q) => q.isLoading);

  const copertura = useMemo(() => {
    if (!elezioneId) return null;
    return computeCopertura(sezioni, risultatiAll, elezioneId);
  }, [sezioni, risultatiAll, elezioneId]);

  const aggregati = useMemo(() => {
    if (!elezioneId) return null;
    return computeAggregati(
      liste,
      allCandidati,
      risultatiAll,
      allVotiLista,
      allPreferenze,
      elezioneId,
    );
  }, [
    liste,
    allCandidati,
    risultatiAll,
    allVotiLista,
    allPreferenze,
    elezioneId,
  ]);

  const proiezione = useMemo(() => {
    if (!aggregati || !copertura) return null;
    return computeProiezione(aggregati, copertura);
  }, [aggregati, copertura]);

  const isInitialLoading =
    (!!giornataId &&
      (sezioniQ.isLoading || risultatiQ.isLoading)) ||
    (!!elezioneId &&
      (listeQ.isLoading || candidatiLoading || votiLoading || preferenzeLoading));

  const hasSelection = !!giornataId && !!elezioneId;

  return (
    <ErrorBoundary>
      {isInitialLoading && !aggregati && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isInitialLoading && !hasSelection && (
        <EmptyState
          title="Nessuna elezione selezionata"
          description="Scegli una giornata ed elezione dal filtro."
        />
      )}

      {hasSelection && aggregati && copertura && (
        <div className="space-y-4">
          {/* Wrapper KPI: la card copertura apre il drill-down sezioni */}
          <div onClick={() => setDrill('sezioni')} role="button" tabIndex={0}
            className="cursor-pointer hover:opacity-95 transition-opacity"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDrill('sezioni');
              }
            }}
            aria-label="Apri dettaglio sezioni"
          >
            <KpiCards copertura={copertura} aggregati={aggregati} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClickableCard onClick={() => setDrill('liste')} label="Apri dettaglio voti per lista">
              <VotiListaChart data={aggregati.votiPerLista} />
            </ClickableCard>
            <ClickableCard onClick={() => setDrill('candidati')} label="Apri dettaglio candidati">
              <TopCandidatiChart
                data={aggregati.preferenzePerCandidato.slice(0, 10)}
              />
            </ClickableCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClickableCard onClick={() => setDrill('sezioni')} label="Apri dettaglio sezioni">
              <CoperturaCard copertura={copertura} />
            </ClickableCard>
            <ProiezioneCard proiezione={proiezione} />
          </div>
        </div>
      )}

      {drill === 'sezioni' && hasSelection && elezioneId && (
        <SezioniDrillDownModal
          open
          onClose={() => setDrill(null)}
          sezioni={sezioni}
          risultati={risultatiElezione}
          liste={liste}
          candidati={allCandidati}
          votiLista={allVotiLista}
          preferenze={allPreferenze}
        />
      )}

      {drill === 'liste' && hasSelection && aggregati && (
        <VotiListaDrillDownModal
          open
          onClose={() => setDrill(null)}
          aggregati={aggregati}
          liste={liste}
          candidati={allCandidati}
          sezioni={sezioni}
          risultati={risultatiElezione}
          votiLista={allVotiLista}
        />
      )}

      {drill === 'candidati' && hasSelection && aggregati && (
        <CandidatiDrillDownModal
          open
          onClose={() => setDrill(null)}
          aggregati={aggregati}
          liste={liste}
          candidati={allCandidati}
          sezioni={sezioni}
          risultati={risultatiElezione}
          preferenze={allPreferenze}
        />
      )}
    </ErrorBoundary>
  );
}

function ClickableCard({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer hover:scale-[1.005] transition-transform"
    >
      {children}
    </div>
  );
}
