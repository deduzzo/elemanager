/**
 * Typed alias for the shared Supabase client scoped to schema 'elemanager'.
 *
 * createClient<Database> defaults SchemaName to 'public', but our Database
 * only exposes 'elemanager'. We cast the existing singleton here so query
 * hooks get proper Insert/Update/Row inference — no new client is created.
 *
 * The extended DB type adds the required Relationships field (empty array)
 * so each Table entry satisfies postgrest-js GenericTable constraints.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  Database,
  ProfileRow, ProfileInsert, ProfileUpdate,
  GiornataRow, GiornataInsert, GiornataUpdate,
  ElezioneRow, ElezioneInsert, ElezioneUpdate,
  ListaRow, ListaInsert, ListaUpdate,
  CandidatoRow, CandidatoInsert, CandidatoUpdate,
  SezioneRow, SezioneInsert, SezioneUpdate,
  RisultatoSezioneRow, RisultatoSezioneInsert, RisultatoSezioneUpdate,
  VotoListaRow, VotoListaInsert, VotoListaUpdate,
  PreferenzaCandidatoRow, PreferenzaCandidatoInsert, PreferenzaCandidatoUpdate,
  VotoPresuntoRow, VotoPresuntoInsert, VotoPresuntoUpdate,
  AuditLogRow,
  FotoSezioneRow, FotoSezioneInsert, FotoSezioneUpdate,
  LivePostRow, LivePostInsert, LivePostUpdate,
  LiveTypingRow, LiveTypingInsert,
} from '@/lib/database.types';

type WithRelationships<T extends { Row: object; Insert: object; Update: object }> = T & {
  Relationships: [];
};

/** Database type augmented with Relationships: [] on every table so that
 *  each entry satisfies postgrest-js GenericTable (which requires Relationships). */
type DatabaseWithRel = {
  elemanager: {
    Tables: {
      profiles: WithRelationships<{ Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate }>;
      giornate_elettorali: WithRelationships<{ Row: GiornataRow; Insert: GiornataInsert; Update: GiornataUpdate }>;
      elezioni: WithRelationships<{ Row: ElezioneRow; Insert: ElezioneInsert; Update: ElezioneUpdate }>;
      liste: WithRelationships<{ Row: ListaRow; Insert: ListaInsert; Update: ListaUpdate }>;
      candidati: WithRelationships<{ Row: CandidatoRow; Insert: CandidatoInsert; Update: CandidatoUpdate }>;
      sezioni: WithRelationships<{ Row: SezioneRow; Insert: SezioneInsert; Update: SezioneUpdate }>;
      risultati_sezione: WithRelationships<{ Row: RisultatoSezioneRow; Insert: RisultatoSezioneInsert; Update: RisultatoSezioneUpdate }>;
      voti_lista: WithRelationships<{ Row: VotoListaRow; Insert: VotoListaInsert; Update: VotoListaUpdate }>;
      preferenze_candidato: WithRelationships<{ Row: PreferenzaCandidatoRow; Insert: PreferenzaCandidatoInsert; Update: PreferenzaCandidatoUpdate }>;
      voti_presunti: WithRelationships<{ Row: VotoPresuntoRow; Insert: VotoPresuntoInsert; Update: VotoPresuntoUpdate }>;
      audit_log: WithRelationships<{ Row: AuditLogRow; Insert: Omit<AuditLogRow, 'id' | 'created_at'>; Update: Partial<Omit<AuditLogRow, 'id'>> }>;
      foto_sezione: WithRelationships<{ Row: FotoSezioneRow; Insert: FotoSezioneInsert; Update: FotoSezioneUpdate }>;
      live_post: WithRelationships<{ Row: LivePostRow; Insert: LivePostInsert; Update: LivePostUpdate }>;
      live_typing: WithRelationships<{ Row: LiveTypingRow; Insert: LiveTypingInsert; Update: Partial<LiveTypingInsert> }>;
    };
    Views: Database['elemanager']['Views'];
    Functions: Database['elemanager']['Functions'];
    Enums: Database['elemanager']['Enums'];
  };
};

export const db = supabase as unknown as SupabaseClient<DatabaseWithRel, 'elemanager'>;
