import { useEffect, useState } from 'react';
import { PageHeader, Select } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { DashboardCore } from './DashboardCore';

export function DashboardPage() {
  const [giornataId, setGiornataId] = useState<string | undefined>(undefined);
  const [elezioneId, setElezioneId] = useState<string | undefined>(undefined);

  const giornateQ = useGiornate();
  const giornate = giornateQ.data ?? [];

  useEffect(() => {
    if (giornataId || giornate.length === 0) return;
    const open = giornate.find((g) => g.stato !== 'closed');
    setGiornataId((open ?? giornate[0]).id);
  }, [giornate, giornataId]);

  const elezioniQ = useElezioniByGiornata(giornataId);
  const elezioni = elezioniQ.data ?? [];

  useEffect(() => {
    if (elezioni.length === 0) {
      setElezioneId(undefined);
      return;
    }
    if (!elezioneId || !elezioni.find((e) => e.id === elezioneId)) {
      setElezioneId(elezioni[0].id);
    }
  }, [elezioni, elezioneId]);

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Aggregati realtime + proiezioni" />

      <div className="glass p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Giornata"
          value={giornataId ?? ''}
          onChange={(e) => setGiornataId(e.target.value || undefined)}
          disabled={giornateQ.isLoading || giornate.length === 0}
        >
          {giornate.length === 0 && <option value="">Nessuna giornata</option>}
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
              {g.comune ? ` · ${g.comune}` : ''}
              {g.stato === 'closed' ? ' · chiusa' : ''}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={elezioneId ?? ''}
          onChange={(e) => setElezioneId(e.target.value || undefined)}
          disabled={!giornataId || elezioniQ.isLoading || elezioni.length === 0}
        >
          {elezioni.length === 0 && <option value="">Nessuna elezione</option>}
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <DashboardCore giornataId={giornataId} elezioneId={elezioneId} />
    </div>
  );
}
