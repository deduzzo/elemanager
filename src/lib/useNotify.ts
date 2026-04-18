import { useCallback, useEffect, useState } from 'react';
import { useToast, type ToastType } from '@/components/ui';

type NotifyOptions = {
  type?: ToastType;
  /** Se true e permesso concesso, mostra anche desktop Notification */
  desktop?: boolean;
  /** Titolo separato per desktop notification; se assente usa message */
  title?: string;
  /** Durata toast */
  duration?: number;
};

function notificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function useNotify() {
  const { push } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationSupported() ? Notification.permission : 'denied',
  );

  useEffect(() => {
    if (!notificationSupported()) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!notificationSupported()) return 'denied';
    if (Notification.permission === 'default') {
      try {
        const p = await Notification.requestPermission();
        setPermission(p);
        return p;
      } catch {
        // Some legacy browsers throw instead of returning a promise.
        return Notification.permission;
      }
    }
    return Notification.permission;
  }, []);

  const notify = useCallback(
    (message: string, options: NotifyOptions = {}) => {
      const { type = 'info', desktop = false, title, duration } = options;
      push(message, { type, duration });
      if (desktop && notificationSupported() && Notification.permission === 'granted') {
        try {
          new Notification(title ?? 'Elemanager', {
            body: message,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
          });
        } catch {
          // Silently ignore — some browsers forbid on non-HTTPS contexts
        }
      }
    },
    [push],
  );

  return { notify, permission, requestPermission };
}
