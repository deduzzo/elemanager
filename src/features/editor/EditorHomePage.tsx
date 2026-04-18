import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import type { GiornataRow } from '@/lib/database.types';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatData(data: string): string {
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return data;
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function EditorHomePage() {
  const { data: giornate, isLoading, isError, error } = useGiornate();

  const openGiornate = useMemo<GiornataRow[]>(
    () => (giornate ?? []).filter((g) => g.stato === 'open'),
    [giornate],
  );

  return (
    <div>
      <PageHeader
        title="Editor"
        subtitle="Scegli una giornata aperta per inserire i voti"
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

      {!isLoading && !isError && openGiornate.length === 0 && (
        <div className="glass p-6 text-slate-300">
          Nessuna giornata aperta. Attendi che l'admin ne apra una.
        </div>
      )}

      {!isLoading && !isError && openGiornate.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openGiornate.map((g) => (
            <Link
              key={g.id}
              to={`/editor/giornate/${g.id}`}
              className="glass p-5 rounded-2xl relative flex flex-col gap-3 transition-colors hover:bg-white/10"
            >
              <div className="absolute top-3 right-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                  Aperta
                </span>
              </div>

              <div className="pr-16">
                <h3 className="font-semibold text-lg bg-gradient-neon bg-clip-text text-transparent">
                  {g.nome}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {g.comune ?? '—'} · {formatData(g.data)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
