// TypeScript types per lo schema Supabase elemanager.
// Mantenuti a mano per Plan 01; in Plan 02+ si può rigenerare via `supabase gen types typescript`.

export type Ruolo = 'admin' | 'editor' | 'viewer';
export type StatoGiornata = 'draft' | 'open' | 'closed';
export type TipoElezione = 'sindaco' | 'consiglio' | 'circoscrizione' | 'nazionale' | 'referendum' | 'altro';
export type StatoRisultato = 'draft' | 'submitted' | 'verified';
export type AzioneAudit = 'INSERT' | 'UPDATE' | 'DELETE';

type Timestamped = { created_at: string };

export type ProfileRow = Timestamped & {
  id: string;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
};

export type GiornataRow = Timestamped & {
  id: string;
  nome: string;
  data: string;
  stato: StatoGiornata;
  comune: string | null;
};

export type ElezioneRow = Timestamped & {
  id: string;
  giornata_id: string;
  nome: string;
  tipo: TipoElezione;
  ordine: number;
};

export type ListaRow = Timestamped & {
  id: string;
  elezione_id: string;
  nome: string;
  simbolo_url: string | null;
  ordine: number;
};

export type CandidatoRow = Timestamped & {
  id: string;
  lista_id: string;
  nome: string;
  cognome: string;
  ordine: number;
  note: string | null;
};

export type SezioneRow = {
  id: string;
  giornata_id: string;
  numero: number;
  indirizzo: string | null;
  ubicazione: string | null;
  lat: number | null;
  lng: number | null;
  circoscrizione: number | null;
  note: string | null;
  accessibilita: string | null;
};

export type RisultatoSezioneRow = {
  id: string;
  sezione_id: string;
  elezione_id: string;
  schede_totali: number | null;
  schede_bianche: number | null;
  schede_nulle: number | null;
  schede_contestate: number | null;
  stato: StatoRisultato;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VotoListaRow = {
  id: string;
  risultato_sezione_id: string;
  lista_id: string;
  voti: number;
};

export type PreferenzaCandidatoRow = {
  id: string;
  risultato_sezione_id: string;
  candidato_id: string;
  voti: number;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  azione: AzioneAudit;
  tabella: string;
  record_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
};

type WithDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type ProfileInsert = WithDefaults<ProfileRow, 'attivo' | 'created_at'>;
export type ProfileUpdate = Partial<Omit<ProfileRow, 'id' | 'created_at'>>;

export type GiornataInsert = WithDefaults<GiornataRow, 'id' | 'stato' | 'comune' | 'created_at'>;
export type GiornataUpdate = Partial<Omit<GiornataRow, 'id' | 'created_at'>>;

export type ElezioneInsert = WithDefaults<ElezioneRow, 'id' | 'ordine' | 'created_at'>;
export type ElezioneUpdate = Partial<Omit<ElezioneRow, 'id' | 'created_at'>>;

export type ListaInsert = WithDefaults<ListaRow, 'id' | 'simbolo_url' | 'ordine' | 'created_at'>;
export type ListaUpdate = Partial<Omit<ListaRow, 'id' | 'created_at'>>;

export type CandidatoInsert = WithDefaults<CandidatoRow, 'id' | 'ordine' | 'note' | 'created_at'>;
export type CandidatoUpdate = Partial<Omit<CandidatoRow, 'id' | 'created_at'>>;

export type SezioneInsert = WithDefaults<
  SezioneRow,
  'id' | 'indirizzo' | 'ubicazione' | 'lat' | 'lng' | 'circoscrizione' | 'note' | 'accessibilita'
>;
export type SezioneUpdate = Partial<Omit<SezioneRow, 'id'>>;

export type RisultatoSezioneInsert = WithDefaults<
  RisultatoSezioneRow,
  | 'id'
  | 'schede_totali'
  | 'schede_bianche'
  | 'schede_nulle'
  | 'schede_contestate'
  | 'stato'
  | 'created_by'
  | 'updated_by'
  | 'created_at'
  | 'updated_at'
>;
export type RisultatoSezioneUpdate = Partial<Omit<RisultatoSezioneRow, 'id' | 'created_at'>>;

export type VotoListaInsert = WithDefaults<VotoListaRow, 'id' | 'voti'>;
export type VotoListaUpdate = Partial<Omit<VotoListaRow, 'id'>>;

export type PreferenzaCandidatoInsert = WithDefaults<PreferenzaCandidatoRow, 'id' | 'voti'>;
export type PreferenzaCandidatoUpdate = Partial<Omit<PreferenzaCandidatoRow, 'id'>>;

export type Database = {
  elemanager: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate };
      giornate_elettorali: { Row: GiornataRow; Insert: GiornataInsert; Update: GiornataUpdate };
      elezioni: { Row: ElezioneRow; Insert: ElezioneInsert; Update: ElezioneUpdate };
      liste: { Row: ListaRow; Insert: ListaInsert; Update: ListaUpdate };
      candidati: { Row: CandidatoRow; Insert: CandidatoInsert; Update: CandidatoUpdate };
      sezioni: { Row: SezioneRow; Insert: SezioneInsert; Update: SezioneUpdate };
      risultati_sezione: {
        Row: RisultatoSezioneRow;
        Insert: RisultatoSezioneInsert;
        Update: RisultatoSezioneUpdate;
      };
      voti_lista: { Row: VotoListaRow; Insert: VotoListaInsert; Update: VotoListaUpdate };
      preferenze_candidato: {
        Row: PreferenzaCandidatoRow;
        Insert: PreferenzaCandidatoInsert;
        Update: PreferenzaCandidatoUpdate;
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLogRow, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      giornata_is_open: { Args: { p_giornata_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
};
