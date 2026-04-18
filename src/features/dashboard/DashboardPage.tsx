import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  EmptyState,
  ErrorBoundary,
  PageHeader,
  Select,
  SkeletonCard,
} from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
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

export function DashboardPage() {
  const [giornataId, setGiornataId] = useState<string | undefined>(undefined);
  const [elezioneId, setElezioneId] = useState<string | undefined>(undefined);

  const giornateQ = useGiornate();
  const giornate = giornateQ.data ?? [];

  // Default giornata: first non-closed, fallback first overall
  useEffect(() => {
    if (giornataId || giornate.length === 0) return;
    const open = giornate.find((g) => g.stato !== 'closed');
    setGiornataId((open ?? giornate[0]).id);
  }, [giornate, giornataId]);

  const elezioniQ = useElezioniByGiornata(giornataId);
  const elezioni = elezioniQ.data ?? [];

  // Default elezione: first; reset when changing giornata
  useEffect(() => {
    if (elezioni.length === 0) {
      setElezioneId(undefined);
      return;
    }
    if (!elezioneId || !elezioni.find((e) => e.id === elezioneId)) {
      setElezioneId(elezioni[0].id);
    }
  }, [elezioni, elezioneId]);

  const sezioniQ = useSezioniByGiornata(giornataId);
  const listeQ = useListeByElezione(elezioneId);
  const risultatiQ = useRisultatiByGiornata(giornataId);

  const sezioni = sezioniQ.data ?? [];
  const liste = listeQ.data ?? [];
  const risultatiAll = risultatiQ.data ?? [];

  // Restringi ai risultati dell'elezione selezionata (per i fetch di voti/preferenze)
  const risultatiElezione = useMemo(
    () => (elezioneId ? risultatiAll.filter((r) => r.elezione_id === elezioneId) : []),
    [risultatiAll, elezioneId]
  );

  // Per-lista candidati fetch (hooks-compliant via useQueries)
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
    [candidatiQueries]
  );
  const candidatiLoading = candidatiQueries.some((q) => q.isLoading);

  // Per-risultato voti + preferenze (hooks-compliant via useQueries)
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
    [votiListaQueries]
  );
  const allPreferenze = useMemo<PreferenzaCandidatoRow[]>(
    () => preferenzeQueries.flatMap((q) => q.data ?? []),
    [preferenzeQueries]
  );

  const votiLoading = votiListaQueries.some((q) => q.isLoading);
  const preferenzeLoading = preferenzeQueries.some((q) => q.isLoading);

  // Aggregati + proiezione
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
      elezioneId
    );
  }, [liste, allCandidati, risultatiAll, allVotiLista, allPreferenze, elezioneId]);

  const proiezione = useMemo(() => {
    if (!aggregati || !copertura) return null;
    return computeProiezione(aggregati, copertura);
  }, [aggregati, copertura]);

  const isInitialLoading =
    giornateQ.isLoading ||
    (!!giornataId && (elezioniQ.isLoading || sezioniQ.isLoading || risultatiQ.isLoading)) ||
    (!!elezioneId && (listeQ.isLoading || candidatiLoading || votiLoading || preferenzeLoading));

  const hasSelection = !!giornataId && !!elezioneId;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Aggregati realtime + proiezioni"
      />

      {/* Filter bar */}
      <div className="glass p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Giornata"
          value={giornataId ?? ''}
          onChange={(e) => setGiornataId(e.target.value || undefined)}
          disabled={giornateQ.isLoading || giornate.length === 0}
        >
          {giornate.length === 0 && <option value="">Nessuna giornata</option>}
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
              {g.comune ? ` · ${g.comune}` : ''}
              {g.stato === 'closed' ? ' · chiusa' : ''}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={elezioneId ?? ''}
          onChange={(e) => setElezioneId(e.target.value || undefined)}
          disabled={!giornataId || elezioniQ.isLoading || elezioni.length === 0}
        >
          {elezioni.length === 0 && <option value="">Nessuna elezione</option>}
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

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
            <KpiCards copertura={copertura} aggregati={aggregati} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VotiListaChart data={aggregati.votiPerLista} />
              <TopCandidatiChart
                data={aggregati.preferenzePerCandidato.slice(0, 10)}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CoperturaCard copertura={copertura} />
              <ProiezioneCard proiezione={proiezione} />
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
