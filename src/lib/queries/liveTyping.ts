import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import { supabase } from '@/lib/supabase';
import type { LiveTypingRow } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'typing';

export function useTypingUsers(giornataId: string | undefined) {
  useRealtimeTable({
    table: 'live_typing',
    invalidate: [[KEY, giornataId]],
    enabled: !!giornataId,
  });
  return useQuery({
    queryKey: [KEY, giornataId],
    enabled: !!giornataId,
    // Consider cache fresh for only 2s so fresh filter stays meaningful
    staleTime: 2000,
    refetchInterval: 2000,
    queryFn: async (): Promise<LiveTypingRow[]> => {
      const { data, error } = await db
        .from('live_typing')
        .select('*')
        .eq('giornata_id', giornataId as string);
      if (error) throw error;
      return (data ?? []) as LiveTypingRow[];
    },
  });
}

export function useUpsertTyping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ giornataId, nome }: { giornataId: string; nome: string }) => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Utente non autenticato');
      const row = {
        giornata_id: giornataId,
        user_id: userId,
        nome,
        started_at: new Date().toISOString(),
      };
      const { error } = await db
        .from('live_typing')
        .upsert(row, { onConflict: 'giornata_id,user_id' });
      if (error) throw error;
      return row as LiveTypingRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.giornata_id] });
    },
  });
}

export function useClearTyping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (giornataId: string) => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) return { giornataId };
      const { error } = await db
        .from('live_typing')
        .delete()
        .eq('giornata_id', giornataId)
        .eq('user_id', userId);
      if (error) throw error;
      return { giornataId };
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [KEY, row.giornataId] });
    },
  });
}
