import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useVotiPresuntiByElezione } from '@/lib/queries/votiPresunti';
import { db } from '@/lib/queries/_db';
import type { CandidatoRow } from '@/lib/database.types';

type Tab = 'candidato' | 'sezione';

export function PresuntiIndexPage() {
  const [tab, setTab] = useState<Tab>('candidato');

  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voti presunti"
        subtitle="Stime di campagna per candidato, opzionalmente per sezione."
      />

      <div className="flex flex-wrap gap-3 glass p-3 rounded-2xl">
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
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'candidato' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('candidato')}
        >
          Per candidato
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'sezione' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('sezione')}
        >
          Per sezione
        </button>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona una giornata ed elezione per vedere l'elenco.
        </div>
      ) : tab === 'candidato' ? (
        <PerCandidatoTable elezioneId={selectedElezioneId} />
      ) : (
        <PerSezioneTable
          giornataId={selectedGiornataId}
          elezioneId={selectedElezioneId}
        />
      )}
    </div>
  );
}

function PerCandidatoTable({ elezioneId }: { elezioneId: string }) {
  const { data: liste = [] } = useListeByElezione(elezioneId);
  const { data: presunti = [], isLoading } = useVotiPresuntiByElezione(elezioneId);

  const candidatiAll = useAllCandidatiByListe(liste.map((l) => l.id));

  const rows = useMemo(() => {
    const totali = new Map<string, number>();
    const perSezione = new Map<string, number>();
    for (const p of presunti) {
      if (p.sezione_id === null) totali.set(p.candidato_id, p.voti);
      else perSezione.set(p.candidato_id, (perSezione.get(p.candidato_id) ?? 0) + 1);
    }
    return candidatiAll.map((c) => {
      const lista = liste.find((l) => l.id === c.lista_id);
      return {
        ...c,
        listaNome: lista?.nome ?? '',
        totale: totali.has(c.id) ? totali.get(c.id)! : null,
        numStime: perSezione.get(c.id) ?? 0,
      };
    });
  }, [candidatiAll, liste, presunti]);

  if (isLoading) return <Skeleton className="h-40" />;
  if (rows.length === 0)
    return <div className="glass p-6 rounded-2xl text-slate-300">Nessun candidato.</div>;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Candidato</th>
            <th className="px-4 py-2">Lista</th>
            <th className="px-4 py-2 text-right">Totale presunto</th>
            <th className="px-4 py-2 text-right"># stime sezione</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-4 py-2">
                {r.cognome} {r.nome}
              </td>
              <td className="px-4 py-2 text-slate-300">{r.listaNome}</td>
              <td className="px-4 py-2 text-right">
                {r.totale === null ? <span className="text-slate-500">—</span> : r.totale}
              </td>
              <td className="px-4 py-2 text-right">{r.numStime}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  to={`/admin/presunti/candidato/${r.id}`}
                  className="text-neon-cyan hover:underline"
                >
                  Modifica →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerSezioneTable({
  giornataId,
  elezioneId,
}: {
  giornataId: string;
  elezioneId: string;
}) {
  const { data: sezioni = [], isLoading } = useSezioniByGiornata(giornataId);
  const { data: presunti = [] } = useVotiPresuntiByElezione(elezioneId);

  const rows = useMemo(() => {
    const countBySez = new Map<string, number>();
    const sumBySez = new Map<string, number>();
    for (const p of presunti) {
      if (!p.sezione_id) continue;
      countBySez.set(p.sezione_id, (countBySez.get(p.sezione_id) ?? 0) + 1);
      sumBySez.set(p.sezione_id, (sumBySez.get(p.sezione_id) ?? 0) + p.voti);
    }
    return [...sezioni]
      .sort((a, b) => a.numero - b.numero)
      .map((s) => ({
        ...s,
        numCandStimati: countBySez.get(s.id) ?? 0,
        totale: sumBySez.get(s.id) ?? 0,
      }));
  }, [sezioni, presunti]);

  if (isLoading) return <Skeleton className="h-40" />;
  if (rows.length === 0)
    return <div className="glass p-6 rounded-2xl text-slate-300">Nessuna sezione.</div>;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-4 py-2">Sezione</th>
            <th className="px-4 py-2">Indirizzo</th>
            <th className="px-4 py-2 text-right"># candidati con stima</th>
            <th className="px-4 py-2 text-right">Totale voti presunti</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-4 py-2">Sez. {r.numero}</td>
              <td className="px-4 py-2 text-slate-300">{r.indirizzo ?? '—'}</td>
              <td className="px-4 py-2 text-right">{r.numCandStimati}</td>
              <td className="px-4 py-2 text-right">{r.totale}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  to={`/admin/presunti/sezione/${r.id}`}
                  className="text-neon-cyan hover:underline"
                >
                  Modifica →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useAllCandidatiByListe(listaIds: string[]): CandidatoRow[] {
  const results = useQueries({
    queries: listaIds.map((id) => ({
      queryKey: ['candidati', id],
      queryFn: async () => {
        const { data, error } = await db
          .from('candidati')
          .select('*')
          .eq('lista_id', id)
          .order('ordine', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CandidatoRow[];
      },
      enabled: !!id,
    })),
  });
  return results.flatMap((r) => (r.data ?? []) as CandidatoRow[]);
}
