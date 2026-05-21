import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfirmDialog, Input, Modal, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';
import {
  useRisultatoPerSezioneElezione,
  useUpsertRisultato,
  useResetVotiEffettiviSezioneElezione,
} from '@/lib/queries/risultati';
import { useListeByElezione } from '@/lib/queries/liste';
import { useCandidatiByLista } from '@/lib/queries/candidati';
import {
  useVotiListaByRisultato,
  useUpsertVotiLista,
} from '@/lib/queries/votiLista';
import {
  usePreferenzeByRisultato,
  useUpsertPreferenze,
} from '@/lib/queries/preferenze';
import type {
  CandidatoRow,
  ElezioneRow,
  ListaRow,
  SezioneRow,
} from '@/lib/database.types';
import { clearAutosave, readAutosave, useAutosave } from './useAutosave';
import { PhotoGallery } from '@/components/photos/PhotoGallery';

type Totali = {
  schede_totali: number | null;
  schede_bianche: number | null;
  schede_nulle: number | null;
  schede_contestate: number | null;
};

type FormState = {
  totali: Totali;
  votiPerLista: Record<string, number>;
  preferenzePerCandidato: Record<string, number>;
  expandedListe: Record<string, boolean>;
};

const emptyTotali: Totali = {
  schede_totali: null,
  schede_bianche: null,
  schede_nulle: null,
  schede_contestate: null,
};

function emptyState(): FormState {
  return {
    totali: { ...emptyTotali },
    votiPerLista: {},
    preferenzePerCandidato: {},
    expandedListe: {},
  };
}

