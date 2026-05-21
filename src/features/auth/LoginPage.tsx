import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(/invalid/i.test(error.message) ? 'Credenziali non valide.' : error.message);
      return;
    }
    const target = location.state?.from?.pathname ?? '/app';
    navigate(target, { replace: true });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass-strong p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold bg-gradient-neon bg-clip-text text-transparent">
          Accedi a Elemanager
        </h1>

        <label className="block text-sm">
          <span className="text-slate-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2
                       focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-300">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2
                       focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
          />
        </label>

        {error && (
          <div role="alert" className="text-sm text-neon-pink bg-neon-pink/10 rounded-lg p-2 border border-neon-pink/20">
            {error}
          </div>
        )}

        <button type="submit" className="btn-neon w-full" disabled={loading}>
          {loading ? 'Accesso\u2026' : 'Entra'}
        </button>
      </form>
    </main>
  );
}
