import { Link, useParams } from 'react-router-dom';
import { useElezioneConGiornata } from '@/lib/queries/elezioni';
import { useLivePosts } from '@/lib/queries/livePost';
import { DashboardCore } from '@/features/dashboard/DashboardCore';
import { LiveFeed } from '@/features/live/LiveFeed';

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

export function DashboardPublicaPage() {
  const { elezioneId } = useParams<{ elezioneId: string }>();
  const elezioneQ = useElezioneConGiornata(elezioneId);

  const elezione = elezioneQ.data ?? null;
  const giornataId = elezione?.giornata.id;
  const livePostsQ = useLivePosts(giornataId, { includeModerated: false, limit: 50 });
  const livePosts = livePostsQ.data ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-10 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            ← Elezioni
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-semibold truncate">
              {elezione?.nome ?? '...'}
            </h1>
            {elezione && (
              <p className="text-xs text-slate-400 truncate">
                {elezione.giornata.comune ?? ''} · {formatData(elezione.giornata.data)}
              </p>
            )}
          </div>
          <Link
            to="/login"
            className="px-3 py-1.5 rounded-xl bg-gradient-neon text-slate-900 text-sm font-medium shadow-neon"
          >
            Accedi
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        {elezioneQ.isLoading && (
          <div className="glass p-6 rounded-2xl text-slate-400">
            Caricamento elezione…
          </div>
        )}

        {!elezioneQ.isLoading && !elezione && (
          <div className="glass p-6 rounded-2xl text-slate-300">
            <p>Questa elezione non è disponibile o non è ancora pubblica.</p>
            <Link to="/" className="text-neon-cyan hover:underline mt-2 inline-block">
              ← Torna all'elenco
            </Link>
          </div>
        )}

        {elezione && (
          <>
            <DashboardCore
              giornataId={elezione.giornata.id}
              elezioneId={elezione.id}
            />

            {livePosts.length > 0 && (
              <section className="glass p-4 rounded-2xl">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  Feed live
                </h3>
                <div className="max-h-[400px] overflow-hidden flex flex-col">
                  <LiveFeed
                    posts={livePosts}
                    currentUserId={undefined}
                    isAdmin={false}
                    onToggleModeration={() => undefined}
                    onDelete={() => undefined}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
