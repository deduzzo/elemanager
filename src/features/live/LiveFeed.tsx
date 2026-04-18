import { useEffect, useRef } from 'react';
import type { LivePostRow } from '@/lib/database.types';
import { LiveBubble } from './LiveBubble';

interface Props {
  posts: LivePostRow[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onToggleModeration: (id: string, moderated: boolean) => void;
  onDelete: (post: LivePostRow) => void;
}

export function LiveFeed({
  posts,
  currentUserId,
  isAdmin,
  onToggleModeration,
  onDelete,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      nearBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (nearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [posts.length]);

  // DB returns desc; display ascending so newest is at bottom.
  const ordered = [...posts].reverse();

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-3 space-y-1"
    >
      {ordered.map((p) => (
        <LiveBubble
          key={p.id}
          post={p}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onToggleModeration={onToggleModeration}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
