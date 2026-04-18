import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { VotoListaRow, VotoListaInsert } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'voti-lista';

/**
 * List voti_lista rows for a given risultato_sezione.
 */
export function useVotiListaByRisultato(risultatoId: string | undefined) {
  const enabled = !!risultatoId;
  useRealtimeTable({
    table: 'voti_lista',
    invalidate: [[KEY, risultatoId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, risultatoId],
    enabled,
    queryFn: async (): Promise<VotoListaRow[]> => {
      const { data, error } = await db
        .from('voti_lista')
        .select('*')
        .eq('risultato_sezione_id', risultatoId as string);
      if (error) throw error;
      return (data ?? []) as VotoListaRow[];
    },
  });
}

/**
 * Batch upsert of voti_lista rows on unique (risultato_sezione_id, lista_id).
 * Each input row is prepended with `risultato_sezione_id: risultatoId`.
 */
export function useUpsertVotiLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      risultatoId,
      rows,
    }: {
      risultatoId: string;
      rows: Array<{ lista_id: string; voti: number }>;
    }): Promise<VotoListaRow[]> => {
      const payload: VotoListaInsert[] = rows.map((r) => ({
        risultato_sezione_id: risultatoId,
        lista_id: r.lista_id,
        voti: r.voti,
      }));
      const { data, error } = await db
        .from('voti_lista')
        .upsert(payload, { onConflict: 'risultato_sezione_id,lista_id' })
        .select();
      if (error) throw error;
      return (data ?? []) as VotoListaRow[];
    },
    onSuccess: (_data, { risultatoId }) =>
      qc.invalidateQueries({ queryKey: [KEY, risultatoId] }),
  });
}
