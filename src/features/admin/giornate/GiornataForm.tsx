import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, useToast } from '@/components/ui';
import { useCreateGiornata, useUpdateGiornata } from '@/lib/queries/giornate';
import type { GiornataRow, StatoGiornata } from '@/lib/database.types';

export interface GiornataFormProps {
  open: boolean;
  onClose: () => void;
  giornata?: GiornataRow;
}

interface FormState {
  nome: string;
  data: string;
  comune: string;
  stato: StatoGiornata;
}

function getInitialState(giornata?: GiornataRow): FormState {
  return {
    nome: giornata?.nome ?? '',
    data: giornata?.data ?? '',
    comune: giornata?.comune ?? '',
    stato: giornata?.stato ?? 'draft',
  };
}

export function GiornataForm({ open, onClose, giornata }: GiornataFormProps) {
  const isEdit = !!giornata;
  const [state, setState] = useState<FormState>(() => getInitialState(giornata));
  const [errors, setErrors] = useState<{ nome?: string; data?: string }>({});
  const { push } = useToast();
  const createMutation = useCreateGiornata();
  const updateMutation = useUpdateGiornata();

  useEffect(() => {
    if (open) {
      setState(getInitialState(giornata));
      setErrors({});
    }
  }, [open, giornata]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { nome?: string; data?: string } = {};
    const nome = state.nome.trim();
    if (!nome) {
      next.nome = 'Il nome è obbligatorio.';
    } else if (nome.length < 3) {
      next.nome = 'Il nome deve contenere almeno 3 caratteri.';
    }
    if (!state.data) {
      next.data = 'La data è obbligatoria.';
    }
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
    const comune = state.comune.trim() || null;

    if (isEdit && giornata) {
      updateMutation.mutate(
        {
          id: giornata.id,
          patch: { nome, data: state.data, comune, stato: state.stato },
        },
        {
          onSuccess: () => {
            push('Giornata modificata', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        { nome, data: state.data, comune, stato: state.stato },
        {
          onSuccess: () => {
            push('Giornata creata', { type: 'success' });
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
      title={isEdit ? 'Modifica giornata' : 'Nuova giornata'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
          required
          minLength={3}
          placeholder="es. Comunali 2026"
          error={errors.nome}
          autoComplete="off"
        />

        <Input
          label="Data"
          type="date"
          value={state.data}
          onChange={(e) => setState((s) => ({ ...s, data: e.target.value }))}
          required
          error={errors.data}
        />

        <Input
          label="Comune"
          type="text"
          value={state.comune}
          onChange={(e) => setState((s) => ({ ...s, comune: e.target.value }))}
          placeholder="es. Messina"
          autoComplete="off"
        />

        <Select
          label="Stato"
          value={state.stato}
          onChange={(e) =>
            setState((s) => ({ ...s, stato: e.target.value as StatoGiornata }))
          }
        >
          <option value="draft">draft</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
        </Select>

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
