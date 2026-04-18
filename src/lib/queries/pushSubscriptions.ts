import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
};

const KEY = 'push-subscriptions';

// The push_subscriptions table is not present in Database types yet; use the
// untyped client surface via `from` cast to keep type inference local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = supabase as unknown as { from: (t: string) => any; auth: typeof supabase.auth };

export function useMyPushSubscriptions() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<PushSubscriptionRow[]> => {
      const { data, error } = await client.from('push_subscriptions').select('*');
      if (error) throw error;
      return (data ?? []) as PushSubscriptionRow[];
    },
  });
}

export function useCreatePushSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      user_agent?: string | null;
    }) => {
      const { data: userRes } = await client.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Utente non autenticato');
      const { data, error } = await client
        .from('push_subscriptions')
        .insert({ ...input, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      return data as PushSubscriptionRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeletePushSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('push_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
