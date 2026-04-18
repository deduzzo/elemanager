import { Link } from 'react-router-dom';
import type { LivePostRow, LivePostKind } from '@/lib/database.types';

const ICONS: Record<LivePostKind, string> = {
  user_text: '💬',
  user_audio: '🎤',
  user_photo: '📷',
  system_vote_update: '🗳️',
  system_photo_added: '📷',
  system_section_complete: '✅',
  system_giornata_update: '⚙️',
  system_custom: '💬',
};

interface Props {
  post: LivePostRow;
}

export function LiveSystemBubble({ post }: Props) {
  const icon = ICONS[post.kind] ?? '💬';
  const time = new Date(post.created_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const inner = (
    <span className="inline-flex items-center gap-2 text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-slate-300">
      <span aria-hidden>{icon}</span>
      <span>{post.content}</span>
      {post.ref_url && <span className="text-neon-cyan">· apri</span>}
      <span className="text-slate-500">{time}</span>
    </span>
  );

  return (
    <div className="text-center my-2">
      {post.ref_url ? (
        <Link to={post.ref_url} className="hover:opacity-80 transition-opacity">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}
