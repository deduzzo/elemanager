import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { useCreateLista, useUpdateLista } from '@/lib/queries/liste';
import type { ListaRow } from '@/lib/database.types';

export interface ListaFormProps {
  open: boolean;
  onClose: () => void;
  elezioneId: string;
  lista?: ListaRow;
}

interface FormState {
  nome: string;
  simboloUrl: string;
  ordine: number;
}

function getInitialState(lista?: ListaRow): FormState {
  return {
    nome: lista?.nome ?? '',
    simboloUrl: lista?.simbolo_url ?? '',
    ordine: lista?.ordine ?? 0,
  };
}

export function ListaForm({ open, onClose, elezioneId, lista }: ListaFormProps) {
  const isEdit = !!lista;
  const [state, setState] = useState<FormState>(() => getInitialState(lista));
  const [errors, setErrors] = useState<{ nome?: string }>({});
  const { push } = useToast();
  const createMutation = useCreateLista();
  const updateMutation = useUpdateLista();

  useEffect(() => {
    if (open) {
      setState(getInitialState(lista));
      setErrors({});
    }
  }, [open, lista]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { nome?: string } = {};
    const nome = state.nome.trim();
    if (!nome) {
      next.nome = 'Il nome è obbligatorio.';
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
    const simbolo = state.simboloUrl.trim() || null;
    const ordine = Number.isFinite(state.ordine) ? state.ordine : 0;

    if (isEdit && lista) {
      updateMutation.mutate(
        {
          id: lista.id,
          patch: { nome, simbolo_url: simbolo, ordine },
        },
        {
          onSuccess: () => {
            push('Lista modificata', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        { elezione_id: elezioneId, nome, simbolo_url: simbolo, ordine },
        {
          onSuccess: () => {
            push('Lista creata', { type: 'success' });
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
      title={isEdit ? 'Modifica lista' : 'Nuova lista'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
          required
          placeholder="es. Partito X"
          error={errors.nome}
          autoComplete="off"
        />

        <Input
          label="Simbolo URL"
          type="text"
          value={state.simboloUrl}
          onChange={(e) => setState((s) => ({ ...s, simboloUrl: e.target.value }))}
          placeholder="https://…"
          hint="URL pubblico di un'immagine, opzionale"
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
