import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui';
import type { AggregatiElezione } from '@/lib/aggregates';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';

const nf = new Intl.NumberFormat('it-IT');

interface Props {
  open: boolean;
  onClose: () => void;
  aggregati: AggregatiElezione;
  liste: ListaRow[];
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  preferenze: PreferenzaCandidatoRow[];
}

export function CandidatiDrillDownModal({
  open,
  onClose,
  aggregati,
  liste,
  candidati,
  sezioni,
  risultati,
  preferenze,
}: Props) {
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<CandidatoRow | null>(null);

  const listaById = useMemo(
    () => new Map(liste.map((l) => [l.id, l])),
    [liste],
  );
  const candById = useMemo(
    () => new Map(candidati.map((c) => [c.id, c])),
    [candidati],
  );

  const righe = useMemo(() => {
    return aggregati.preferenzePerCandidato
      .map((p) => ({
        candidato: candById.get(p.candidato_id),
        lista: listaById.get(p.lista_id),
        voti: p.voti,
      }))
      .filter((x) => x.candidato && x.lista) as Array<{
      candidato: CandidatoRow;
      lista: ListaRow;
      voti: number;
    }>;
  }, [aggregati.preferenzePerCandidato, candById, listaById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return righe;
    return righe.filter(
      (r) =>
        r.candidato.nome.toLowerCase().includes(q) ||
        r.candidato.cognome.toLowerCase().includes(q) ||
        r.lista.nome.toLowerCase().includes(q),
    );
  }, [righe, search]);

  return (
    <Modal open={open} onClose={onClose} title="Tutti i candidati" size="xl">
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca candidato o lista…"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm
                     focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
        />
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2">Candidato</th>
                <th className="text-left px-3 py-2">Lista</th>
                <th className="text-right px-3 py-2">Voti</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-500">
                    Nessun candidato trovato.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr
                    key={r.candidato.id}
                    onClick={() => setSel(r.candidato)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-200">
                      {r.candidato.cognome} {r.candidato.nome}
                    </td>
                    <td className="px-3 py-2 text-slate-400 truncate">
                      {r.lista.nome}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-neon-cyan">
                      {nf.format(r.voti)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <CandidatoDettaglioModal
          candidato={sel}
          onClose={() => setSel(null)}
          lista={liste.find((l) => l.id === sel.lista_id) ?? null}
          sezioni={sezioni}
          risultati={risultati}
          preferenze={preferenze}
        />
      )}
    </Modal>
  );
}

interface DettaglioProps {
  candidato: CandidatoRow;
  onClose: () => void;
  lista: ListaRow | null;
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  preferenze: PreferenzaCandidatoRow[];
}

function CandidatoDettaglioModal({
  candidato,
  onClose,
  lista,
  sezioni,
  risultati,
  preferenze,
}: DettaglioProps) {
  const distribuzione = useMemo(() => {
    const sezById = new Map(sezioni.map((s) => [s.id, s]));
    const map = new Map<string, number>();
    for (const p of preferenze) {
      if (p.candidato_id !== candidato.id) continue;
      const r = risultati.find((rr) => rr.id === p.risultato_sezione_id);
      if (!r) continue;
      map.set(r.sezione_id, (map.get(r.sezione_id) ?? 0) + p.voti);
    }
    return Array.from(map.entries())
      .map(([sid, voti]) => ({ sezione: sezById.get(sid), voti }))
      .filter((x) => x.sezione)
      .sort((a, b) => b.voti - a.voti);
  }, [candidato.id, sezioni, risultati, preferenze]);

  const totale = distribuzione.reduce((acc, d) => acc + d.voti, 0);
  const maxVoti = Math.max(1, ...distribuzione.map((d) => d.voti));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${candidato.cognome} ${candidato.nome}`}
      size="lg"
    >
      <div className="space-y-3">
        <div className="text-sm text-slate-300">
          Lista: <span className="text-neon-cyan">{lista?.nome ?? '—'}</span>
          {' · '}
          Totale preferenze:{' '}
          <span className="font-mono text-neon-cyan">{nf.format(totale)}</span>
        </div>

        <div>
          <h4 className="text-xs uppercase text-slate-400 mb-2">
            Distribuzione per sezione
          </h4>
          {distribuzione.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessuna preferenza registrata.
            </p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-2">
              {distribuzione.map((d) => (
                <div key={d.sezione!.id} className="text-xs flex items-center gap-2">
                  <span className="w-12 font-mono text-slate-400 shrink-0">
                    N. {d.sezione!.numero}
                  </span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-neon"
                      style={{ width: `${(d.voti / maxVoti) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-neon-cyan">
                    {nf.format(d.voti)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
