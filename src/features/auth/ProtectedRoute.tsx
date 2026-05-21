import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import type { Ruolo } from '@/lib/database.types';

type Props = {
  children: ReactNode;
  allow?: Ruolo[];
};

export function ProtectedRoute({ children, allow }: Props) {
  const { session, loading } = useAuth();
  const { data: profile, isLoading: roleLoading } = useRole();
  const location = useLocation();

  if (loading || (session && roleLoading)) {
    return <div className="p-6 text-slate-400">Caricamento…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile) {
    return (
      <div className="p-6 glass m-6">
        Il tuo profilo non è attivo o non configurato. Contatta l&apos;admin.
      </div>
    );
  }

  if (allow && !allow.includes(profile.ruolo)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
