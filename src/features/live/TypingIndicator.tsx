import { useTypingUsers } from '@/lib/queries/liveTyping';

interface Props {
  giornataId: string;
  currentUserId: string | undefined;
}

export function TypingIndicator({ giornataId, currentUserId }: Props) {
  const { data: typing = [] } = useTypingUsers(giornataId);
  const now = Date.now();
  const fresh = typing.filter(
    (t) =>
      t.user_id !== currentUserId &&
      now - new Date(t.started_at).getTime() < 5000,
  );
  if (fresh.length === 0) return null;
  const names = fresh.map((t) => t.nome);
  const verb = names.length > 1 ? 'stanno scrivendo' : 'sta scrivendo';
  return (
    <div className="text-xs text-slate-400 px-4 py-1 flex items-center gap-1">
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="animate-bounce">.</span>
        <span className="animate-bounce" style={{ animationDelay: '100ms' }}>
          .
        </span>
        <span className="animate-bounce" style={{ animationDelay: '200ms' }}>
          .
        </span>
      </span>
      <span>
        {names.join(', ')} {verb}
      </span>
    </div>
  );
}
