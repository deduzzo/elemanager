import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { ProfileRow, ProfileUpdate, Ruolo } from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'profiles';

export function useProfiles() {
  useRealtimeTable({ table: 'profiles', invalidate: [[KEY]] });
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await db
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
}

export interface CreateUserInput {
  email: string;
  password: string;
  nome: string;
  ruolo: Ruolo;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput): Promise<{ id: string; email: string }> => {
      const { data: sessionData } = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessione non valida. Rieffettua il login.');

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${baseUrl}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify(input),
      });

      const payload = (await res.json().catch(() => null)) as
        | { id: string; email: string }
        | { error: string }
        | null;

      if (!res.ok) {
        const message =
          payload && 'error' in payload ? payload.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      return payload as { id: string; email: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProfileUpdate }) => {
      const { data, error } = await db
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProfileRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
