import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type {
  PreferenzaCandidatoRow,
  PreferenzaCandidatoInsert,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'preferenze';

/**
 * List preferenze_candidato rows for a given risultato_sezione.
 */
export function usePreferenzeByRisultato(risultatoId: string | undefined) {
  const enabled = !!risultatoId;
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [[KEY, risultatoId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, risultatoId],
    enabled,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .eq('risultato_sezione_id', risultatoId as string);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

/**
 * Batch upsert of preferenze_candidato rows on unique
 * (risultato_sezione_id, candidato_id).
 */
export function useUpsertPreferenze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      risultatoId,
      rows,
    }: {
      risultatoId: string;
      rows: Array<{ candidato_id: string; voti: number }>;
    }): Promise<PreferenzaCandidatoRow[]> => {
      const payload: PreferenzaCandidatoInsert[] = rows.map((r) => ({
        risultato_sezione_id: risultatoId,
        candidato_id: r.candidato_id,
        voti: r.voti,
      }));
      const { data, error } = await db
        .from('preferenze_candidato')
        .upsert(payload, { onConflict: 'risultato_sezione_id,candidato_id' })
        .select();
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
    onSuccess: (_data, { risultatoId }) =>
      qc.invalidateQueries({ queryKey: [KEY, risultatoId] }),
  });
}