function parseIntOrNull(v: string): number | null {
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseIntOrZero(v: string): number {
  if (v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

interface ListaCardProps {
  lista: ListaRow;
  votiLista: number;
  preferenzePerCandidato: Record<string, number>;
  expanded: boolean;
  onToggle: () => void;
  onChangeVoti: (v: number) => void;
  onChangePreferenza: (candidatoId: string, v: number) => void;
}

function ListaCard({
  lista,
  votiLista,
  preferenzePerCandidato,
  expanded,
  onToggle,
  onChangeVoti,
  onChangePreferenza,
}: ListaCardProps) {
  const { data: candidati } = useCandidatiByLista(lista.id);

  const sumPreferenze = useMemo(() => {
    if (!candidati) return 0;
    return candidati.reduce(
      (acc: number, c: CandidatoRow) => acc + (preferenzePerCandidato[c.id] ?? 0),
      0,
    );
  }, [candidati, preferenzePerCandidato]);

  const warn = votiLista > 0 && sumPreferenze > votiLista;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-slate-300 hover:text-neon-cyan transition-colors text-lg w-6 shrink-0"
          title={expanded ? 'Comprimi' : 'Espandi'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-medium truncate">{lista.nome}</p>
        </div>
        <div className="w-32 shrink-0">
          <Input
            label="Voti lista"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={votiLista === 0 && !expanded ? '' : String(votiLista)}
            onChange={(e) => onChangeVoti(parseIntOrZero(e.target.value))}
          />
        </div>
      </div>

      {warn && (
        <p className="text-xs text-neon-pink mt-2">
          Preferenze superano voti lista ({sumPreferenze} &gt; {votiLista})
        </p>
      )}

      {expanded && (
        <div className="mt-4 space-y-2">
          {!candidati && (
            <p className="text-sm text-slate-400">Caricamento candidati…</p>
          )}
          {candidati && candidati.length === 0 && (
            <p className="text-sm text-slate-500 italic">Nessun candidato.</p>
          )}
          {candidati &&
            candidati.map((c: CandidatoRow) => (
              <div
                key={c.id}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-2"
              >
                <div className="flex-1 min-w-0 text-sm text-slate-200 truncate">
                  {c.nome} {c.cognome}
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    label="Voti"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    value={String(preferenzePerCandidato[c.id] ?? 0)}
                    onChange={(e) =>
                      onChangePreferenza(c.id, parseIntOrZero(e.target.value))
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  sezione: SezioneRow;
  elezione: ElezioneRow;
}

export function ElezioneVoteTab({ sezione, elezione }: Props) {
  const { user } = useAuth();
  const { data: profile } = useRole();
  const isAdmin = profile?.ruolo === 'admin';
  const { push: toast } = useToast();

  const autosaveKey = `${sezione.id}-${elezione.id}`;

  const { data: risultato } = useRisultatoPerSezioneElezione(
    sezione.id,
    elezione.id,
  );
  const { data: liste } = useListeByElezione(elezione.id);
  const { data: votiLista } = useVotiListaByRisultato(risultato?.id);
  const { data: preferenzeAll } = usePreferenzeByRisultato(risultato?.id);

  const upsertRisultato = useUpsertRisultato();
  const upsertVotiLista = useUpsertVotiLista();
  const upsertPreferenze = useUpsertPreferenze();
  const resetEffettivi = useResetVotiEffettiviSezioneElezione();

  const [state, setState] = useState<FormState>(() => emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const restorePayloadRef = useRef<FormState | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Hydrate from server once loaded (and not dirty).
  useEffect(() => {
    if (hydrated || dirty) return;
    // Wait until liste is available so we can seed voti map keys.
    if (!liste) return;

    const serverVotiMap: Record<string, number> = {};
    for (const l of liste) serverVotiMap[l.id] = 0;
    if (votiLista) {
      for (const v of votiLista) serverVotiMap[v.lista_id] = v.voti;
    }

    const serverPrefMap: Record<string, number> = {};
    if (preferenzeAll) {
      for (const p of preferenzeAll) serverPrefMap[p.candidato_id] = p.voti;
    }

    const serverState: FormState = {
      totali: {
        schede_totali: risultato?.schede_totali ?? null,
        schede_bianche: risultato?.schede_bianche ?? null,
        schede_nulle: risultato?.schede_nulle ?? null,
        schede_contestate: risultato?.schede_contestate ?? null,
      },
      votiPerLista: serverVotiMap,
      preferenzePerCandidato: serverPrefMap,
      expandedListe: {},
    };

    // Check autosave against server timestamp.
    const local = readAutosave<FormState>(autosaveKey);
    if (local) {
      const serverTs = risultato?.updated_at
        ? new Date(risultato.updated_at).getTime()
        : 0;
      if (local.ts > serverTs) {
        restorePayloadRef.current = local.value;
        // Load server as baseline; prompt user to choose.
        setState(serverState);
        setRestoreOpen(true);
        setHydrated(true);
        return;
      }
      // Stale local draft — clear it silently.
      clearAutosave(autosaveKey);
    }

    setState(serverState);
    setHydrated(true);
  }, [
    hydrated,
    dirty,
    liste,
    votiLista,
    preferenzeAll,
    risultato,
    autosaveKey,
  ]);

  // Autosave current state (only after hydration, to avoid stomping on it).
  useAutosave(autosaveKey, hydrated ? state : null, 5000);

  const updateTotale = (key: keyof Totali, v: string) => {
    setDirty(true);
    setState((s) => ({
      ...s,
      totali: { ...s.totali, [key]: parseIntOrNull(v) },
    }));
  };

  const updateVotiLista = (listaId: string, v: number) => {
    setDirty(true);
    setState((s) => ({
      ...s,
      votiPerLista: { ...s.votiPerLista, [listaId]: v },
    }));
  };

  const updatePreferenza = (candidatoId: string, v: number) => {
    setDirty(true);
    setState((s) => ({
      ...s,
      preferenzePerCandidato: {
        ...s.preferenzePerCandidato,
        [candidatoId]: v,
      },
    }));
  };

  const toggleExpanded = (listaId: string) => {
    setState((s) => ({
      ...s,
      expandedListe: { ...s.expandedListe, [listaId]: !s.expandedListe[listaId] },
    }));
  };

  const handleRestore = () => {
    const payload = restorePayloadRef.current;
    if (payload) {
      setState(payload);
      setDirty(true);
      toast('Bozza locale ripristinata', { type: 'info' });
    }
    restorePayloadRef.current = null;
    setRestoreOpen(false);
  };

  const handleDiscardLocal = () => {
    clearAutosave(autosaveKey);
    restorePayloadRef.current = null;
    setRestoreOpen(false);
    toast('Bozza locale scartata', { type: 'info' });
  };

  const hasNegative =
    Object.values(state.totali).some((v) => v != null && v < 0) ||
    Object.values(state.votiPerLista).some((v) => v < 0) ||
    Object.values(state.preferenzePerCandidato).some((v) => v < 0);

  const save = async (stato: 'draft' | 'submitted') => {
    if (!user) {
      toast('Non autorizzato: sessione mancante', { type: 'error' });
      return;
    }
    setSaving(true);
    try {
      // 1. Upsert risultato.
      const createdBy = risultato?.created_by ?? user.id;
      const upserted = await upsertRisultato.mutateAsync({
        ...(risultato?.id ? { id: risultato.id } : {}),
        sezione_id: sezione.id,
        elezione_id: elezione.id,
        schede_totali: state.totali.schede_totali,
        schede_bianche: state.totali.schede_bianche,
        schede_nulle: state.totali.schede_nulle,
        schede_contestate: state.totali.schede_contestate,
        stato,
        created_by: createdBy,
        updated_by: user.id,
      });

      // 2. Voti lista batch upsert.
      const votiRows = Object.entries(state.votiPerLista).map(
        ([lista_id, voti]) => ({ lista_id, voti }),
      );
      if (votiRows.length > 0) {
        await upsertVotiLista.mutateAsync({
          risultatoId: upserted.id,
          rows: votiRows,
        });
      }

      // 3. Preferenze batch upsert.
      const prefRows = Object.entries(state.preferenzePerCandidato)
        .filter(([, v]) => v > 0)
        .map(([candidato_id, voti]) => ({ candidato_id, voti }));
      if (prefRows.length > 0) {
        await upsertPreferenze.mutateAsync({
          risultatoId: upserted.id,
          rows: prefRows,
        });
      }

      clearAutosave(autosaveKey);
      setDirty(false);
      toast(stato === 'submitted' ? 'Sezione inviata' : 'Bozza salvata', {
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      // Heuristic for RLS.
      const pretty = /row-level security|permission|policy/i.test(msg)
        ? 'Non autorizzato'
        : msg;
      toast(`Errore salvataggio: ${pretty}`, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetEffettivi = async () => {
    try {
      const { deletedPhotos } = await resetEffettivi.mutateAsync({
        sezioneId: sezione.id,
        elezioneId: elezione.id,
        giornataId: sezione.giornata_id,
      });
      clearAutosave(autosaveKey);
      setDirty(false);
      setHydrated(false);
      setState(emptyState());
      const photoSuffix = deletedPhotos > 0 ? ` (${deletedPhotos} foto)` : '';
      toast(`Sezione azzerata${photoSuffix}`, { type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const pretty = /42501|admin role required|permission|policy/i.test(msg)
        ? 'Non autorizzato'
        : msg;
      toast(`Errore azzeramento: ${pretty}`, { type: 'error' });
    } finally {
      setConfirmReset(false);
    }
  };

  const sortedListe = useMemo(
    () => (liste ? [...liste].sort((a, b) => a.ordine - b.ordine) : []),
    [liste],
  );

  const disabledSubmit = saving || hasNegative;
  const resetting = resetEffettivi.isPending;

  return (
    <div className="space-y-4 pb-24">
      {/* Totali */}
      <section className="glass rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Totali schede
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Schede totali"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={state.totali.schede_totali ?? ''}
            onChange={(e) => updateTotale('schede_totali', e.target.value)}
          />
          <Input
            label="Schede bianche"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={state.totali.schede_bianche ?? ''}
            onChange={(e) => updateTotale('schede_bianche', e.target.value)}
          />
          <Input
            label="Schede nulle"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={state.totali.schede_nulle ?? ''}
            onChange={(e) => updateTotale('schede_nulle', e.target.value)}
          />
          <Input
            label="Schede contestate"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={state.totali.schede_contestate ?? ''}
            onChange={(e) => updateTotale('schede_contestate', e.target.value)}
          />
        </div>
      </section>

      {/* Liste */}
      <section className="space-y-3">
        {!liste && (
          <div className="glass p-4 text-slate-400">Caricamento liste…</div>
        )}
        {liste && liste.length === 0 && (
          <div className="glass p-4 text-slate-400">
            Nessuna lista configurata per questa elezione.
          </div>
        )}
        {sortedListe.map((l) => (
          <ListaCard
            key={l.id}
            lista={l}
            votiLista={state.votiPerLista[l.id] ?? 0}
            preferenzePerCandidato={state.preferenzePerCandidato}
            expanded={!!state.expandedListe[l.id]}
            onToggle={() => toggleExpanded(l.id)}
            onChangeVoti={(v) => updateVotiLista(l.id, v)}
            onChangePreferenza={updatePreferenza}
          />
        ))}
      </section>

      {/* Foto pannello */}
      <div className="glass p-4 space-y-3 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-200">Foto pannello</h3>
        <PhotoGallery
          giornataId={sezione.giornata_id}
          sezioneId={sezione.id}
          elezioneId={elezione.id}
        />
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 glass border-t border-white/10 p-3 flex gap-2 -mx-4 px-4">
        {isAdmin && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={resetting || saving}
            className="mr-auto"
          >
            {resetting ? 'Azzeramento…' : 'Azzera sezione'}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => void save('draft')}
          disabled={saving}
        >
          {saving ? 'Salvataggio…' : 'Salva bozza'}
        </Button>
        <Button
          variant="primary"
          onClick={() => setConfirmSubmit(true)}
          disabled={disabledSubmit}
        >
          Invia sezione
        </Button>
      </div>

      {/* Restore modal */}
      <Modal
        open={restoreOpen}
        onClose={handleDiscardLocal}
        title="Bozza locale trovata"
        size="sm"
      >
        <p className="text-slate-300">
          È stata trovata una bozza locale più recente del salvataggio sul server.
          Vuoi ripristinarla?
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={handleDiscardLocal}>
            Scarta
          </Button>
          <Button variant="primary" onClick={handleRestore}>
            Ripristina
          </Button>
        </div>
      </Modal>

      {/* Confirm submit */}
      <ConfirmDialog
        open={confirmSubmit}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          void save('submitted');
        }}
        title="Invia sezione"
        message="Confermi l'invio della sezione? Potrà essere modificata solo da un admin o verificatore."
        confirmLabel="Invia"
      />

      {/* Confirm azzeramento (admin) */}
      <ConfirmDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleResetEffettivi()}
        title="Azzera sezione"
        message={`Azzerare l'inserimento per la sezione N. ${sezione.numero} dell'elezione «${elezione.nome}»? Verranno cancellati risultati, voti per lista, preferenze e foto caricate per questa sezione e questa elezione. L'operazione è irreversibile.`}
        confirmLabel={resetting ? 'Azzeramento…' : 'Azzera'}
        danger
      />
    </div>
  );
}
