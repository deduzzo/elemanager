import { useRole } from '@/features/auth/useRole';
import { PushSubscriptionToggle } from '@/features/push/PushSubscriptionToggle';

export function HomePage() {
  const { data: profile } = useRole();
  return (
    <div className="flex flex-col gap-4">
      <div className="glass-strong p-6">
        <h2 className="text-xl font-semibold">
          Ciao {profile?.nome ?? '...'}
        </h2>
        <p className="text-slate-300 mt-2">
          Ruolo: <span className="text-neon-cyan">{profile?.ruolo}</span>
        </p>
        <p className="text-slate-400 mt-4 text-sm">
          Le sezioni admin / editor / viewer saranno aggiunte nei plan successivi.
        </p>
      </div>
      <PushSubscriptionToggle />
    </div>
  );
}
