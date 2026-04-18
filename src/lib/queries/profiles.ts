import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type { ProfileRow, ProfileInsert, ProfileUpdate } from '@/lib/database.types';
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

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInsert) => {
      const { data, error } = await db
        .from('profiles')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ProfileRow;
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
