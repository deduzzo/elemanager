import { useState } from 'react';
import { useTogglePreferitoCandidato } from '@/lib/queries/candidati';
import { useRole } from '@/features/auth/useRole';
import { useToast } from './Toast';

interface Props {
  candidatoId: string;
  preferito: boolean;
  size?: 'sm' | 'md';
  /** Se true mostra la stella anche al non-admin (in sola lettura, non cliccabile). */
  alwaysShow?: boolean;
}

/**
 * Stella per marcare/smarcare un candidato come preferito.
 * - Admin: cliccabile, toggle ottimistico con rollback su errore.
 * - Non-admin: la stella appare solo se `preferito=true` (decorativa).
 */
export function StarToggle({ candidatoId, preferito, size = 'md', alwaysShow }: Props) {
  const { data: profile } = useRole();
  const isAdmin = profile?.ruolo === 'admin';
  const toggle = useTogglePreferitoCandidato();
  const { push } = useToast();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const current = optimistic ?? preferito;

  if (!isAdmin) {
    if (!current && !alwaysShow) return null;
    return (
      <span
        className={`${size === 'sm' ? 'text-sm' : 'text-base'} ${current ? 'text-amber-300' : 'text-slate-500'}`}
        aria-label={current ? 'Preferito' : ''}
        title={current ? 'Preferito' : ''}
      >
        {current ? '★' : '☆'}
      </span>
    );
  }

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !current;
    setOptimistic(next);
    toggle.mutate(
      { id: candidatoId, preferito: next },
      {
        onError: (err) => {
          setOptimistic(current);
          const msg = err instanceof Error ? err.message : String(err);
          push(`Errore: ${msg}`, { type: 'error' });
        },
        onSettled: () => setOptimistic(null),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-label={current ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      aria-pressed={current}
      title={current ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      className={`transition-colors ${size === 'sm' ? 'text-sm' : 'text-base'} ${
        current ? 'text-amber-300 hover:text-amber-200' : 'text-slate-500 hover:text-amber-300'
      } ${toggle.isPending ? 'opacity-50' : ''}`}
    >
      {current ? '★' : '☆'}
    </button>
  );
}
