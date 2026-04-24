import { useState } from 'react';
import { PageHeader, Select } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { PerCandidatoView } from './PerCandidatoView';
import { PerSezioneView } from './PerSezioneView';

type Tab = 'candidato' | 'sezione';

export function ConfrontoPage() {
  const [tab, setTab] = useState<Tab>('candidato');

  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Confronto presunti vs reali"
        subtitle="Scostamenti live per candidato e per sezione (solo admin)."
      />

      <div className="flex flex-wrap gap-3 glass p-3 rounded-2xl">
        <Select
          label="Giornata"
          value={selectedGiornataId}
          onChange={(e) => {
            setGiornataId(e.target.value);
            setElezioneId('');
          }}
        >
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'candidato' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('candidato')}
        >
          Per candidato
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm ${
            tab === 'sezione' ? 'bg-white/10 text-neon-cyan' : 'text-slate-300 hover:bg-white/5'
          }`}
          onClick={() => setTab('sezione')}
        >
          Per sezione
        </button>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona una giornata ed elezione per vedere il confronto.
        </div>
      ) : tab === 'candidato' ? (
        <PerCandidatoView elezioneId={selectedElezioneId} giornataId={selectedGiornataId} />
      ) : (
        <PerSezioneView elezioneId={selectedElezioneId} giornataId={selectedGiornataId} />
      )}
    </div>
  );
}
