import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui';

type Card = { to: string; title: string; description: string };

const cards: Card[] = [
  { to: '/admin/users', title: 'Utenti', description: 'Gestisci profili e ruoli di admin, editor, viewer.' },
  { to: '/admin/giornate', title: 'Giornate elettorali', description: 'Crea giornate, elezioni, liste e candidati.' },
  { to: '/admin/sezioni', title: 'Sezioni', description: 'Importa CSV dei seggi e visualizza sulla mappa.' },
  { to: '/admin/audit', title: 'Audit log', description: 'Storico modifiche voti e operazioni.' },
];

export function AdminIndexPage() {
  return (
    <div>
      <PageHeader title="Amministrazione" subtitle="Configurazione e controllo di elezioni, utenti e dati." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="glass-strong p-5 rounded-2xl hover:bg-white/10 transition-colors block"
          >
            <div className="text-lg font-semibold bg-gradient-neon bg-clip-text text-transparent">
              {c.title}
            </div>
            <p className="mt-1 text-sm text-slate-300">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
