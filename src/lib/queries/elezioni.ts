import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type {
  ElezioneRow,
  ElezioneInsert,
  ElezioneUpdate,
  GiornataRow,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'elezioni';

export type ElezionePubblicaConGiornata = ElezioneRow & {
  giornata: Pick<GiornataRow, 'id' | 'nome' | 'comune' | 'data' | 'stato'>;
};

export function useElezioniByGiornata(giornataId: string | undefined) {
  useRealtimeTable({ table: 'elezioni', invalidate: [[KEY, giornataId]], enabled: !!giornataId });
  return useQuery({
    queryKey: [KEY, giornataId],
    enabled: !!giornataId,
    queryFn: async (): Promise<ElezioneRow[]> => {
      const { data, error } = await db
        .from('elezioni')
        .select('*')
        .eq('giornata_id', giornataId as string)
        .order('ordine', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ElezioneRow[];
    },
  });
}

export function useCreateElezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ElezioneInsert) => {
      const { data, error } = await db
        .from('elezioni')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ElezioneRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateElezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ElezioneUpdate }) => {
      const { data, error } = await db
        .from('elezioni')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ElezioneRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteElezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('elezioni').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Elezioni con pubblica=true e dati giornata (nome/comune/data/stato).
 * Usata dalla home pubblica accessibile senza login.
 */
export function useElezioniPubbliche() {
  useRealtimeTable({ table: 'elezioni', invalidate: [[KEY, 'pubbliche']] });
  return useQuery({
    queryKey: [KEY, 'pubbliche'],
    queryFn: async (): Promise<ElezionePubblicaConGiornata[]> => {
      const { data, error } = await db
        .from('elezioni')
        .select(
          '*, giornata:giornate_elettorali!inner(id, nome, comune, data, stato)',
        )
        .eq('pubblica', true)
        .order('ordine', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ElezionePubblicaConGiornata[];
    },
  });
}

/** Singola elezione con dati giornata, filtrata per id. Pubblica o privata, RLS decide. */
export function useElezioneConGiornata(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'elezioni',
    invalidate: [[KEY, 'singola', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: [KEY, 'singola', elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<ElezionePubblicaConGiornata | null> => {
      const { data, error } = await db
        .from('elezioni')
        .select(
          '*, giornata:giornate_elettorali!inner(id, nome, comune, data, stato)',
        )
        .eq('id', elezioneId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ElezionePubblicaConGiornata | null;
    },
  });
}
