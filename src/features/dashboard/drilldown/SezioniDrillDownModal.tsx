import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui';
import type {
  CandidatoRow,
  ListaRow,
  PreferenzaCandidatoRow,
  RisultatoSezioneRow,
  SezioneRow,
  VotoListaRow,
} from '@/lib/database.types';

const nf = new Intl.NumberFormat('it-IT');

interface Props {
  open: boolean;
  onClose: () => void;
  sezioni: SezioneRow[];
  risultati: RisultatoSezioneRow[];
  liste: ListaRow[];
  candidati: CandidatoRow[];
  votiLista: VotoListaRow[];
  preferenze: PreferenzaCandidatoRow[];
}

type RigaSezione = {
  sezione: SezioneRow;
  risultato: RisultatoSezioneRow | null;
  stato: 'verified' | 'submitted' | 'draft' | 'vuoto';
  schede: number;
  votiTot: number;
};

function statoLabel(s: RigaSezione['stato']): { text: string; cls: string } {
  switch (s) {
    case 'verified':
      return { text: '✓ verificata', cls: 'text-emerald-300' };
    case 'submitted':
      return { text: '✓ inviata', cls: 'text-cyan-300' };
    case 'draft':
      return { text: '~ bozza', cls: 'text-amber-300' };
    default:
      return { text: '◯ vuota', cls: 'text-slate-500' };
  }
}

