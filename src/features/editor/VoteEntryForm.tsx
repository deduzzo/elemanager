import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ElezioneRow, SezioneRow } from '@/lib/database.types';
import { ElezioneVoteTab } from './ElezioneVoteTab';

type Props = { sezione: SezioneRow; elezioni: ElezioneRow[] };

export function VoteEntryForm({ sezione, elezioni }: Props) {
  const [params, setParams] = useSearchParams();
  const activeId = params.get('e') ?? elezioni[0]?.id;
  const active = elezioni.find((e) => e.id === activeId) ?? elezioni[0];

  useEffect(() => {
    if (active && params.get('e') !== active.id) {
      const next = new URLSearchParams(params);
      next.set('e', active.id);
      setParams(next, { replace: true });
    }
  }, [active, params, setParams]);

  if (!active) return null;

  return (
    <div className="space-y-4">
      <nav className="glass rounded-2xl p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {elezioni.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('e', e.id);
                setParams(next, { replace: true });
              }}
              className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                e.id === active.id
                  ? 'bg-white/10 text-neon-cyan'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {e.nome}
            </button>
          ))}
        </div>
      </nav>
      <ElezioneVoteTab key={active.id} sezione={sezione} elezione={active} />
    </div>
  );
}
