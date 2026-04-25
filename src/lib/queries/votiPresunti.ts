import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from './_db';
import type {
  VotoPresuntoRow,
  VotoPresuntoInsert,
  VotoPresuntoUpdate,
} from '@/lib/database.types';
import { useRealtimeTable } from './useRealtimeTable';

const KEY = 'voti_presunti';

/** Tutti i presunti per un'elezione (filtrati via candidato_id → lista → elezione). */
export function useVotiPresuntiByElezione(elezioneId: string | undefined) {
  const enabled = !!elezioneId;
  useRealtimeTable({ table: 'voti_presunti', invalidate: [[KEY, 'elezione', elezioneId]], enabled });
  return useQuery({
    queryKey: [KEY, 'elezione', elezioneId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      // 1) liste dell'elezione
      const { data: liste, error: eL } = await db
        .from('liste')
        .select('id')
        .eq('elezione_id', elezioneId as string);
      if (eL) throw eL;
      const listaIds = (liste ?? []).map((l) => l.id);
      if (listaIds.length === 0) return [];

      // 2) candidati delle liste
      const { data: candidati, error: eC } = await db
        .from('candidati')
        .select('id')
        .in('lista_id', listaIds);
      if (eC) throw eC;
      const candIds = (candidati ?? []).map((c) => c.id);
      if (candIds.length === 0) return [];

      // 3) presunti dei candidati
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .in('candidato_id', candIds);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Presunti di un singolo candidato (totale globale + per-sezione). */
export function useVotiPresuntiByCandidato(candidatoId: string | undefined) {
  const enabled = !!candidatoId;
  useRealtimeTable({ table: 'voti_presunti', invalidate: [[KEY, 'candidato', candidatoId]], enabled });
  return useQuery({
    queryKey: [KEY, 'candidato', candidatoId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .eq('candidato_id', candidatoId as string);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Presunti per una sezione (filtrati ai candidati dell'elezione specificata). */
export function useVotiPresuntiBySezione(
  sezioneId: string | undefined,
  elezioneId: string | undefined
) {
  const enabled = !!sezioneId && !!elezioneId;
  useRealtimeTable({
    table: 'voti_presunti',
    invalidate: [[KEY, 'sezione', sezioneId, elezioneId]],
    enabled,
  });
  return useQuery({
    queryKey: [KEY, 'sezione', sezioneId, elezioneId],
    enabled,
    queryFn: async (): Promise<VotoPresuntoRow[]> => {
      const { data: liste, error: eL } = await db
        .from('liste')
        .select('id')
        .eq('elezione_id', elezioneId as string);
      if (eL) throw eL;
      const listaIds = (liste ?? []).map((l) => l.id);
      if (listaIds.length === 0) return [];
      const { data: candidati, error: eC } = await db
        .from('candidati')
        .select('id')
        .in('lista_id', listaIds);
      if (eC) throw eC;
      const candIds = (candidati ?? []).map((c) => c.id);
      if (candIds.length === 0) return [];
      const { data, error } = await db
        .from('voti_presunti')
        .select('*')
        .eq('sezione_id', sezioneId as string)
        .in('candidato_id', candIds);
      if (error) throw error;
      return (data ?? []) as VotoPresuntoRow[];
    },
  });
}

/** Upsert usando l'indice unico parziale corretto (NULL → candidato_id, NOT NULL → coppia). */
export function useUpsertVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VotoPresuntoInsert): Promise<VotoPresuntoRow> => {
      if (input.sezione_id) {
        // Caso per-sezione: upsert sull'indice composite parziale.
        const { data, error } = await db
          .from('voti_presunti')
          .upsert(input, { onConflict: 'candidato_id,sezione_id', ignoreDuplicates: false })
          .select()
          .single();
        if (error) throw error;
        return data as VotoPresuntoRow;
      }
      // Caso totale globale (sezione_id IS NULL): SELECT esistente, poi INSERT o UPDATE.
      const { data: existing, error: eSel } = await db
        .from('voti_presunti')
        .select('id')
        .eq('candidato_id', input.candidato_id)
        .is('sezione_id', null)
        .maybeSingle();
      if (eSel) throw eSel;
      if (existing) {
        const { data, error } = await db
          .from('voti_presunti')
          .update({ voti: input.voti })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as VotoPresuntoRow;
      }
      const { data, error } = await db
        .from('voti_presunti')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as VotoPresuntoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: VotoPresuntoUpdate }) => {
      const { data, error } = await db
        .from('voti_presunti')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as VotoPresuntoRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteVotoPresunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('voti_presunti').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