export function SezioniDrillDownModal({
  open,
  onClose,
  sezioni,
  risultati,
  liste,
  candidati,
  votiLista,
  preferenze,
}: Props) {
  const [search, setSearch] = useState('');
  const [selSezione, setSelSezione] = useState<SezioneRow | null>(null);

  const righe = useMemo<RigaSezione[]>(() => {
    const risultatiBySez = new Map(risultati.map((r) => [r.sezione_id, r]));
    const votiBySez = new Map<string, number>();
    for (const v of votiLista) {
      const r = risultati.find((rr) => rr.id === v.risultato_sezione_id);
      if (!r) continue;
      votiBySez.set(r.sezione_id, (votiBySez.get(r.sezione_id) ?? 0) + v.voti);
    }
    return sezioni
      .map((s) => {
        const r = risultatiBySez.get(s.id) ?? null;
        const stato: RigaSezione['stato'] = !r
          ? 'vuoto'
          : r.stato === 'verified'
            ? 'verified'
            : r.stato === 'submitted'
              ? 'submitted'
              : 'draft';
        return {
          sezione: s,
          risultato: r,
          stato,
          schede: r?.schede_totali ?? 0,
          votiTot: votiBySez.get(s.id) ?? 0,
        };
      })
      .sort((a, b) => a.sezione.numero - b.sezione.numero);
  }, [sezioni, risultati, votiLista]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return righe;
    return righe.filter(
      (r) =>
        String(r.sezione.numero).includes(q) ||
        (r.sezione.ubicazione ?? '').toLowerCase().includes(q) ||
        (r.sezione.indirizzo ?? '').toLowerCase().includes(q),
    );
  }, [righe, search]);

  return (
    <Modal open={open} onClose={onClose} title="Sezioni" size="xl">
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per numero o indirizzo…"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm
                     focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
        />
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                <th className="text-left px-3 py-2 w-12">N.</th>
                <th className="text-left px-3 py-2">Ubicazione</th>
                <th className="text-left px-3 py-2">Stato</th>
                <th className="text-right px-3 py-2">Schede</th>
                <th className="text-right px-3 py-2">Voti tot.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    Nessuna sezione trovata.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const lbl = statoLabel(r.stato);
                  return (
                    <tr
                      key={r.sezione.id}
                      onClick={() => setSelSezione(r.sezione)}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {r.sezione.numero}
                      </td>
                      <td className="px-3 py-2 text-slate-200 truncate max-w-xs">
                        {r.sezione.ubicazione ?? r.sezione.indirizzo ?? '—'}
                      </td>
                      <td className={`px-3 py-2 ${lbl.cls}`}>{lbl.text}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {nf.format(r.schede)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neon-cyan">
                        {nf.format(r.votiTot)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500">
          {filtered.length} di {righe.length} sezioni · click su una riga per il dettaglio
        </div>
      </div>

      {selSezione && (
        <SezioneDettaglioModal
          sezione={selSezione}
          onClose={() => setSelSezione(null)}
          risultato={risultati.find((r) => r.sezione_id === selSezione.id) ?? null}
          liste={liste}
          candidati={candidati}
          votiLista={votiLista}
          preferenze={preferenze}
        />
      )}
    </Modal>
  );
}

interface DettaglioProps {
  sezione: SezioneRow;
  onClose: () => void;
  risultato: RisultatoSezioneRow | null;
  liste: ListaRow[];
  candidati: CandidatoRow[];
  votiLista: VotoListaRow[];
  preferenze: PreferenzaCandidatoRow[];
}

function SezioneDettaglioModal({
  sezione,
  onClose,
  risultato,
  liste,
  candidati,
  votiLista,
  preferenze,
}: DettaglioProps) {
  const votiPerLista = useMemo(() => {
    if (!risultato) return [];
    const map = new Map<string, number>();
    for (const v of votiLista) {
      if (v.risultato_sezione_id !== risultato.id) continue;
      map.set(v.lista_id, (map.get(v.lista_id) ?? 0) + v.voti);
    }
    return liste
      .map((l) => ({ lista: l, voti: map.get(l.id) ?? 0 }))
      .sort((a, b) => b.voti - a.voti);
  }, [risultato, liste, votiLista]);

  const preferenzePerCandidato = useMemo(() => {
    if (!risultato) return [];
    const map = new Map<string, number>();
    for (const p of preferenze) {
      if (p.risultato_sezione_id !== risultato.id) continue;
      map.set(p.candidato_id, (map.get(p.candidato_id) ?? 0) + p.voti);
    }
    return candidati
      .map((c) => ({ c, voti: map.get(c.id) ?? 0 }))
      .filter((x) => x.voti > 0)
      .sort((a, b) => b.voti - a.voti)
      .slice(0, 20);
  }, [risultato, candidati, preferenze]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sezione N. ${sezione.numero}`}
      size="lg"
    >
      <div className="space-y-4">
        {risultato ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="glass p-3 rounded-xl">
                <div className="text-xs text-slate-400">Totali</div>
                <div className="text-lg font-semibold">{nf.format(risultato.schede_totali ?? 0)}</div>
              </div>
              <div className="glass p-3 rounded-xl">
                <div className="text-xs text-slate-400">Bianche</div>
                <div className="text-lg font-semibold">{nf.format(risultato.schede_bianche ?? 0)}</div>
              </div>
              <div className="glass p-3 rounded-xl">
                <div className="text-xs text-slate-400">Nulle</div>
                <div className="text-lg font-semibold">{nf.format(risultato.schede_nulle ?? 0)}</div>
              </div>
              <div className="glass p-3 rounded-xl">
                <div className="text-xs text-slate-400">Contestate</div>
                <div className="text-lg font-semibold">{nf.format(risultato.schede_contestate ?? 0)}</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase text-slate-400 mb-2">Voti per lista</h4>
              <ul className="space-y-1 text-sm">
                {votiPerLista.map(({ lista, voti }) => (
                  <li
                    key={lista.id}
                    className="flex justify-between border-b border-white/5 pb-1 last:border-0"
                  >
                    <span className="text-slate-200 truncate pr-2">{lista.nome}</span>
                    <span className="font-mono text-neon-cyan">{nf.format(voti)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {preferenzePerCandidato.length > 0 && (
              <div>
                <h4 className="text-xs uppercase text-slate-400 mb-2">Top preferenze</h4>
                <ul className="space-y-1 text-sm">
                  {preferenzePerCandidato.map(({ c, voti }) => (
                    <li
                      key={c.id}
                      className="flex justify-between border-b border-white/5 pb-1 last:border-0"
                    >
                      <span className="text-slate-200 truncate pr-2">
                        {c.nome} {c.cognome}
                      </span>
                      <span className="font-mono text-neon-cyan">{nf.format(voti)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Nessun dato inserito per questa sezione.
          </p>
        )}
      </div>
    </Modal>
  );
}
