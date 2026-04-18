import { useMemo, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  PageHeader,
  useToast,
} from '@/components/ui';
import {
  useDeleteProfile,
  useProfiles,
} from '@/lib/queries/profiles';
import type { ProfileRow, Ruolo } from '@/lib/database.types';
import { UserForm } from './UserForm';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const ruoloBadgeClasses: Record<Ruolo, string> = {
  admin: 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30',
  editor: 'bg-neon-violet/15 text-neon-violet border border-neon-violet/30',
  viewer: 'bg-slate-500/15 text-slate-300 border border-slate-400/30',
};

function RuoloBadge({ ruolo }: { ruolo: Ruolo }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${ruoloBadgeClasses[ruolo]}`}
    >
      {ruolo}
    </span>
  );
}

function AttivoDot({ attivo }: { attivo: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          attivo ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]' : 'bg-neon-pink'
        }`}
        aria-hidden
      />
      <span className="text-xs text-slate-400">{attivo ? 'Attivo' : 'Disattivo'}</span>
    </span>
  );
}

export function UsersPage() {
  const { data: profiles, isLoading, isError, error } = useProfiles();
  const deleteMutation = useDeleteProfile();
  const { push } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | undefined>(undefined);
  const [toDelete, setToDelete] = useState<ProfileRow | null>(null);

  const list = useMemo(() => profiles ?? [], [profiles]);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(p: ProfileRow) {
    setEditing(p);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
  }

  function confirmDelete() {
    if (!toDelete) return;
    const nome = toDelete.nome;
    deleteMutation.mutate(toDelete.id, {
      onSuccess: () => {
        push(`Profilo "${nome}" eliminato`, { type: 'success' });
        setToDelete(null);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        push(`Errore eliminazione: ${message}`, { type: 'error' });
        setToDelete(null);
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Utenti"
        subtitle="Gestione profili admin/editor/viewer"
        actions={<Button onClick={openCreate}>+ Nuovo profilo</Button>}
      />

      {isLoading && (
        <div className="glass p-6 text-slate-400">Caricamento…</div>
      )}

      {isError && !isLoading && (
        <div className="glass p-6 border-l-4 border-l-neon-pink text-slate-300">
          Errore nel caricamento dei profili:{' '}
          {error instanceof Error ? error.message : 'errore sconosciuto'}
        </div>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <div className="glass p-6 flex flex-col items-start gap-3">
          <p className="text-slate-300">Nessun profilo ancora. Crea il primo.</p>
          <Button onClick={openCreate}>+ Nuovo profilo</Button>
        </div>
      )}

      {!isLoading && !isError && list.length > 0 && (
        <>
          {/* Desktop / tablet: table */}
          <div className="glass hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Ruolo</th>
                  <th className="px-4 py-3 font-medium">Attivo</th>
                  <th className="px-4 py-3 font-medium">Creato il</th>
                  <th className="px-4 py-3 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-100">
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-slate-500 font-mono truncate max-w-[220px]">
                        {p.id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RuoloBadge ruolo={p.ruolo} />
                    </td>
                    <td className="px-4 py-3">
                      <AttivoDot attivo={p.attivo} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {dateFormatter.format(new Date(p.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                        >
                          Modifica
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setToDelete(p)}
                        >
                          Elimina
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="sm:hidden space-y-3">
            {list.map((p) => (
              <div key={p.id} className="glass p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 truncate">{p.nome}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{p.id}</div>
                  </div>
                  <RuoloBadge ruolo={p.ruolo} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <AttivoDot attivo={p.attivo} />
                  <span className="text-xs text-slate-400">
                    {dateFormatter.format(new Date(p.created_at))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(p)}
                    className="flex-1"
                  >
                    Modifica
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setToDelete(p)}
                    className="flex-1"
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <UserForm open={formOpen} onClose={closeForm} profile={editing} />

      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Elimina profilo"
        message={
          toDelete
            ? `Eliminare il profilo di ${toDelete.nome}? L'azione elimina ANCHE l'utente auth collegato (cascade).`
            : ''
        }
        confirmLabel={deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
        danger
      />
    </div>
  );
}
