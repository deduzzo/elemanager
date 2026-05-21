import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { CandidatoRow, CandidatoInsert, CandidatoUpdate } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'candidati';

export function useCandidatiByLista(listaId: string | undefined) {
  useRealtimeTable({ table: 'candidati', invalidate: [[KEY, listaId]], enabled: !!listaId });
  return useQuery({
    queryKey: [KEY, listaId],
    enabled: !!listaId,
    queryFn: async (): Promise<CandidatoRow[]> => {
      const { data, error } = await db
        .from('candidati')
        .select('*')
        .eq('lista_id', listaId as string)
        .order('ordine', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CandidatoRow[];
    },
  });
}

export function useCreateCandidato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CandidatoInsert) => {
      const { data, error } = await db
        .from('candidati')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as CandidatoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCandidato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CandidatoUpdate }) => {
      const { data, error } = await db
        .from('candidati')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CandidatoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCandidato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('candidati').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Admin-only: toggle del flag `preferito` su un candidato.
 * La RLS già blocca i non-admin. Ritorna la riga aggiornata.
 */
export function useTogglePreferitoCandidato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      preferito: boolean;
    }): Promise<CandidatoRow> => {
      const { data, error } = await db
        .from('candidati')
        .update({ preferito: input.preferito })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as CandidatoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
