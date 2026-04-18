import { NavLink, Outlet } from 'react-router-dom';

const items = [
  { to: '/admin', label: 'Home', end: true },
  { to: '/admin/users', label: 'Utenti' },
  { to: '/admin/giornate', label: 'Giornate' },
  { to: '/admin/sezioni', label: 'Sezioni' },
  { to: '/admin/audit', label: 'Audit' },
];

export function AdminLayout() {
  return (
    <div className="space-y-4">
      <nav className="glass rounded-2xl px-2 py-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
