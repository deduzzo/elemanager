import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, PageHeader } from '@/components/ui';
import { useGiornata } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import type { StatoGiornata } from '@/lib/database.types';
import { ElezioneSection } from './ElezioneSection';
import { ElezioneForm } from './ElezioneForm';

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
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return data;
  return dateFormatter.format(new Date(y, m - 1, d));
}

function BackLink() {
  return (
    <Link
      to="/admin/giornate"
      className="inline-block text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors mb-3"
    >
      ← Torna alle giornate
    </Link>
  );
}

export function GiornataDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [elezioneFormOpen, setElezioneFormOpen] = useState(false);

  const giornataQuery = useGiornata(id);
  const elezioniQuery = useElezioniByGiornata(id);

  const elezioni = useMemo(() => elezioniQuery.data ?? [], [elezioniQuery.data]);
  const activeId = searchParams.get('t');

  // Resolve active elezione. If the selected id no longer exists (e.g. deleted
  // by this user or another), fall back to the first elezione.
  const activeElezione = useMemo(() => {
    if (elezioni.length === 0) return undefined;
    const match = activeId ? elezioni.find((e) => e.id === activeId) : undefined;
    return match ?? elezioni[0];
  }, [elezioni, activeId]);

  // Sync URL with the resolved active id so back/forward behaves correctly and
  // stale ids (deleted elezioni) get cleaned up.
  useEffect(() => {
    if (elezioni.length === 0) {
      if (activeId !== null) {
        const next = new URLSearchParams(searchParams);
        next.delete('t');
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (activeElezione && activeElezione.id !== activeId) {
      const next = new URLSearchParams(searchParams);
      next.set('t', activeElezione.id);
      setSearchParams(next, { replace: true });
    }
  }, [activeElezione, activeId, elezioni.length, searchParams, setSearchParams]);

  function setActive(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('t', id);
    setSearchParams(next, { replace: false });
  }

  function handleElezioneDeleted(deletedId: string) {
    // Clear URL ?t= if it matches the deleted one; the effect above will
    // then resolve to the first remaining elezione on next render.
    if (activeId === deletedId) {
      const next = new URLSearchParams(searchParams);
      next.delete('t');
      setSearchParams(next, { replace: true });
    }
  }

  if (!id) {
    return <Navigate to="/admin/giornate" replace />;
  }

  if (giornataQuery.isLoading) {
    return (
      <div>
        <BackLink />
        <div className="glass p-6 text-slate-400">Caricamento giornata…</div>
      </div>
    );
  }

  if (giornataQuery.isError) {
    return (
      <div>
        <BackLink />
        <div className="glass p-6 border-l-4 border-l-neon-pink text-slate-300">
          Errore nel caricamento della giornata:{' '}
          {giornataQuery.error instanceof Error
            ? giornataQuery.error.message
            : 'errore sconosciuto'}
        </div>
      </div>
    );
  }

  const giornata = giornataQuery.data;
  if (!giornata) {
    return (
      <div>
        <BackLink />
        <div className="glass p-6 text-slate-300">
          <p className="mb-2">Giornata non trovata.</p>
          <Link to="/admin/giornate" className="text-neon-cyan hover:underline">
            ← Torna alle giornate
          </Link>
        </div>
      </div>
    );
  }

  const subtitle = `${giornata.comune ?? 'Comune non specificato'} · ${formatData(giornata.data)}`;

  return (
    <div>
      <BackLink />

      <PageHeader
        title={giornata.nome}
        subtitle={subtitle}
        actions={
          <Button onClick={() => setElezioneFormOpen(true)}>+ Elezione</Button>
        }
      />

      <div className="-mt-2 mb-4 flex items-center gap-2 text-xs text-slate-400">
        <span>Stato</span>
        <StatoBadge stato={giornata.stato} />
      </div>

      {/* Tabs */}
      {elezioniQuery.isLoading && (
        <div className="glass p-6 text-slate-400">Caricamento elezioni…</div>
      )}

      {elezioniQuery.isError && !elezioniQuery.isLoading && (
        <div className="glass p-6 border-l-4 border-l-neon-pink text-slate-300">
          Errore nel caricamento delle elezioni:{' '}
          {elezioniQuery.error instanceof Error
            ? elezioniQuery.error.message
            : 'errore sconosciuto'}
        </div>
      )}

      {!elezioniQuery.isLoading && !elezioniQuery.isError && elezioni.length === 0 && (
        <div className="glass p-6 text-slate-300 text-center">
          <p className="mb-3">Nessuna elezione in questa giornata.</p>
          <Button onClick={() => setElezioneFormOpen(true)}>
            + Crea la prima elezione
          </Button>
        </div>
      )}

      {!elezioniQuery.isLoading && !elezioniQuery.isError && elezioni.length > 0 && (
        <>
          <nav
            aria-label="Elezioni"
            className="flex gap-2 overflow-x-auto pb-2 mb-4"
          >
            {elezioni.map((e) => {
              const isActive = activeElezione?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setActive(e.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                    'border',
                    isActive
                      ? 'bg-gradient-neon text-slate-900 border-transparent shadow-neon'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10',
                  ].join(' ')}
                >
                  {e.nome}
                </button>
              );
            })}
          </nav>

          {activeElezione && (
            <div className="glass p-5 rounded-2xl">
              <ElezioneSection
                key={activeElezione.id}
                elezione={activeElezione}
                onDeleted={handleElezioneDeleted}
              />
            </div>
          )}
        </>
      )}

      <ElezioneForm
        open={elezioneFormOpen}
        onClose={() => setElezioneFormOpen(false)}
        giornataId={giornata.id}
      />
    </div>
  );
}
