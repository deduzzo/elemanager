import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { ListaRow, ListaInsert, ListaUpdate } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'liste';

export function useListeByElezione(elezioneId: string | undefined) {
  useRealtimeTable({ table: 'liste', invalidate: [[KEY, elezioneId]], enabled: !!elezioneId });
  return useQuery({
    queryKey: [KEY, elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<ListaRow[]> => {
      const { data, error } = await db
        .from('liste')
        .select('*')
        .eq('elezione_id', elezioneId as string)
        .order('ordine', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ListaRow[];
    },
  });
}

export function useCreateLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ListaInsert) => {
      const { data, error } = await db
        .from('liste')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ListaRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ListaUpdate }) => {
      const { data, error } = await db
        .from('liste')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ListaRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('liste').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
