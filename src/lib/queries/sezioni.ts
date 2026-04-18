import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { SezioneRow, SezioneInsert, SezioneUpdate } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'sezioni';

/**
 * Postgres numeric(9,6) is serialized as string by PostgREST. Coerce lat/lng
 * (and circoscrizione int) at the query boundary so downstream TS code can
 * trust the declared types.
 */
function coerceSezione(r: SezioneRow): SezioneRow {
  return {
    ...r,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    circoscrizione: r.circoscrizione == null ? null : Number(r.circoscrizione),
  };
}

export function useSezioniByGiornata(giornataId: string | undefined) {
  useRealtimeTable({ table: 'sezioni', invalidate: [[KEY, giornataId]], enabled: !!giornataId });
  return useQuery({
    queryKey: [KEY, giornataId],
    enabled: !!giornataId,
    queryFn: async (): Promise<SezioneRow[]> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('giornata_id', giornataId as string)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => coerceSezione(r as SezioneRow));
    },
  });
}

export function useCreateSezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SezioneInsert) => {
      const { data, error } = await db
        .from('sezioni')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return coerceSezione(data as SezioneRow);
    },
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: [KEY, input.giornata_id] }),
  });
}

export function useUpdateSezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SezioneUpdate }) => {
      const { data, error } = await db
        .from('sezioni')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return coerceSezione(data as SezioneRow);
    },
    onSuccess: (_data) => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteSezione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('sezioni').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useBulkUpsertSezioni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      giornataId,
      rows,
    }: {
      giornataId: string;
      rows: SezioneInsert[];
    }): Promise<SezioneRow[]> => {
      const payload = rows.map((r) => ({ ...r, giornata_id: giornataId }));
      const { data, error } = await db
        .from('sezioni')
        .upsert(payload, { onConflict: 'giornata_id,numero' })
        .select();
      if (error) throw error;
      return (data ?? []).map((r) => coerceSezione(r as SezioneRow));
    },
    onSuccess: (_data, { giornataId }) =>
      qc.invalidateQueries({ queryKey: [KEY, giornataId] }),
  });
}

export function useDeleteSezioniByGiornata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (giornataId: string) => {
      const { error } = await db
        .from('sezioni')
        .delete()
        .eq('giornata_id', giornataId);
      if (error) throw error;
    },
    onSuccess: (_data, giornataId) =>
      qc.invalidateQueries({ queryKey: [KEY, giornataId] }),
  });
}
