import { useState } from 'react';
import { Button, useToast } from '@/components/ui';
import {
  useCreatePushSubscription,
  useDeletePushSubscription,
  useMyPushSubscriptions,
} from '@/lib/queries/pushSubscriptions';

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscriptionToggle() {
  const { data: subs, isLoading } = useMyPushSubscriptions();
  const createSub = useCreatePushSubscription();
  const deleteSub = useDeletePushSubscription();
  const { push: toast } = useToast();
  const [busy, setBusy] = useState(false);

  const hasActive = (subs ?? []).length > 0;

  const handleEnable = async () => {
    if (!VAPID_KEY) {
      toast('VAPID public key non configurata', { type: 'error' });
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast('Browser non supporta Web Push', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast('Permesso notifiche negato', { type: 'error' });
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      const subJson = sub.toJSON();
      await createSub.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh ?? '',
        auth: subJson.keys?.auth ?? '',
        user_agent: navigator.userAgent,
      });
      toast('Notifiche push attivate su questo dispositivo', { type: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore';
      toast(`Errore attivazione push: ${msg}`, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      for (const row of subs ?? []) {
        await deleteSub.mutateAsync(row.id);
      }
      toast('Notifiche push disattivate', { type: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore';
      toast(`Errore: ${msg}`, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="text-slate-400 text-sm">Verifica sottoscrizione…</div>;
  return (
    <div className="glass p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-slate-200">Notifiche push</div>
        <div className="text-xs text-slate-400">
          {hasActive
            ? `Attive su ${subs?.length} dispositivo/i. Riceverai notifiche anche a tab chiusa.`
            : 'Abilita per ricevere notifiche anche con il browser chiuso.'}
        </div>
      </div>
      {hasActive ? (
        <Button variant="ghost" size="sm" onClick={handleDisable} disabled={busy}>
          Disattiva
        </Button>
      ) : (
        <Button size="sm" onClick={handleEnable} disabled={busy}>
          Attiva
        </Button>
      )}
    </div>
  );
}
