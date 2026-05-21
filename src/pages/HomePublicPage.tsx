import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';
import { useElezioniPubbliche } from '@/lib/queries/elezioni';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatData(data: string): string {
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return data;
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function HomePublicPage() {
  const { session } = useAuth();
  const { data: profile } = useRole();
  const elezioniQ = useElezioniPubbliche();
  const elezioni = elezioniQ.data ?? [];

  // Utente loggato: mostra banner che invita ad andare nell'app
  const showAuthBanner = !!session && !!profile;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-10 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="text-lg font-semibold bg-gradient-neon bg-clip-text text-transparent"
          >
            Elemanager
          </Link>
          {session ? (
            <Link
              to="/app"
              className="px-4 py-1.5 rounded-xl bg-gradient-neon text-slate-900 text-sm font-medium shadow-neon"
            >
              Pannello
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-xl bg-gradient-neon text-slate-900 text-sm font-medium shadow-neon"
            >
              Accedi
            </Link>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <section className="glass-strong rounded-2xl p-6">
          <h1 className="text-2xl font-bold bg-gradient-neon bg-clip-text text-transparent">
            Risultati elettorali in diretta
          </h1>
          <p className="text-slate-300 mt-2 text-sm">
            Visualizza la copertura e i risultati delle elezioni pubbliche in
            tempo reale, sezione per sezione.
          </p>
        </section>

        {showAuthBanner && (
          <div className="glass rounded-xl p-3 text-sm text-slate-300 flex items-center justify-between gap-3">
            <span>
              Sei autenticato come{' '}
              <span className="text-neon-cyan">{profile?.nome}</span>.
            </span>
            <Link
              to="/app"
              className="text-neon-cyan hover:text-neon-cyan/80 transition-colors"
            >
              Vai al pannello →
            </Link>
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300 mb-3">
            Elezioni in diretta
          </h2>

          {elezioniQ.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass h-32 rounded-2xl animate-pulse" />
              <div className="glass h-32 rounded-2xl animate-pulse" />
            </div>
          )}

          {elezioniQ.isError && !elezioniQ.isLoading && (
            <div className="glass p-6 border-l-4 border-l-neon-pink text-slate-300">
              Errore nel caricamento delle elezioni:{' '}
              {elezioniQ.error instanceof Error
                ? elezioniQ.error.message
                : 'errore sconosciuto'}
            </div>
          )}

          {!elezioniQ.isLoading &&
            !elezioniQ.isError &&
            elezioni.length === 0 && (
              <div className="glass p-6 rounded-2xl text-slate-300 text-center">
                Nessuna elezione in diretta al momento.
              </div>
            )}

          {!elezioniQ.isLoading && elezioni.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {elezioni.map((e) => (
                <Link
                  key={e.id}
                  to={`/pubblico/elezioni/${e.id}`}
                  className="glass rounded-2xl p-4 hover:shadow-neon hover:border-neon-cyan/40 border border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-100 truncate">
                      {e.nome}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-300 shrink-0">
                      {e.tipo}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 truncate">
                    {e.giornata.comune ?? 'Comune non specificato'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatData(e.giornata.data)}
                  </p>
                  <div className="mt-3 text-xs text-neon-cyan">
                    Vedi risultati →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/5 py-4">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-500">
          Elemanager · raccolta ufficiosa risultati elettorali
        </div>
      </footer>
    </div>
  );
}

/** Component esportato per redirect compat (rotte vecchie -> /app/...). */
export function LegacyRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}
