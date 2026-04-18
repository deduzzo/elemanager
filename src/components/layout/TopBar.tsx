import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';

export function TopBar() {
  const { signOut } = useAuth();
  const { data: profile } = useRole();

  return (
    <header className="sticky top-0 z-20 glass border-b border-white/10 px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Elemanager</div>
        <div className="text-sm text-slate-200">
          {profile?.nome ?? '...'} · <span className="text-neon-cyan">{profile?.ruolo}</span>
        </div>
      </div>
      <button
        onClick={() => void signOut()}
        className="text-sm text-slate-300 hover:text-neon-pink transition-colors"
      >
        Esci
      </button>
    </header>
  );
}
