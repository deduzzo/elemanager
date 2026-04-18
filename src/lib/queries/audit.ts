import { useQuery } from '@tanstack/react-query';
import { db } from './_db';
import type { AuditLogRow } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'audit';

export function useAuditLog({
  limit = 200,
  tabella,
}: {
  limit?: number;
  tabella?: string;
}) {
  useRealtimeTable({ table: 'audit_log', invalidate: [[KEY, { limit, tabella }]] });
  return useQuery({
    queryKey: [KEY, { limit, tabella }],
    queryFn: async (): Promise<AuditLogRow[]> => {
      let query = db
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (tabella !== undefined) {
        query = query.eq('tabella', tabella);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
  });
}
