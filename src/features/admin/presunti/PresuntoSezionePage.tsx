import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PageHeader, Select, Skeleton, useToast } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import {
  useVotiPresuntiBySezione,
  useUpsertVotoPresunto,
  useUpdateVotoPresunto,
  useDeleteVotoPresunto,
} from '@/lib/queries/votiPresunti';
import { CandidatoVotiRow } from './components/CandidatoVotiRow';
import type { CandidatoRow, SezioneRow } from '@/lib/database.types';

function useSezione(sezioneId: string | undefined) {
  return useQuery({
    queryKey: ['sezione', sezioneId],
    enabled: !!sezioneId,
    queryFn: async (): Promise<SezioneRow | null> => {
      const { data, error } = await db
        .from('sezioni')
        .select('*')
        .eq('id', sezioneId as string)
        .single();
      if (error) throw error;
      return data as SezioneRow;
    },
  });
}

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

export function PresuntoSezionePage() {
  const { sezioneId } = useParams<{ sezioneId: string }>();
  const { push } = useToast();

  const { data: sezione, isLoading: loadingSez } = useSezione(sezioneId);
  const { data: elezioni = [] } = useElezioniByGiornata(sezione?.giornata_id);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  const { data: liste = [] } = useListeByElezione(selectedElezioneId || undefined);
  const candidati = useCandidatiByListe(liste.map((l) => l.id));
  const { data: presunti = [] } = useVotiPresuntiBySezione(sezioneId, selectedElezioneId || undefined);

  const upsert = useUpsertVotoPresunto();
  const update = useUpdateVotoPresunto();
  const del = useDeleteVotoPresunto();

  const presuntiByCand = useMemo(() => {
    const m = new Map<string, { id: string; voti: number }>();
    for (const p of presunti) {
      if (!p.sezione_id) continue;
      m.set(p.candidato_id, { id: p.id, voti: p.voti });
    }
    return m;
  }, [presunti]);

  const commit = async (candidatoId: string, next: number | null) => {
    const existing = presuntiByCand.get(candidatoId);
    try {
      if (next === null) {
        if (existing) await del.mutateAsync(existing.id);
        return;
      }
      if (existing) {
        await update.mutateAsync({ id: existing.id, patch: { voti: next } });
      } else {
        await upsert.mutateAsync({
          candidato_id: candidatoId,
          sezione_id: sezioneId as string,
          voti: next,
          created_by: null,
          updated_by: null,
        });
      }
    } catch (e) {
      push(`Errore salvataggio: ${String(e)}`, { type: 'error' });
    }
  };

  const totaleVoti = Array.from(presuntiByCand.values()).reduce((a, b) => a + b.voti, 0);

  if (loadingSez || !sezione) return <Skeleton className="h-40" />;

  const candidatiByLista = new Map<string, CandidatoRow[]>();
  for (const c of candidati) {
    const arr = candidatiByLista.get(c.lista_id) ?? [];
    arr.push(c);
    candidatiByLista.set(c.lista_id, arr);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Sezione ${sezione.numero}`}
        subtitle={sezione.indirizzo ?? ''}
      />
      <Link to="/admin/presunti" className="text-sm text-neon-cyan hover:underline">
        ← Torna all'elenco
      </Link>

      <div className="glass p-3 rounded-2xl">
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
      </div>

      <div className="glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Candidati (autosave on blur)</h3>
          <span className="text-sm text-slate-300">
            Totale presunti sezione: <strong>{totaleVoti}</strong>
          </span>
        </div>

        {liste.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna lista per l'elezione selezionata.</p>
        ) : (
          liste.map((l) => (
            <div key={l.id} className="mb-4">
              <h4 className="text-sm font-semibold text-neon-cyan mb-2">{l.nome}</h4>
              {(candidatiByLista.get(l.id) ?? []).map((c) => (
                <CandidatoVotiRow
                  key={c.id}
                  cognome={c.cognome}
                  nome={c.nome}
                  listaNome={l.nome}
                  currentValue={presuntiByCand.get(c.id)?.voti ?? null}
                  onCommit={(n) => commit(c.id, n)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
