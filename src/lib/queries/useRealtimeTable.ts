import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type Opts = {
  /** Table name in elemanager schema */
  table: string;
  /** Array of query keys to invalidate on any change */
  invalidate: unknown[][];
  /** Whether to enable this subscription */
  enabled?: boolean;
};

/**
 * Subscribe to postgres_changes on a table and invalidate TanStack Query keys on any event.
 * Uses schema 'elemanager'. RLS applies: the client will only receive events it's authorized to see.
 */
export function useRealtimeTable({ table, invalidate, enabled = true }: Opts) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`rt:elemanager:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'elemanager', table },
        () => {
          invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, enabled, qc, JSON.stringify(invalidate)]);
}
