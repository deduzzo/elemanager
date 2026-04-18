import { NavLink } from 'react-router-dom';
import { useRole } from '@/features/auth/useRole';
import type { Ruolo } from '@/lib/database.types';

type Item = { to: string; label: string; roles?: Ruolo[] };

const items: Item[] = [
  { to: '/', label: 'Home' },
  { to: '/live', label: 'Live' },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
  { to: '/editor', label: 'Editor', roles: ['admin', 'editor'] },
  { to: '/dashboard', label: 'Dashboard' },
];

export function BottomNav() {
  const { data: profile } = useRole();
  const visible = items.filter(
    (i) => !i.roles || (profile && i.roles.includes(profile.ruolo)),
  );

  return (
    <nav
      className="sticky bottom-0 z-20 glass border-t border-white/10 grid"
      style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))` }}
    >
      {visible.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) =>
            `text-center py-3 text-sm transition-colors ${
              isActive ? 'text-neon-cyan' : 'text-slate-300'
            }`
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
