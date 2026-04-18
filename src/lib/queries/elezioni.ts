import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { ElezioneRow, ElezioneInsert, ElezioneUpdate } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'elezioni';

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
