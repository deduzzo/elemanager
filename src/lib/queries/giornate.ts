import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { GiornataRow, GiornataInsert, GiornataUpdate } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'giornate';

export function useGiornate() {
  useRealtimeTable({ table: 'giornate_elettorali', invalidate: [[KEY]] });
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<GiornataRow[]> => {
      const { data, error } = await db
        .from('giornate_elettorali')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GiornataRow[];
    },
  });
}

export function useGiornata(id: string | undefined) {
  useRealtimeTable({ table: 'giornate_elettorali', invalidate: [[KEY]], enabled: !!id });
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<GiornataRow> => {
      const { data, error } = await db
        .from('giornate_elettorali')
        .select('*')
        .eq('id', id as string)
        .single();
      if (error) throw error;
      return data as GiornataRow;
    },
  });
}

export function useCreateGiornata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GiornataInsert) => {
      const { data, error } = await db
        .from('giornate_elettorali')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as GiornataRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateGiornata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: GiornataUpdate }) => {
      const { data, error } = await db
        .from('giornate_elettorali')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as GiornataRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteGiornata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('giornate_elettorali').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
