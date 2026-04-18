import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button, EmptyState, PageHeader, SkeletonCard } from '@/components/ui';
import { useGiornata } from '@/lib/queries/giornate';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useRisultatiByGiornata } from '@/lib/queries/risultati';
import { useAuth } from '@/features/auth/useAuth';
import type {
  RisultatoSezioneRow,
  SezioneRow,
  StatoGiornata,
} from '@/lib/database.types';

type FilterMode = 'tutte' | 'vuote' | 'mie-bozze' | 'inviate';
type SezioneStatus = 'vuota' | 'bozza' | 'inviata';

interface SezioneComputed {
  sezione: SezioneRow;
  status: SezioneStatus;
  isMineDraft: boolean;
  priority: number;
}

const statoGiornataBadgeClasses: Record<StatoGiornata, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  open: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-rose-500/20 text-rose-300',
};

function GiornataStatoBadge({ stato }: { stato: StatoGiornata }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statoGiornataBadgeClasses[stato]}`}
    >
      {stato}
    </span>
  );
}

function StatusBadge({ status }: { status: SezioneStatus }) {
  if (status === 'vuota') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-300">
        ⬜ Vuota
      </span>
    );
  }
  if (status === 'bozza') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
        🟡 Bozza
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
      🟢 Inviata
    </span>
  );
}

function BackLink() {
  return (
    <Link
      to="/editor"
      className="inline-block text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors mb-3"
    >
      ← Torna alle giornate
    </Link>
  );
}

export function SezioniPickPage() {
  const { giornataId } = useParams<{ giornataId: string }>();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('tutte');

  const giornataQuery = useGiornata(giornataId);
  const sezioniQuery = useSezioniByGiornata(giornataId);
  const elezioniQuery = useElezioniByGiornata(giornataId);
  const risultatiQuery = useRisultatiByGiornata(giornataId);

  const sezioni = useMemo(() => sezioniQuery.data ?? [], [sezioniQuery.data]);
  const elezioni = useMemo(() => elezioniQuery.data ?? [], [elezioniQuery.data]);
  const risultati = useMemo(
    () => risultatiQuery.data ?? [],
    [risultatiQuery.data],
  );

  const risultatiBySezione = useMemo(() => {
    const map = new Map<string, RisultatoSezioneRow[]>();
    for (const r of risultati) {
      const arr = map.get(r.sezione_id);
      if (arr) {
        arr.push(r);
      } else {
        map.set(r.sezione_id, [r]);
      }
    }
    return map;
  }, [risultati]);

  const userId = user?.id ?? null;
  const totalElezioni = elezioni.length;

  const computed = useMemo<SezioneComputed[]>(() => {
    return sezioni.map((sez) => {
      const rows = risultatiBySezione.get(sez.id) ?? [];
      const isEmpty = rows.length === 0;
      const finalizedCount = rows.filter(
        (r) => r.stato === 'submitted' || r.stato === 'verified',
      ).length;
      const isSubmitted =
        totalElezioni > 0 && finalizedCount === totalElezioni;
      const isMineDraft =
        !!userId &&
        rows.some((r) => r.stato === 'draft' && r.created_by === userId);

      let status: SezioneStatus;
      if (isEmpty) status = 'vuota';
      else if (isSubmitted) status = 'inviata';
      else status = 'bozza';

      // Priority: my draft (3) > empty (0) > other draft (1) > submitted (-1)
      // Spec meaning: my drafts first, then empty, then other drafts, then submitted.
      let priority: number;
      if (status === 'bozza' && isMineDraft) priority = 3;
      else if (status === 'vuota') priority = 0;
      else if (status === 'bozza') priority = 1;
      else priority = -1;

      return { sezione: sez, status, isMineDraft, priority };
    });
  }, [sezioni, risultatiBySezione, totalElezioni, userId]);

  const filteredSorted = useMemo<SezioneComputed[]>(() => {
    const trimmed = searchTerm.trim();
    const bySearch = trimmed
      ? computed.filter((c) => c.sezione.numero.toString().includes(trimmed))
      : computed;

    const byFilter = bySearch.filter((c) => {
      if (filterMode === 'tutte') return true;
      if (filterMode === 'vuote') return c.status === 'vuota';
      if (filterMode === 'mie-bozze') return c.isMineDraft;
      if (filterMode === 'inviate') return c.status === 'inviata';
      return true;
    });

    return [...byFilter].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.sezione.numero - b.sezione.numero;
    });
  }, [computed, searchTerm, filterMode]);

  if (!giornataId) {
    return <Navigate to="/editor" replace />;
  }

  const isLoading =
    giornataQuery.isLoading ||
    sezioniQuery.isLoading ||
    elezioniQuery.isLoading ||
    risultatiQuery.isLoading;

  if (isLoading) {
    return (
      <div>
        <BackLink />
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
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
          <Link to="/editor" className="text-neon-cyan hover:underline">
            ← Torna alle giornate
          </Link>
        </div>
      </div>
    );
  }

  const filterPills: { key: FilterMode; label: string }[] = [
    { key: 'tutte', label: 'Tutte' },
    { key: 'vuote', label: 'Vuote' },
    { key: 'mie-bozze', label: 'Bozze mie' },
    { key: 'inviate', label: 'Inviate' },
  ];

  return (
    <div>
      <BackLink />

      <PageHeader title={giornata.nome} />

      <div className="-mt-2 mb-4 flex items-center gap-2 text-xs text-slate-400">
        <span>Stato</span>
        <GiornataStatoBadge stato={giornata.stato} />
      </div>

      {giornata.stato !== 'open' && (
        <div className="glass p-4 border-l-4 border-l-amber-400 text-amber-200 mb-4 rounded-xl">
          Giornata in stato {giornata.stato}. Gli inserimenti potrebbero essere
          bloccati.
        </div>
      )}

      {sezioni.length === 0 ? (
        <EmptyState
          title="Nessuna sezione"
          description="L'admin deve importare il CSV delle sezioni."
        />
      ) : (
        <>
          <div className="mb-4">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Cerca per numero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cerca sezione per numero"
              className={[
                'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2',
                'text-slate-100 placeholder-slate-500',
                'focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40',
                'transition',
              ].join(' ')}
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {filterPills.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={filterMode === p.key ? 'primary' : 'ghost'}
                onClick={() => setFilterMode(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {filteredSorted.length === 0 ? (
            <div className="glass p-6 text-slate-300">
              Nessuna sezione corrisponde al filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSorted.map(({ sezione, status }) => (
                <Link
                  key={sezione.id}
                  to={`/editor/giornate/${giornataId}/sezioni/${sezione.id}`}
                  className="glass p-4 rounded-2xl flex items-center gap-4 transition-colors hover:bg-white/10"
                >
                  <div className="text-2xl font-bold bg-gradient-neon bg-clip-text text-transparent min-w-[3rem] text-center">
                    {sezione.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    {sezione.ubicazione && (
                      <p className="text-sm text-slate-300 truncate">
                        {sezione.ubicazione}
                      </p>
                    )}
                    {sezione.indirizzo && (
                      <p className="text-xs text-slate-400 truncate">
                        {sezione.indirizzo}
                      </p>
                    )}
                    {!sezione.ubicazione && !sezione.indirizzo && (
                      <p className="text-xs text-slate-500 italic">
                        Nessun indirizzo
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
