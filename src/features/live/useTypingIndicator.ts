import { useEffect, useRef } from 'react';
import { useUpsertTyping, useClearTyping } from '@/lib/queries/liveTyping';
import { useRole } from '@/features/auth/useRole';

/**
 * Manages the user's own "typing" state for a giornata:
 * - onType: upsert live_typing row + schedule auto-clear after 3s
 * - onSendOrCancel: clear immediately (on send or abandon)
 * - unmount / giornataId change: clear
 */
export function useTypingIndicator(giornataId: string | undefined) {
  const upsert = useUpsertTyping();
  const clear = useClearTyping();
  const { data: profile } = useRole();

  const cleanupTimer = useRef<number | null>(null);

  const cancelTimer = () => {
    if (cleanupTimer.current != null) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }
  };

  const onType = () => {
    if (!giornataId || !profile) return;
    upsert.mutate({ giornataId, nome: profile.nome });
    cancelTimer();
    cleanupTimer.current = window.setTimeout(() => {
      clear.mutate(giornataId);
      cleanupTimer.current = null;
    }, 3000);
  };

  const onSendOrCancel = () => {
    cancelTimer();
    if (giornataId) clear.mutate(giornataId);
  };

  useEffect(() => {
    return () => {
      cancelTimer();
      if (giornataId) clear.mutate(giornataId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giornataId]);

  return { onType, onSendOrCancel };
}
