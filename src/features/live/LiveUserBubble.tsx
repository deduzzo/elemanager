import { useState } from 'react';
import type { LivePostRow } from '@/lib/database.types';
import { useLiveMediaUrl } from '@/lib/queries/livePost';
import { AudioPlayer } from './AudioPlayer';
import { Skeleton } from '@/components/ui';

interface Props {
  post: LivePostRow;
  currentUserId: string | undefined;
  isAdmin: boolean;
  onToggleModeration: (id: string, moderated: boolean) => void;
  onDelete: (post: LivePostRow) => void;
}

function LiveMediaImage({
  path,
  onClick,
}: {
  path: string;
  onClick?: () => void;
}) {
  const { data: url, isLoading } = useLiveMediaUrl(path);
  if (isLoading) return <Skeleton className="w-48 h-48 rounded-lg" />;
  if (!url) {
    return (
      <div className="w-48 h-48 rounded-lg glass flex items-center justify-center text-xs text-slate-500">
        errore
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block rounded-lg overflow-hidden"
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="max-w-[240px] max-h-[240px] object-cover"
      />
    </button>
  );
}

function LiveMediaAudio({
  path,
  duration,
}: {
  path: string;
  duration: number | null;
}) {
  const { data: url, isLoading } = useLiveMediaUrl(path);
  if (isLoading) return <Skeleton className="w-52 h-12 rounded-full" />;
  if (!url) return <div className="text-xs text-slate-500">errore audio</div>;
  return <AudioPlayer src={url} duration={duration} />;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveUserBubble({
  post,
  currentUserId,
  isAdmin,
  onToggleModeration,
  onDelete,
}: Props) {
  const [lightbox, setLightbox] = useState(false);
  const mine = post.author_id === currentUserId;
  const align = mine ? 'justify-end' : 'justify-start';
  const bubbleBase =
    'relative max-w-[78%] rounded-2xl px-3 py-2 text-sm break-words shadow-sm';
  const bubbleColor = mine
    ? 'bg-neon-cyan/20 border border-neon-cyan/30'
    : 'bg-white/10 border border-white/10';

  return (
    <div className={`flex ${align} my-1`}>
      <div className={`${bubbleBase} ${bubbleColor}`}>
        {!mine && post.author_nome && (
          <div className="text-[11px] font-semibold text-neon-cyan/90 mb-0.5">
            {post.author_nome}
          </div>
        )}

        {post.kind === 'user_text' && post.content && (
          <div className="whitespace-pre-wrap text-slate-100">{post.content}</div>
        )}

        {post.kind === 'user_photo' && post.media_path && (
          <>
            <LiveMediaImage
              path={post.media_path}
              onClick={() => setLightbox((v) => !v)}
            />
            {post.content && (
              <div className="mt-1 text-xs text-slate-200">{post.content}</div>
            )}
          </>
        )}

        {post.kind === 'user_audio' && post.media_path && (
          <LiveMediaAudio path={post.media_path} duration={post.media_duration} />
        )}

        <div className="flex items-center justify-end gap-2 mt-1">
          {post.moderated && isAdmin && (
            <span className="text-[10px] uppercase tracking-wide bg-neon-pink/20 text-neon-pink border border-neon-pink/40 rounded-full px-2 py-0.5">
              Moderato
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {formatTime(post.created_at)}
          </span>
        </div>

        {isAdmin && (
          <div className="mt-1 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => onToggleModeration(post.id, !post.moderated)}
              className="text-[11px] text-slate-300 hover:text-neon-cyan transition-colors"
            >
              {post.moderated ? 'Ripristina' : 'Nascondi'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(post)}
              className="text-[11px] text-neon-pink hover:opacity-80 transition-opacity"
            >
              Elimina
            </button>
          </div>
        )}

        {lightbox && post.kind === 'user_photo' && post.media_path && (
          <LightboxViewer
            path={post.media_path}
            onClose={() => setLightbox(false)}
          />
        )}
      </div>
    </div>
  );
}

function LightboxViewer({ path, onClose }: { path: string; onClose: () => void }) {
  const { data: url } = useLiveMediaUrl(path);
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
        aria-label="Chiudi"
      >
        ✕
      </button>
      <img
        src={url}
        className="max-w-full max-h-[85vh] object-contain"
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
