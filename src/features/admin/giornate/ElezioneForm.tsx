import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, useToast } from '@/components/ui';
import { useCreateElezione, useUpdateElezione } from '@/lib/queries/elezioni';
import type { ElezioneRow, TipoElezione } from '@/lib/database.types';

export interface ElezioneFormProps {
  open: boolean;
  onClose: () => void;
  giornataId: string;
  elezione?: ElezioneRow;
}

interface FormState {
  nome: string;
  tipo: TipoElezione;
  ordine: number;
}

function getInitialState(elezione?: ElezioneRow): FormState {
  return {
    nome: elezione?.nome ?? '',
    tipo: elezione?.tipo ?? 'sindaco',
    ordine: elezione?.ordine ?? 0,
  };
}

export function ElezioneForm({ open, onClose, giornataId, elezione }: ElezioneFormProps) {
  const isEdit = !!elezione;
  const [state, setState] = useState<FormState>(() => getInitialState(elezione));
  const [errors, setErrors] = useState<{ nome?: string }>({});
  const { push } = useToast();
  const createMutation = useCreateElezione();
  const updateMutation = useUpdateElezione();

  useEffect(() => {
    if (open) {
      setState(getInitialState(elezione));
      setErrors({});
    }
  }, [open, elezione]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { nome?: string } = {};
    const nome = state.nome.trim();
    if (!nome) {
      next.nome = 'Il nome è obbligatorio.';
    } else if (nome.length < 2) {
      next.nome = 'Il nome deve contenere almeno 2 caratteri.';
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
    const ordine = Number.isFinite(state.ordine) ? state.ordine : 0;

    if (isEdit && elezione) {
      updateMutation.mutate(
        {
          id: elezione.id,
          patch: { nome, tipo: state.tipo, ordine },
        },
        {
          onSuccess: () => {
            push('Elezione modificata', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        { giornata_id: giornataId, nome, tipo: state.tipo, ordine },
        {
          onSuccess: () => {
            push('Elezione creata', { type: 'success' });
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
      title={isEdit ? 'Modifica elezione' : 'Nuova elezione'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
          required
          minLength={2}
          placeholder="es. Sindaco"
          error={errors.nome}
          autoComplete="off"
        />

        <Select
          label="Tipo"
          value={state.tipo}
          onChange={(e) =>
            setState((s) => ({ ...s, tipo: e.target.value as TipoElezione }))
          }
        >
          <option value="sindaco">sindaco</option>
          <option value="consiglio">consiglio</option>
          <option value="circoscrizione">circoscrizione</option>
          <option value="nazionale">nazionale</option>
          <option value="referendum">referendum</option>
          <option value="altro">altro</option>
        </Select>

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
