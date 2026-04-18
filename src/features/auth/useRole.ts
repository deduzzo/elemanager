import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Ruolo } from '@/lib/database.types';
import { useAuth } from './useAuth';

export type RoleData = { ruolo: Ruolo; nome: string };

export function useRole() {
  const { user, loading } = useAuth();
  return useQuery<RoleData | null>({
    queryKey: ['profile', user?.id ?? null],
    enabled: !!user?.id && !loading,
    queryFn: async (): Promise<RoleData | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('ruolo, nome, attivo')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || !(data as { attivo: boolean }).attivo) return null;
      const row = data as { ruolo: string; nome: string; attivo: boolean };
      return { ruolo: row.ruolo as Ruolo, nome: row.nome };
    },
  });
}
