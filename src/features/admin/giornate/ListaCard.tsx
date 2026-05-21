import { useState } from 'react';
import { Button, ConfirmDialog, StarToggle, useToast } from '@/components/ui';
import {
  useCandidatiByLista,
  useDeleteCandidato,
} from '@/lib/queries/candidati';
import { useDeleteLista } from '@/lib/queries/liste';
import type { CandidatoRow, ListaRow } from '@/lib/database.types';
import { ListaForm } from './ListaForm';
import { CandidatoForm } from './CandidatoForm';

export interface ListaCardProps {
  lista: ListaRow;
}

export function ListaCard({ lista }: ListaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);

  const [candidatoFormOpen, setCandidatoFormOpen] = useState(false);
  const [editingCandidato, setEditingCandidato] = useState<CandidatoRow | undefined>(undefined);
  const [candidatoToDelete, setCandidatoToDelete] = useState<CandidatoRow | null>(null);

  const { push } = useToast();
  const deleteListaMutation = useDeleteLista();
  const deleteCandidatoMutation = useDeleteCandidato();

  const candidatiQuery = useCandidatiByLista(lista.id);
  const candidati = candidatiQuery.data ?? [];

  function confirmDeleteLista() {
    const nome = lista.nome;
    deleteListaMutation.mutate(lista.id, {
      onSuccess: () => {
        push(`Lista "${nome}" eliminata`, { type: 'success' });
        setToDelete(false);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        push(`Errore eliminazione: ${message}`, { type: 'error' });
        setToDelete(false);
      },
    });
  }

  function confirmDeleteCandidato() {
    if (!candidatoToDelete) return;
    const etichetta = `${candidatoToDelete.cognome} ${candidatoToDelete.nome}`.trim();
    deleteCandidatoMutation.mutate(candidatoToDelete.id, {
      onSuccess: () => {
        push(`Candidato "${etichetta}" eliminato`, { type: 'success' });
        setCandidatoToDelete(null);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        push(`Errore eliminazione: ${message}`, { type: 'error' });
        setCandidatoToDelete(null);
      },
    });
  }

  function openCreateCandidato() {
    setEditingCandidato(undefined);
    setCandidatoFormOpen(true);
  }

  function openEditCandidato(c: CandidatoRow) {
    setEditingCandidato(c);
    setCandidatoFormOpen(true);
  }

  function closeCandidatoForm() {
    setCandidatoFormOpen(false);
    setEditingCandidato(undefined);
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <span
          aria-hidden
          className={`inline-block transition-transform text-slate-400 ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </span>

        {lista.simbolo_url && (
          <img
            src={lista.simbolo_url}
            alt=""
            className="w-8 h-8 rounded object-cover border border-white/10"
          />
        )}

        <span className="font-semibold text-slate-100 flex-1 min-w-0 truncate">
          {lista.nome}
        </span>

        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-300 shrink-0">
          {candidati.length} candidat{candidati.length === 1 ? 'o' : 'i'}
        </span>

        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
          >
            Modifica
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              setToDelete(true);
            }}
          >
            Elimina
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-2">
          {candidatiQuery.isLoading && (
            <p className="text-sm text-slate-400">Caricamento candidati…</p>
          )}

          {candidatiQuery.isError && (
            <p className="text-sm text-neon-pink">
              Errore caricamento candidati:{' '}
              {candidatiQuery.error instanceof Error
                ? candidatiQuery.error.message
                : 'sconosciuto'}
            </p>
          )}

          {!candidatiQuery.isLoading && !candidatiQuery.isError && candidati.length === 0 && (
            <p className="text-sm text-slate-400">Nessun candidato in questa lista.</p>
          )}

          {!candidatiQuery.isLoading && !candidatiQuery.isError && candidati.length > 0 && (
            <ul className="divide-y divide-white/5">
              {candidati.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <StarToggle candidatoId={c.id} preferito={c.preferito} alwaysShow />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100">
                      <span className="font-medium">
                        {c.cognome} {c.nome}
                      </span>
                      <span className="text-slate-500"> · #{c.ordine}</span>
                    </div>
                    {c.note && (
                      <div className="text-xs text-slate-400 truncate">{c.note}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEditCandidato(c)}>
                      Modifica
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setCandidatoToDelete(c)}
                    >
                      Elimina
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2">
            <Button size="sm" variant="ghost" onClick={openCreateCandidato}>
              + Candidato
            </Button>
          </div>
        </div>
      )}

      <ListaForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        elezioneId={lista.elezione_id}
        lista={lista}
      />

      <CandidatoForm
        open={candidatoFormOpen}
        onClose={closeCandidatoForm}
        listaId={lista.id}
        candidato={editingCandidato}
      />

      <ConfirmDialog
        open={toDelete}
        onCancel={() => setToDelete(false)}
        onConfirm={confirmDeleteLista}
        title="Elimina lista"
        message={`Eliminare la lista "${lista.nome}" e TUTTI i suoi candidati e risultati collegati? Operazione irreversibile.`}
        confirmLabel={deleteListaMutation.isPending ? 'Eliminazione…' : 'Elimina'}
        danger
      />

      <ConfirmDialog
        open={!!candidatoToDelete}
        onCancel={() => setCandidatoToDelete(null)}
        onConfirm={confirmDeleteCandidato}
        title="Elimina candidato"
        message={
          candidatoToDelete
            ? `Eliminare il candidato "${candidatoToDelete.cognome} ${candidatoToDelete.nome}" e tutte le preferenze registrate? Operazione irreversibile.`
            : ''
        }
        confirmLabel={deleteCandidatoMutation.isPending ? 'Eliminazione…' : 'Elimina'}
        danger
      />
    </div>
  );
}
