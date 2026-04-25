import { useQueries, useQuery } from '@tanstack/react-query';
import { db } from './_db';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

export interface ProiezioniBundle {
  liste: ListaRow[];
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
  preferenze: PreferenzaCandidatoRow[];
  isLoading: boolean;
}

export function useProiezioniData(
  giornataId: string | undefined,
  elezioneId: string | undefined,
): ProiezioniBundle {
  const enabled = !!giornataId && !!elezioneId;

  // Realtime invalidations
  useRealtimeTable({ table: 'risultati_sezione', invalidate: [['proiezioni', elezioneId, 'rs']], enabled });
  useRealtimeTable({ table: 'voti_lista', invalidate: [['proiezioni', elezioneId, 'vl']], enabled });
  useRealtimeTable({ table: 'preferenze_candidato', invalidate: [['proiezioni', elezioneId, 'pc']], enabled });
  useRealtimeTable({ table: 'sezioni', invalidate: [['proiezioni', giornataId, 'sez']], enabled });

  const sezioniQ = useQuery({
    queryKey: ['proiezioni', giornataId, 'sez'],
    enabled,
    queryFn: async (): Promise<SezioneRow[]> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('giornata_id', giornataId as string);
      if (error) throw error;
      return (data ?? []) as SezioneRow[];
    },
  });

  const listeQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'liste'],
    enabled,
    queryFn: async (): Promise<ListaRow[]> => {
      const { data, error } = await db
        .from('liste')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as ListaRow[];
    },
  });

  const liste = listeQ.data ?? [];
  const candidatiResults = useQueries({
    queries: liste.map((l) => ({
      queryKey: ['candidati', l.id],
      enabled: !!l.id,
      queryFn: async () => {
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
  const candidati = candidatiResults.flatMap((r) => (r.data ?? []) as CandidatoRow[]);

  const risultatiQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'rs'],
    enabled,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });

  const rsIds = (risultatiQ.data ?? []).map((r) => r.id);

  const votiQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'vl', rsIds.join(',')],
    enabled: enabled && rsIds.length > 0,
    queryFn: async (): Promise<VotoListaRow[]> => {
      const { data, error } = await db
        .from('voti_lista')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as VotoListaRow[];
    },
  });

  const prefQ = useQuery({
    queryKey: ['proiezioni', elezioneId, 'pc', rsIds.join(',')],
    enabled: enabled && rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });

  return {
    liste,
    candidati,
    sezioni: sezioniQ.data ?? [],
    risultati: risultatiQ.data ?? [],
    votiLista: votiQ.data ?? [],
    preferenze: prefQ.data ?? [],
    isLoading:
      sezioniQ.isLoading ||
      listeQ.isLoading ||
      candidatiResults.some((r) => r.isLoading) ||
      risultatiQ.isLoading ||
      votiQ.isLoading ||
      prefQ.isLoading,
  };
}
