import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui';
import type {
  AggregatiElezione,
} from '@/lib/aggregates';
import type {
  CandidatoRow,
  ListaRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from '@/lib/database.types';

const nf = new Intl.NumberFormat('it-IT');
const pf = (pct: number) => `${(pct * 100).toFixed(1)}%`;

interface Props {
  open: boolean;
  onClose: () => void;
  aggregati: AggregatiElezione;
  liste: ListaRow[];
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
}

type RigaLista = {
  lista: ListaRow;
  voti: number;
  pct: number;
  sezioniInviate: number;
};

export function VotiListaDrillDownModal({
  open,
  onClose,
  aggregati,
  liste,
  candidati,
  sezioni,
  risultati,
  votiLista,
}: Props) {
  const [selLista, setSelLista] = useState<ListaRow | null>(null);

  const totVoti = useMemo(
    () => aggregati.votiPerLista.reduce((acc, v) => acc + v.voti, 0),
    [aggregati.votiPerLista],
  );

  const righe = useMemo<RigaLista[]>(() => {
    const aggMap = new Map(aggregati.votiPerLista.map((v) => [v.lista_id, v]));
    const sezPerLista = new Map<string, Set<string>>();
    for (const v of votiLista) {
      if (v.voti <= 0) continue;
      const r = risultati.find((rr) => rr.id === v.risultato_sezione_id);
      if (!r) continue;
      let s = sezPerLista.get(v.lista_id);
      if (!s) {
        s = new Set();
        sezPerLista.set(v.lista_id, s);
      }
      s.add(r.sezione_id);
    }
    return liste
      .map((l) => {
        const agg = aggMap.get(l.id);
        return {
          lista: l,
          voti: agg?.voti ?? 0,
          pct: totVoti > 0 ? (agg?.voti ?? 0) / totVoti : 0,
          sezioniInviate: sezPerLista.get(l.id)?.size ?? 0,
        };
      })
      .sort((a, b) => b.voti - a.voti);
  }, [aggregati.votiPerLista, liste, risultati, votiLista, totVoti]);

  return (
    <Modal open={open} onClose={onClose} title="Voti per lista" size="xl">
      <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 text-xs uppercase text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Lista</th>
              <th className="text-right px-3 py-2">Voti</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-right px-3 py-2">Sezioni</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr
                key={r.lista.id}
                onClick={() => setSelLista(r.lista)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
              >
                <td className="px-3 py-2 text-slate-200">{r.lista.nome}</td>
                <td className="px-3 py-2 text-right font-mono text-neon-cyan">
                  {nf.format(r.voti)}
                </td>
                <td className="px-3 py-2 text-right text-slate-300">{pf(r.pct)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-300">
                  {r.sezioniInviate} / {sezioni.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selLista && (
        <ListaDettaglioModal
          lista={selLista}
          onClose={() => setSelLista(null)}
          candidati={candidati.filter((c) => c.lista_id === selLista.id)}
          sezioni={sezioni}
          risultati={risultati}
          votiLista={votiLista}
        />
      )}
    </Modal>
  );
}

interface DettaglioProps {
  lista: ListaRow;
  onClose: () => void;
  candidati: CandidatoRow[];
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  votiLista: VotoListaRow[];
}

function ListaDettaglioModal({
  lista,
  onClose,
  candidati,
  sezioni,
  risultati,
  votiLista,
}: DettaglioProps) {
  // Distribuzione voti per sezione
  const distribuzione = useMemo(() => {
    const sezById = new Map(sezioni.map((s) => [s.id, s]));
    const map = new Map<string, number>();
    for (const v of votiLista) {
      if (v.lista_id !== lista.id) continue;
      const r = risultati.find((rr) => rr.id === v.risultato_sezione_id);
      if (!r) continue;
      map.set(r.sezione_id, (map.get(r.sezione_id) ?? 0) + v.voti);
    }
    return Array.from(map.entries())
      .map(([sid, voti]) => ({
        sezione: sezById.get(sid),
        voti,
      }))
      .filter((x) => x.sezione)
      .sort((a, b) => b.voti - a.voti);
  }, [lista.id, sezioni, risultati, votiLista]);

  const maxVoti = Math.max(1, ...distribuzione.map((d) => d.voti));
  const totale = distribuzione.reduce((acc, d) => acc + d.voti, 0);

  return (
    <Modal open onClose={onClose} title={`Lista: ${lista.nome}`} size="lg">
      <div className="space-y-4">
        <div className="text-sm text-slate-300">
          Totale voti: <span className="font-mono text-neon-cyan">{nf.format(totale)}</span>
          {' · '}
          Candidati: <span className="font-mono">{candidati.length}</span>
        </div>

        <div>
          <h4 className="text-xs uppercase text-slate-400 mb-2">
            Distribuzione voti per sezione
          </h4>
          {distribuzione.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessun voto registrato per questa lista.
            </p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
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

        <div>
          <h4 className="text-xs uppercase text-slate-400 mb-2">
            Candidati ({candidati.length})
          </h4>
          {candidati.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun candidato.</p>
          ) : (
            <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1">
              {candidati
                .sort((a, b) => a.ordine - b.ordine)
                .map((c) => (
                  <li key={c.id} className="text-slate-200 truncate">
                    {c.cognome} {c.nome}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
