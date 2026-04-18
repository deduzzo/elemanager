import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState, Skeleton, useToast } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import {
  useLivePosts,
  useToggleModeration,
  useDeleteLivePost,
} from '@/lib/queries/livePost';
import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';
import type { LivePostRow } from '@/lib/database.types';
import { LiveFeed } from './LiveFeed';
import { LiveComposer } from './LiveComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from './useTypingIndicator';

export function LivePage() {
  const { user } = useAuth();
  const { data: profile } = useRole();
  const { data: giornate = [], isLoading: loadingGiornate } = useGiornate();
  const { push: toast } = useToast();

  const openGiornate = useMemo(
    () => giornate.filter((g) => g.stato === 'open'),
    [giornate],
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showModerated, setShowModerated] = useState(false);

  // Auto-select first open giornata
  useEffect(() => {
    if (!selectedId && openGiornate.length > 0) {
      setSelectedId(openGiornate[0].id);
    }
    if (selectedId && !openGiornate.some((g) => g.id === selectedId)) {
      setSelectedId(openGiornate[0]?.id);
    }
  }, [openGiornate, selectedId]);

  const isAdmin = profile?.ruolo === 'admin';

  const { data: posts = [], isLoading: loadingPosts } = useLivePosts(selectedId, {
    includeModerated: isAdmin && showModerated,
    limit: 200,
  });

  const toggleMod = useToggleModeration();
  const deletePost = useDeleteLivePost();
  const typing = useTypingIndicator(selectedId);

  const onToggleModeration = async (id: string, moderated: boolean) => {
    try {
      await toggleMod.mutateAsync({ id, moderated });
      toast(moderated ? 'Messaggio nascosto' : 'Messaggio ripristinato', {
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore moderazione';
      toast(msg, { type: 'error' });
    }
  };

  const onDelete = async (post: LivePostRow) => {
    if (!window.confirm('Eliminare definitivamente questo messaggio?')) return;
    try {
      await deletePost.mutateAsync({
        id: post.id,
        media_path: post.media_path,
        giornata_id: post.giornata_id,
      });
      toast('Messaggio eliminato', { type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore eliminazione';
      toast(msg, { type: 'error' });
    }
  };

  if (loadingGiornate) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (openGiornate.length === 0) {
    return (
      <div className="p-4">
        <PageHeader title="Live" />
        <EmptyState
          title="Nessuna giornata attiva"
          description="Il feed live è disponibile solo durante una giornata elettorale aperta."
        />
      </div>
    );
  }

  if (!selectedId || !user || !profile) {
    return (
      <div className="p-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)]">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Live</h2>
          {openGiornate.length > 1 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-neon-cyan/50"
            >
              {openGiornate.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-400 mt-1">
              {openGiornate[0].nome}
            </p>
          )}
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showModerated}
              onChange={(e) => setShowModerated(e.target.checked)}
              className="accent-neon-cyan"
            />
            Mostra moderati
          </label>
        )}
      </div>

      {loadingPosts ? (
        <div className="flex-1 p-4 space-y-2 overflow-hidden">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2 ml-auto" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : (
        <LiveFeed
          posts={posts}
          currentUserId={user.id}
          isAdmin={isAdmin}
          onToggleModeration={onToggleModeration}
          onDelete={onDelete}
        />
      )}

      <TypingIndicator giornataId={selectedId} currentUserId={user.id} />

      <LiveComposer
        giornataId={selectedId}
        userId={user.id}
        userNome={profile.nome}
        onType={typing.onType}
        onSendOrCancel={typing.onSendOrCancel}
      />
    </div>
  );
}
