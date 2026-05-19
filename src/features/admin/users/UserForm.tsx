import { FormEvent, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { useCreateUser, useUpdateProfile } from '@/lib/queries/profiles';
import type { ProfileRow, Ruolo } from '@/lib/database.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserFormProps {
  open: boolean;
  onClose: () => void;
  profile?: ProfileRow;
}

interface FormState {
  email: string;
  password: string;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
}

function getInitialState(profile?: ProfileRow): FormState {
  return {
    email: '',
    password: '',
    nome: profile?.nome ?? '',
    ruolo: profile?.ruolo ?? 'editor',
    attivo: profile?.attivo ?? true,
  };
}

function generatePassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join('');
}

export function UserForm({ open, onClose, profile }: UserFormProps) {
  const isEdit = !!profile;
  const [state, setState] = useState<FormState>(() => getInitialState(profile));
  const [errors, setErrors] = useState<{ email?: string; password?: string; nome?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const { push } = useToast();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateProfile();

  useEffect(() => {
    if (open) {
      setState(getInitialState(profile));
      setErrors({});
      setShowPassword(false);
    }
  }, [open, profile]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const next: { email?: string; password?: string; nome?: string } = {};
    if (!isEdit) {
      const email = state.email.trim().toLowerCase();
      if (!email) next.email = 'Email obbligatoria.';
      else if (!EMAIL_REGEX.test(email)) next.email = 'Formato email non valido.';
      if (!state.password) next.password = 'Password obbligatoria.';
      else if (state.password.length < 8) next.password = 'Almeno 8 caratteri.';
    }
    if (!state.nome.trim() || state.nome.trim().length < 2) {
      next.nome = 'Il nome deve contenere almeno 2 caratteri.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    push(`Errore: ${message}`, { type: 'error' });
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
        {
          email: state.email.trim().toLowerCase(),
          password: state.password,
          nome,
          ruolo: state.ruolo,
        },
        {
          onSuccess: ({ email }) => {
            push(`Utente ${email} creato`, { type: 'success' });
            onClose();
          },
          onError: handleError,
        },
      );
    }
  }

  function handleGeneratePassword() {
    const pwd = generatePassword();
    setState((s) => ({ ...s, password: pwd }));
    setShowPassword(true);
    navigator.clipboard?.writeText(pwd).then(
      () => push('Password generata e copiata negli appunti', { type: 'success' }),
      () => push('Password generata (clipboard non disponibile)', { type: 'info' }),
    );
  }

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : onClose}
      title={isEdit ? 'Modifica profilo' : 'Nuovo utente'}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <>
            <Input
              label="Email"
              type="email"
              value={state.email}
              onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
              required
              placeholder="utente@esempio.it"
              error={errors.email}
              autoComplete="off"
              spellCheck={false}
            />

            <div className="space-y-2">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={state.password}
                onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))}
                required
                minLength={8}
                placeholder="Min 8 caratteri"
                error={errors.password}
                autoComplete="new-password"
                hint="L'utente potrà cambiarla in seguito."
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleGeneratePassword}
                >
                  Genera random
                </Button>
              </div>
            </div>
          </>
        )}

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

        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.attivo}
              onChange={(e) => setState((s) => ({ ...s, attivo: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-neon-cyan"
            />
            <span className="text-sm text-slate-300">Profilo attivo</span>
          </label>
        )}

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
            {isPending ? 'Salvataggio…' : isEdit ? 'Salva' : 'Crea utente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
