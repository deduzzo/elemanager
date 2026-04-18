import { useMemo, useState } from 'react';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { useDeleteElezione } from '@/lib/queries/elezioni';
import { useListeByElezione } from '@/lib/queries/liste';
import type { ElezioneRow } from '@/lib/database.types';
import { ElezioneForm } from './ElezioneForm';
import { ListaForm } from './ListaForm';
import { ListaCard } from './ListaCard';

export interface ElezioneSectionProps {
  elezione: ElezioneRow;
  onDeleted?: (id: string) => void;
}

export function ElezioneSection({ elezione, onDeleted }: ElezioneSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listaFormOpen, setListaFormOpen] = useState(false);

  const { push } = useToast();
  const deleteMutation = useDeleteElezione();
  const listeQuery = useListeByElezione(elezione.id);
  const liste = useMemo(() => listeQuery.data ?? [], [listeQuery.data]);

  function confirmDelete() {
    const nome = elezione.nome;
    const deletedId = elezione.id;
    deleteMutation.mutate(deletedId, {
      onSuccess: () => {
        push(`Elezione "${nome}" eliminata`, { type: 'success' });
        setDeleteOpen(false);
        onDeleted?.(deletedId);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        push(`Errore eliminazione: ${message}`, { type: 'error' });
        setDeleteOpen(false);
      },
    });
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-100 truncate">
              {elezione.nome}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-300">
              {elezione.tipo}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
            Modifica
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            Elimina
          </Button>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Liste
          </h4>
          <Button size="sm" variant="ghost" onClick={() => setListaFormOpen(true)}>
            + Nuova lista
          </Button>
        </div>

        {listeQuery.isLoading && (
          <div className="glass p-4 text-slate-400 text-sm">Caricamento liste…</div>
        )}

        {listeQuery.isError && !listeQuery.isLoading && (
          <div className="glass p-4 border-l-4 border-l-neon-pink text-sm text-slate-300">
            Errore nel caricamento delle liste:{' '}
            {listeQuery.error instanceof Error ? listeQuery.error.message : 'errore sconosciuto'}
          </div>
        )}

        {!listeQuery.isLoading && !listeQuery.isError && liste.length === 0 && (
          <div className="glass p-4 text-slate-300 text-sm">
            Nessuna lista ancora in questa elezione.
          </div>
        )}

        {!listeQuery.isLoading && !listeQuery.isError && liste.length > 0 && (
          <div className="flex flex-col gap-3">
            {liste.map((l) => (
              <ListaCard key={l.id} lista={l} />
            ))}
          </div>
        )}
      </div>

      <ElezioneForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        giornataId={elezione.giornata_id}
        elezione={elezione}
      />

      <ListaForm
        open={listaFormOpen}
        onClose={() => setListaFormOpen(false)}
        elezioneId={elezione.id}
      />

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Elimina elezione"
        message={`Eliminare l'elezione "${elezione.nome}" e TUTTE le sue liste, candidati e risultati? Operazione irreversibile.`}
        confirmLabel={deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
        danger
      />
    </div>
  );
}
