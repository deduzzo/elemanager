import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import { supabase } from '@/lib/supabase';
import type {
  FotoSezioneRow,
  FotoSezioneInsert,
  FotoSezioneUpdate,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'foto';

export function useFotoBySezione(sezioneId: string | undefined, elezioneId?: string) {
  useRealtimeTable({
    table: 'foto_sezione',
    invalidate: [[KEY, sezioneId, elezioneId ?? null]],
    enabled: !!sezioneId,
  });
  return useQuery({
    queryKey: [KEY, sezioneId, elezioneId ?? null],
    enabled: !!sezioneId,
    queryFn: async (): Promise<FotoSezioneRow[]> => {
      let q = db
        .from('foto_sezione')
        .select('*')
        .eq('sezione_id', sezioneId as string)
        .order('created_at', { ascending: false });
      if (elezioneId) q = q.eq('elezione_id', elezioneId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FotoSezioneRow[];
    },
  });
}

export function useCreateFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FotoSezioneInsert & { uploaded_by: string }) => {
      const { data, error } = await db
        .from('foto_sezione')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as FotoSezioneRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.sezione_id] });
    },
  });
}

export function useUpdateFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: FotoSezioneUpdate }) => {
      const { data, error } = await db
        .from('foto_sezione')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as FotoSezioneRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.sezione_id] });
    },
  });
}

export function useDeleteFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Pick<FotoSezioneRow, 'id' | 'storage_path' | 'sezione_id'>) => {
      // delete DB row first (RLS check); then remove Storage file.
      const { error: dbErr } = await db.from('foto_sezione').delete().eq('id', row.id);
      if (dbErr) throw dbErr;
      const { error: sErr } = await supabase.storage.from('sezioni-photos').remove([row.storage_path]);
      if (sErr) {
        // file rimosso dalla DB ma Storage fallito: log e ignora (orphan file nel bucket).
        // eslint-disable-next-line no-console
        console.warn('Storage delete failed, DB row already deleted:', sErr);
      }
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.sezione_id] });
    },
  });
}

export function useSignedPhotoUrl(
  storagePath: string | null | undefined,
  expiresInSec = 3600,
) {
  return useQuery({
    queryKey: ['signed-url', storagePath, expiresInSec],
    enabled: !!storagePath,
    staleTime: (expiresInSec - 60) * 1000, // refetch before expiry
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('sezioni-photos')
        .createSignedUrl(storagePath as string, expiresInSec);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
