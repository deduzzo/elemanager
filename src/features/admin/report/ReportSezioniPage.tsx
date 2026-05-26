import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PageHeader, Select, Skeleton, Button } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useRealtimeTable } from '@/lib/queries/useRealtimeTable';
import type {
  CandidatoRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  VotoListaRow,
} from '@/lib/database.types';
import { buildReportSezioni, type ReportSezioneRow } from './report';
import './print.css';

const nf = new Intl.NumberFormat('it-IT');

const statoLabel: Record<string, string> = {
  submitted: 'Inviata',
  verified: 'Verificata',
  draft: 'Bozza',
};

function useCandidatiByListe(listaIds: string[]) {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}

function useRisultatiByElezione(elezioneId: string | undefined) {
  useRealtimeTable({
    table: 'risultati_sezione',
    invalidate: [['risultati_by_elezione', elezioneId]],
    enabled: !!elezioneId,
  });
  return useQuery({
    queryKey: ['risultati_by_elezione', elezioneId],
    enabled: !!elezioneId,
    queryFn: async (): Promise<RisultatoSezioneRow[]> => {
      const { data, error } = await db
        .from('risultati_sezione')
        .select('*')
        .eq('elezione_id', elezioneId as string);
      if (error) throw error;
      return (data ?? []) as RisultatoSezioneRow[];
    },
  });
}

function useVotiListaByRs(rsIds: string[]) {
  const key = rsIds.join(',');
  useRealtimeTable({
    table: 'voti_lista',
    invalidate: [['voti_lista_by_rs', key]],
    enabled: rsIds.length > 0,
  });
  return useQuery({
    queryKey: ['voti_lista_by_rs', key],
    enabled: rsIds.length > 0,
    queryFn: async (): Promise<VotoListaRow[]> => {
      const { data, error } = await db
        .from('voti_lista')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as VotoListaRow[];
    },
  });
}

function usePreferenzeByRs(rsIds: string[]) {
  const key = rsIds.join(',');
  useRealtimeTable({
    table: 'preferenze_candidato',
    invalidate: [['preferenze_by_rs', key]],
    enabled: rsIds.length > 0,
  });
  return useQuery({
    queryKey: ['preferenze_by_rs', key],
    enabled: rsIds.length > 0,
    queryFn: async (): Promise<PreferenzaCandidatoRow[]> => {
      const { data, error } = await db
        .from('preferenze_candidato')
        .select('*')
        .in('risultato_sezione_id', rsIds);
      if (error) throw error;
      return (data ?? []) as PreferenzaCandidatoRow[];
    },
  });
}

function SezioneCard({ r }: { r: ReportSezioneRow }) {
  const luogo = r.ubicazione ?? r.indirizzo ?? '—';
  return (
    <div className="report-card glass rounded-2xl p-4 border border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-100">Sez. {r.numero}</span>
          <span className="text-sm text-slate-400">{luogo}</span>
        </div>
        {r.mancante ? (
          <span className="report-missing text-sm font-semibold text-neon-pink uppercase tracking-wide">
            Mancante
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            {statoLabel[r.stato ?? ''] ?? r.stato}
            {r.schedeTotali != null && ` · ${nf.format(r.schedeTotali)} schede`}
          </span>
        )}
      </div>

      {!r.mancante && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1 flex justify-between">
              <span>Voti di lista</span>
              <span className="font-mono">{nf.format(r.votiListaTot)}</span>
            </div>
            <ul className="space-y-0.5 text-sm">
              {r.votiLista.map((l) => (
                <li key={l.lista_id} className="flex justify-between gap-3">
                  <span className="text-slate-300 truncate">{l.nome}</span>
                  <span className="font-mono text-slate-100">{nf.format(l.voti)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              <span className="text-amber-300">★</span> Candidati preferiti
            </div>
            {r.preferiti.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun candidato preferito.</p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {r.preferiti.map((c) => (
                  <li key={c.candidato_id} className="flex justify-between gap-3">
                    <span className="text-slate-300 truncate">
                      {c.cognome} {c.nome}
                      {c.listaNome && (
                        <span className="text-slate-500"> · {c.listaNome}</span>
                      )}
                    </span>
                    <span className="font-mono text-slate-100">{nf.format(c.voti)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportSezioniPage() {
  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  const { data: sezioni = [], isLoading: ls } = useSezioniByGiornata(selectedGiornataId);
  const { data: liste = [] } = useListeByElezione(selectedElezioneId);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: risultati = [], isLoading: lr } = useRisultatiByElezione(
    selectedElezioneId || undefined,
  );
  const rsIds = useMemo(() => risultati.map((r) => r.id), [risultati]);
  const { data: votiLista = [], isLoading: lvl } = useVotiListaByRs(rsIds);
  const { data: preferenze = [], isLoading: lp } = usePreferenzeByRs(rsIds);

  const rows = useMemo(
    () =>
      buildReportSezioni({
        sezioni,
        liste,
        candidati,
        risultatiSezione: risultati,
        votiLista,
        preferenze,
      }),
    [sezioni, liste, candidati, risultati, votiLista, preferenze],
  );

  const inserite = rows.filter((r) => !r.mancante).length;
  const elezioneNome = elezioni.find((e) => e.id === selectedElezioneId)?.nome ?? '';
  const loading = ls || lr || (rsIds.length > 0 && (lvl || lp));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report sezioni"
        subtitle="Elenco di tutte le sezioni con voti di lista e preferenze dei candidati preferiti."
      />

      <div className="no-print flex flex-wrap items-end gap-3 glass p-3 rounded-2xl">
        <Select
          label="Giornata"
          value={selectedGiornataId}
          onChange={(e) => {
            setGiornataId(e.target.value);
            setElezioneId('');
          }}
        >
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-3">
          {selectedElezioneId && !loading && (
            <span className="text-sm text-slate-400">
              {inserite}/{rows.length} inserite
            </span>
          )}
          <Button
            type="button"
            onClick={() => window.print()}
            disabled={!selectedElezioneId || loading}
          >
            Stampa PDF
          </Button>
        </div>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona una giornata ed elezione per generare il report.
        </div>
      ) : loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div id="report-print" className="space-y-2">
          <div className="print-only mb-3">
            <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Report sezioni — {elezioneNome}</h1>
            <p style={{ fontSize: '11px' }}>
              {inserite}/{rows.length} sezioni inserite ·{' '}
              {new Date().toLocaleString('it-IT')}
            </p>
          </div>
          {rows.map((r) => (
            <SezioneCard key={r.sezione_id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
