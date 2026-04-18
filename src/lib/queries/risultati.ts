import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type {
  RisultatoSezioneRow,
  RisultatoSezioneInsert,
  StatoRisultato,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'risultati';

/**
 * Fetch the single risultato_sezione row for a given (sezione, elezione) pair.
 * Returns `null` when no row exists yet (maybeSingle).
 */
export function useRisultatoPerSezioneElezione(
  sezioneId: string | undefined,
  elezioneId: string | undefined,
) {
  const enabled = !!sezioneId && !!elezioneId;
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [[KEY, sezioneId, elezioneId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, sezioneId, elezioneId],
    enabled,
    queryFn: async (): Promise<RisultatoSezioneRow | null> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('sezione_id', sezioneId as string)
        .eq('elezione_id', elezioneId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RisultatoSezioneRow | null;
    },
  });
}

/**
 * Fetch all risultati_sezione belonging to sezioni of a giornata, using a
 * PostgREST inner embed (`!inner`) to filter by the sezione's giornata_id.
 */
export function useRisultatiByGiornata(giornataId: string | undefined) {
  const enabled = !!giornataId;
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [[KEY, 'giornata', giornataId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, 'giornata', giornataId],
    enabled,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*, sezione:sezioni!inner(giornata_id)')
        .eq('sezione.giornata_id', giornataId as string);
      if (error) throw error;
      return (data ?? []) as unknown as RisultatoSezioneRow[];
    },
  });
}

/**
 * Upsert a risultato_sezione on the (sezione_id, elezione_id) unique key.
 * Invalidates both the broad list and the specific (sezione, elezione) key.
 */
export function useUpsertRisultato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RisultatoSezioneInsert): Promise<RisultatoSezioneRow> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .upsert(input, { onConflict: 'sezione_id,elezione_id' })
        .select()
        .single();
      if (error) throw error;
      return data as RisultatoSezioneRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, row.sezione_id, row.elezione_id] });
    },
  });
}

/**
 * Update only the `stato` field of a risultato_sezione by id.
 */
export function useUpdateRisultatoStato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      stato,
    }: {
      id: string;
      stato: StatoRisultato;
    }): Promise<RisultatoSezioneRow> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .update({ stato })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RisultatoSezioneRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
