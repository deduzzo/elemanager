# Plan 05 — Polish UX + Web Push Level 2

**Goal:** Rifinire UX (skeleton loaders, error boundaries, empty states coerenti) e implementare Web Push Level 2 (notifiche con tab chiusa via Service Worker + VAPID).

## Task 1 — UX polish

- **Skeleton loaders**: componente `<Skeleton />` semplice con animate-pulse. Sostituisce i "Caricamento..." text-based nelle pagine principali (Dashboard, Editor, Admin).
- **Error boundary**: `<ErrorBoundary fallback={...}>` a livello di ogni route, cattura errori React runtime e mostra glass card "Qualcosa è andato storto" + stack dev-only.
- **Empty states**: consistenti su tutte le liste (icona + testo + CTA).

**File**: `src/components/ui/Skeleton.tsx`, `src/components/ui/ErrorBoundary.tsx`, `src/components/ui/EmptyState.tsx`, + update index.ts.

Applicarli in: DashboardPage, EditorHomePage, SezioniPickPage, AdminIndexPage, UsersPage, GiornateListPage.

**Steps:**
- [ ] 1. Crea i 3 componenti.
- [ ] 2. Integra in 6 pagine chiave.
- [ ] 3. tsc + build ok.
- [ ] 4. Commit.

## Task 2 — Web Push Level 2 (server-side + client)

### Backend

- **Tabella** `push_subscriptions`: colonne `id uuid PK`, `user_id uuid FK profiles(id)`, `endpoint text UNIQUE`, `p256dh text`, `auth text`, `created_at`.
- Migration `0007_push_subscriptions.sql` con RLS: user può SELECT/INSERT/DELETE solo le proprie subscription; admin SELECT tutto.
- **VAPID keys**: genera via `web-push` CLI oppure online. Salva `VITE_VAPID_PUBLIC_KEY` in `.env.local` (pubblica), `VAPID_PRIVATE_KEY` in `.env.server` (privata).
- **Sender Edge Function** (se supabase functions disponibile): `/supabase/functions/send-push/index.ts` che accetta `{ userIds?, topic?, payload: {title, body, url} }`, legge subscriptions, chiama `web-push` per inviare.
- **Alternativa senza Edge Function**: script Node `scripts/send-push.mjs` che può essere chiamato da trigger DB via pg_net extension, oppure manualmente per test.

### Frontend

- **Service Worker push handler**: aggiungi in vite-plugin-pwa config `workbox.runtimeCaching` più `injectManifest` per aggiungere un custom SW handler per `push` event:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Elemanager', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/favicon.svg',
      data: { url: data.url || '/' },
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```
Richiede passare a `strategies: 'injectManifest'` in VitePWA + file `src/sw.ts`.

- **UI**: in AuditLogPage o in un nuovo componente `<PushSubscriptionToggle />` bottone "Abilita notifiche push" che:
  1. Richiede permission Notification
  2. Registra subscription via `navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY }))`
  3. Salva subscription in `push_subscriptions` via API REST
  4. Toggle disattivo chiama `subscription.unsubscribe()` + delete row

**Steps:**
- [ ] 1. Migration 0007 + applica.
- [ ] 2. Genera VAPID keys + aggiungi a env.
- [ ] 3. Refactor vite-plugin-pwa a `injectManifest` con `src/sw.ts` custom.
- [ ] 4. Crea `PushSubscriptionToggle` component, integralo in HomePage o AuditLogPage.
- [ ] 5. Crea Edge Function sender (o script Node se Functions non disponibili).
- [ ] 6. Test manuale: abilita push, invia push via script, ricevi notifica con tab chiusa.
- [ ] 7. Commit.

## Task 3 — Verifica finale + tag

- [ ] Docker rebuild + push.
- [ ] Tag `plan-05-polish-complete`.
