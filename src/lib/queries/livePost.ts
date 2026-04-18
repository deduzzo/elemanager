import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import { supabase } from '@/lib/supabase';
import type {
  LivePostRow,
  LivePostInsert,
  LivePostKind,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'live-post';

export function useLivePosts(
  giornataId: string | undefined,
  options?: { includeModerated?: boolean; limit?: number },
) {
  const limit = options?.limit ?? 200;
  const includeModerated = options?.includeModerated ?? false;
  useRealtimeTable({
    table: 'live_post',
    invalidate: [[KEY, giornataId, limit, includeModerated]],
    enabled: !!giornataId,
  });
  return useQuery({
    queryKey: [KEY, giornataId, limit, includeModerated],
    enabled: !!giornataId,
    queryFn: async (): Promise<LivePostRow[]> => {
      let q = db
        .from('live_post')
        .select('*')
        .eq('giornata_id', giornataId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!includeModerated) {
        q = q.eq('moderated', false);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LivePostRow[];
    },
  });
}

export type CreateUserPostInput = {
  giornataId: string;
  kind: Extract<LivePostKind, 'user_text' | 'user_audio' | 'user_photo'>;
  content?: string | null;
  media_path?: string | null;
  media_mime?: string | null;
  media_duration?: number | null;
  author_id: string;
  author_nome: string;
};

export function useCreateUserPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserPostInput) => {
      const insert: LivePostInsert = {
        giornata_id: input.giornataId,
        kind: input.kind,
        author_id: input.author_id,
        author_nome: input.author_nome,
        content: input.content ?? null,
        media_path: input.media_path ?? null,
        media_mime: input.media_mime ?? null,
        media_duration: input.media_duration ?? null,
      };
      const { data, error } = await db
        .from('live_post')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as LivePostRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.giornata_id] });
    },
  });
}

export function useToggleModeration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, moderated }: { id: string; moderated: boolean }) => {
      const { data, error } = await db
        .from('live_post')
        .update({ moderated })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LivePostRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.giornata_id] });
    },
  });
}

export function useDeleteLivePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Pick<LivePostRow, 'id' | 'media_path' | 'giornata_id'>) => {
      const { error: dbErr } = await db.from('live_post').delete().eq('id', row.id);
      if (dbErr) throw dbErr;
      if (row.media_path) {
        const { error: sErr } = await supabase.storage
          .from('live-media')
          .remove([row.media_path]);
        if (sErr) {
          // eslint-disable-next-line no-console
          console.warn('Storage delete failed, DB row already deleted:', sErr);
        }
      }
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.giornata_id] });
    },
  });
}

/**
 * Generate a signed URL for a media file in the 'live-media' bucket.
 * Used by LiveUserBubble and AudioPlayer.
 */
export function useLiveMediaUrl(path: string | null | undefined, expiresInSec = 3600) {
  return useQuery({
    queryKey: ['live-media-url', path, expiresInSec],
    enabled: !!path,
    staleTime: (expiresInSec - 60) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('live-media')
        .createSignedUrl(path as string, expiresInSec);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
