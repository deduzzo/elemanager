import { FormEvent, useEffect, useId, useState } from 'react';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { useCreateCandidato, useUpdateCandidato } from '@/lib/queries/candidati';
import type { CandidatoRow } from '@/lib/database.types';

export interface CandidatoFormProps {
  open: boolean;
  onClose: () => void;
  listaId: string;
  candidato?: CandidatoRow;
}

interface FormState {
  nome: string;
  cognome: string;
  ordine: number;
  note: string;
}

function getInitialState(candidato?: CandidatoRow): FormState {
  return {
    nome: candidato?.nome ?? '',
    cognome: candidato?.cognome ?? '',
    ordine: candidato?.ordine ?? 0,
    note: candidato?.note ?? '',
  };
}

export function CandidatoForm({ open, onClose, listaId, candidato }: CandidatoFormProps) {
  const isEdit = !!candidato;
  const [state, setState] = useState<FormState>(() => getInitialState(candidato));
  const [errors, setErrors] = useState<{ nome?: string; cognome?: string }>({});
  const { push } = useToast();
  const createMutation = useCreateCandidato();
  const updateMutation = useUpdateCandidato();
  const noteId = useId();

  useEffect(() => {
    if (open) {
      setState(getInitialState(candidato));
      setErrors({});
    }
  }, [open, candidato]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { nome?: string; cognome?: string } = {};
    if (!state.nome.trim()) next.nome = 'Il nome è obbligatorio.';
    if (!state.cognome.trim()) next.cognome = 'Il cognome è obbligatorio.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    push(`Errore: ${message}`, { type: 'error' });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    if (!validate()) return;

    const nome = state.nome.trim();
    const cognome = state.cognome.trim();
    const note = state.note.trim() || null;
    const ordine = Number.isFinite(state.ordine) ? state.ordine : 0;

    if (isEdit && candidato) {
      updateMutation.mutate(
        {
          id: candidato.id,
          patch: { nome, cognome, ordine, note },
        },
        {
          onSuccess: () => {
            push('Candidato modificato', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        { lista_id: listaId, nome, cognome, ordine, note },
        {
          onSuccess: () => {
            push('Candidato creato', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : onClose}
      title={isEdit ? 'Modifica candidato' : 'Nuovo candidato'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
          required
          placeholder="es. Mario"
          error={errors.nome}
          autoComplete="off"
        />

        <Input
          label="Cognome"
          type="text"
          value={state.cognome}
          onChange={(e) => setState((s) => ({ ...s, cognome: e.target.value }))}
          required
          placeholder="es. Rossi"
          error={errors.cognome}
          autoComplete="off"
        />

        <Input
          label="Ordine"
          type="number"
          value={Number.isFinite(state.ordine) ? state.ordine : 0}
          onChange={(e) =>
            setState((s) => ({ ...s, ordine: e.target.value === '' ? 0 : Number(e.target.value) }))
          }
        />

        <div className="w-full">
          <label htmlFor={noteId} className="block text-sm font-medium text-slate-300">
            Note
          </label>
          <textarea
            id={noteId}
            value={state.note}
            onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
            rows={3}
            className={[
              'mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2',
              'text-slate-100 placeholder-slate-500',
              'focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40',
              'transition resize-y',
            ].join(' ')}
            placeholder="Note opzionali"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Salvataggio…' : isEdit ? 'Salva' : 'Crea'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
