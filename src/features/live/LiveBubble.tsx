import type { LivePostRow } from '@/lib/database.types';
import { LiveSystemBubble } from './LiveSystemBubble';
import { LiveUserBubble } from './LiveUserBubble';

interface Props {
  post: LivePostRow;
  currentUserId: string | undefined;
  isAdmin: boolean;
  onToggleModeration: (id: string, moderated: boolean) => void;
  onDelete: (post: LivePostRow) => void;
}

export function LiveBubble({
  post,
  currentUserId,
  isAdmin,
  onToggleModeration,
  onDelete,
}: Props) {
  if (post.kind.startsWith('system_')) {
    return <LiveSystemBubble post={post} />;
  }
  return (
    <LiveUserBubble
      post={post}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      onToggleModeration={onToggleModeration}
      onDelete={onDelete}
    />
  );
}
