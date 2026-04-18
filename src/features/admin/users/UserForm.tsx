import { FormEvent, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { useCreateProfile, useUpdateProfile } from '@/lib/queries/profiles';
import type { ProfileRow, Ruolo } from '@/lib/database.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UserFormProps {
  open: boolean;
  onClose: () => void;
  profile?: ProfileRow;
}

interface FormState {
  id: string;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
}

function getInitialState(profile?: ProfileRow): FormState {
  return {
    id: profile?.id ?? '',
    nome: profile?.nome ?? '',
    ruolo: profile?.ruolo ?? 'editor',
    attivo: profile?.attivo ?? true,
  };
}

export function UserForm({ open, onClose, profile }: UserFormProps) {
  const isEdit = !!profile;
  const [state, setState] = useState<FormState>(() => getInitialState(profile));
  const [errors, setErrors] = useState<{ id?: string; nome?: string }>({});
  const { push } = useToast();
  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();

  useEffect(() => {
    if (open) {
      setState(getInitialState(profile));
      setErrors({});
    }
  }, [open, profile]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { id?: string; nome?: string } = {};
    if (!isEdit) {
      if (!state.id.trim()) {
        next.id = 'UUID obbligatorio.';
      } else if (!UUID_REGEX.test(state.id.trim())) {
        next.id = 'UUID non valido. Formato atteso: 8-4-4-4-12 caratteri esadecimali.';
      }
    }
    if (!state.nome.trim() || state.nome.trim().length < 2) {
      next.nome = 'Il nome deve contenere almeno 2 caratteri.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDuplicate = /duplicate key/i.test(message);
    push(
      isDuplicate
        ? 'Esiste già un profilo per questo UUID.'
        : `Errore: ${message}`,
      { type: 'error' },
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    if (!validate()) return;

    const nome = state.nome.trim();

    if (isEdit && profile) {
      updateMutation.mutate(
        { id: profile.id, patch: { nome, ruolo: state.ruolo, attivo: state.attivo } },
        {
          onSuccess: () => {
            push('Profilo aggiornato', { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        { id: state.id.trim(), nome, ruolo: state.ruolo, attivo: state.attivo },
        {
          onSuccess: () => {
            push('Profilo creato', { type: 'success' });
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
      title={isEdit ? 'Modifica profilo' : 'Nuovo profilo'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="UUID"
          type="text"
          value={state.id}
          onChange={(e) => setState((s) => ({ ...s, id: e.target.value }))}
          disabled={isEdit}
          required
          placeholder="es. 550e8400-e29b-41d4-a716-446655440000"
          hint="Copia l'UUID dalla sezione Authentication → Users di Supabase Studio."
          error={errors.id}
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          label="Nome"
          type="text"
          value={state.nome}
          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
          required
          minLength={2}
          placeholder="Nome completo"
          error={errors.nome}
        />

        <Select
          label="Ruolo"
          value={state.ruolo}
          onChange={(e) =>
            setState((s) => ({ ...s, ruolo: e.target.value as Ruolo }))
          }
        >
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="viewer">viewer</option>
        </Select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.attivo}
            onChange={(e) => setState((s) => ({ ...s, attivo: e.target.checked }))}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-neon-cyan"
          />
          <span className="text-sm text-slate-300">Profilo attivo</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
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
