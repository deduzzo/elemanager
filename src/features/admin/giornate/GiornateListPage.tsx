import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  PageHeader,
  useToast,
} from '@/components/ui';
import {
  useDeleteGiornata,
  useGiornate,
} from '@/lib/queries/giornate';
import type { GiornataRow, StatoGiornata } from '@/lib/database.types';
import { GiornataForm } from './GiornataForm';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: '2-digit',
  year: 'numeric',
});

const statoBadgeClasses: Record<StatoGiornata, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  open: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-rose-500/20 text-rose-300',
};

function StatoBadge({ stato }: { stato: StatoGiornata }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statoBadgeClasses[stato]}`}
    >
      {stato}
    </span>
  );
}

function formatData(data: string): string {
  // `data` arrives as "YYYY-MM-DD" (Postgres date). Parse as local date to
  // avoid timezone off-by-one.
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return data;
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function GiornateListPage() {
  const { data: giornate, isLoading, isError, error } = useGiornate();
  const deleteMutation = useDeleteGiornata();
  const { push } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GiornataRow | undefined>(undefined);
  const [toDelete, setToDelete] = useState<GiornataRow | null>(null);

  const list = useMemo(() => giornate ?? [], [giornate]);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(g: GiornataRow) {
    setEditing(g);
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
        push(`Giornata "${nome}" eliminata`, { type: 'success' });
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
        title="Giornate elettorali"
        subtitle="Crea, modifica e apri giornate elettorali"
        actions={<Button onClick={openCreate}>+ Nuova giornata</Button>}
      />

      {isLoading && (
        <div className="glass p-6 text-slate-400">Caricamento…</div>
      )}

      {isError && !isLoading && (
        <div className="glass p-6 border-l-4 border-l-neon-pink text-slate-300">
          Errore nel caricamento delle giornate:{' '}
          {error instanceof Error ? error.message : 'errore sconosciuto'}
        </div>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <div className="glass p-6 text-slate-300">
          Nessuna giornata ancora. Crea la prima.
        </div>
      )}

      {!isLoading && !isError && list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((g) => (
            <div
              key={g.id}
              className="glass p-5 rounded-2xl relative flex flex-col gap-3"
            >
              <div className="absolute top-3 right-3">
                <StatoBadge stato={g.stato} />
              </div>

              <div className="pr-16">
                <h3 className="font-semibold text-lg bg-gradient-neon bg-clip-text text-transparent">
                  {g.nome}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {g.comune ?? 'Comune non specificato'} · {formatData(g.data)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                <Link
                  to={`/admin/giornate/${g.id}`}
                  className="text-neon-cyan text-sm font-medium hover:text-neon-cyan/80 transition-colors"
                >
                  Apri →
                </Link>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                    Modifica
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setToDelete(g)}>
                    Elimina
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GiornataForm open={formOpen} onClose={closeForm} giornata={editing} />

      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Elimina giornata"
        message={
          toDelete
            ? `Eliminare la giornata "${toDelete.nome}"? ATTENZIONE: elimina in cascata TUTTE le elezioni, liste, candidati, sezioni e risultati collegati.`
            : ''
        }
        confirmLabel={deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
        danger
      />
    </div>
  );
}
