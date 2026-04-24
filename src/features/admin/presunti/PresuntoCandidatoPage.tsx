import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Input, PageHeader, Skeleton, useToast } from '@/components/ui';
import { db } from '@/lib/queries/_db';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import {
  useVotiPresuntiByCandidato,
  useUpsertVotoPresunto,
  useUpdateVotoPresunto,
  useDeleteVotoPresunto,
} from '@/lib/queries/votiPresunti';
import { useQuery } from '@tanstack/react-query';
import { StimaSezioneRow } from './components/StimaSezioneRow';
import type { CandidatoRow, ListaRow } from '@/lib/database.types';

type CandidatoExt = CandidatoRow & {
  lista: ListaRow & { elezione_id: string; giornata_id: string };
};

function useCandidatoExt(candidatoId: string | undefined) {
  return useQuery({
    queryKey: ['candidato_ext', candidatoId],
    enabled: !!candidatoId,
    queryFn: async (): Promise<CandidatoExt | null> => {
      const { data: c, error: eC } = await db
        .from('candidati')
        .select('*')
        .eq('id', candidatoId as string)
        .single();
      if (eC) throw eC;
      const { data: l, error: eL } = await db
        .from('liste')
        .select('*')
        .eq('id', (c as CandidatoRow).lista_id)
        .single();
      if (eL) throw eL;
      const { data: el, error: eE } = await db
        .from('elezioni')
        .select('giornata_id')
        .eq('id', (l as ListaRow).elezione_id)
        .single();
      if (eE) throw eE;
      return {
        ...(c as CandidatoRow),
        lista: { ...(l as ListaRow), elezione_id: (l as ListaRow).elezione_id, giornata_id: (el as { giornata_id: string }).giornata_id },
      };
    },
  });
}

export function PresuntoCandidatoPage() {
  const { candidatoId } = useParams<{ candidatoId: string }>();
  const { push } = useToast();

  const { data: candExt, isLoading } = useCandidatoExt(candidatoId);
  const { data: presunti = [] } = useVotiPresuntiByCandidato(candidatoId);
  const { data: sezioni = [] } = useSezioniByGiornata(candExt?.lista.giornata_id);

  const upsert = useUpsertVotoPresunto();
  const update = useUpdateVotoPresunto();
  const del = useDeleteVotoPresunto();

  // Totale globale (riga con sezione_id IS NULL)
  const totaleRow = presunti.find((p) => p.sezione_id === null);
  const [totaleInput, setTotaleInput] = useState<string>('');

  useEffect(() => {
    setTotaleInput(totaleRow ? String(totaleRow.voti) : '');
  }, [totaleRow?.id, totaleRow?.voti]);

  const stimeRows = useMemo(
    () => presunti.filter((p) => p.sezione_id !== null) as Array<typeof presunti[number] & { sezione_id: string }>,
    [presunti]
  );

  const sezioniDisponibili = useMemo(() => {
    const used = new Set(stimeRows.map((r) => r.sezione_id));
    return sezioni.filter((s) => !used.has(s.id));
  }, [sezioni, stimeRows]);

  const sommaStime = stimeRows.reduce((a, r) => a + r.voti, 0);
  const totaleNumero = totaleRow?.voti ?? null;
  const warningSomma = totaleNumero !== null && sommaStime > totaleNumero;

  const commitTotale = async () => {
    const trimmed = totaleInput.trim();
    if (trimmed === '') {
      if (totaleRow) await del.mutateAsync(totaleRow.id);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0) return;
    if (totaleRow && totaleRow.voti === n) return;
    try {
      if (totaleRow) {
        await update.mutateAsync({ id: totaleRow.id, patch: { voti: n } });
      } else {
        await upsert.mutateAsync({
          candidato_id: candidatoId as string,
          sezione_id: null,
          voti: n,
          created_by: null,
          updated_by: null,
        });
      }
    } catch (e) {
      push(`Errore salvataggio totale: ${String(e)}`, { type: 'error' });
    }
  };

  const addStima = async (sezione_id: string) => {
    try {
      await upsert.mutateAsync({
        candidato_id: candidatoId as string,
        sezione_id,
        voti: 0,
        created_by: null,
        updated_by: null,
      });
    } catch (e) {
      push(`Errore aggiunta stima: ${String(e)}`, { type: 'error' });
    }
  };

  const updateStima = async (rowId: string, next: { sezione_id: string; voti: number }) => {
    try {
      await update.mutateAsync({
        id: rowId,
        patch: { sezione_id: next.sezione_id, voti: next.voti },
      });
    } catch (e) {
      push(`Errore aggiornamento: ${String(e)}`, { type: 'error' });
    }
  };

  const deleteStima = async (rowId: string) => {
    try {
      await del.mutateAsync(rowId);
    } catch (e) {
      push(`Errore eliminazione: ${String(e)}`, { type: 'error' });
    }
  };

  if (isLoading || !candExt) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${candExt.cognome} ${candExt.nome}`}
        subtitle={`Lista: ${candExt.lista.nome}`}
      />
      <Link to="/admin/presunti" className="text-sm text-neon-cyan hover:underline">
        ← Torna all'elenco
      </Link>

      <div className="glass p-4 rounded-2xl space-y-3">
        <h3 className="font-semibold">Totale presunto</h3>
        <Input
          label="Voti totali attesi"
          type="number"
          inputMode="numeric"
          min={0}
          value={totaleInput}
          onChange={(e) => setTotaleInput(e.target.value)}
          onBlur={commitTotale}
          placeholder="es. 1200"
        />
        <p className="text-xs text-slate-400">
          Lascia vuoto per rimuovere il totale. Autosave on blur.
        </p>
      </div>

      <div className="glass p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Stime per sezione</h3>
          <span
            className={`text-xs ${
              warningSomma ? 'text-neon-pink' : 'text-slate-400'
            }`}
          >
            Somma stime: {sommaStime}
            {warningSomma && ` (supera il totale ${totaleNumero})`}
          </span>
        </div>
        {stimeRows.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna stima per sezione inserita.</p>
        ) : (
          <div className="space-y-2">
            {stimeRows.map((r) => (
              <StimaSezioneRow
                key={r.id}
                row={{ sezione_id: r.sezione_id as string, voti: r.voti }}
                sezioniOptions={[
                  ...sezioni.filter((s) => s.id === r.sezione_id),
                  ...sezioniDisponibili,
                ]}
                onChange={(next) => updateStima(r.id, next)}
                onDelete={() => deleteStima(r.id)}
              />
            ))}
          </div>
        )}
        <AddStimaControl
          sezioniDisponibili={sezioniDisponibili}
          onAdd={addStima}
        />
      </div>
    </div>
  );
}

function AddStimaControl({
  sezioniDisponibili,
  onAdd,
}: {
  sezioniDisponibili: { id: string; numero: number; indirizzo: string | null }[];
  onAdd: (sezione_id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  if (sezioniDisponibili.length === 0) {
    return <p className="text-xs text-slate-500">Nessuna sezione disponibile in più.</p>;
  }
  return (
    <div className="flex items-end gap-2">
      <select
        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">— sezione da aggiungere —</option>
        {sezioniDisponibili.map((s) => (
          <option key={s.id} value={s.id}>
            Sez. {s.numero}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onAdd(selected);
          setSelected('');
        }}
      >
        + Aggiungi stima
      </Button>
    </div>
  );
}
