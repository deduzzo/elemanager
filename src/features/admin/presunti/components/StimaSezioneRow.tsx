import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/ui';

type SezioneOpt = { id: string; numero: number; indirizzo: string | null };

export function StimaSezioneRow({
  row,
  sezioniOptions,
  onChange,
  onDelete,
}: {
  row: { sezione_id: string; voti: number };
  sezioniOptions: SezioneOpt[];
  onChange: (next: { sezione_id: string; voti: number }) => void;
  onDelete: () => void;
}) {
  const [sezione_id, setSezioneId] = useState(row.sezione_id);
  const [voti, setVoti] = useState(String(row.voti));

  useEffect(() => {
    setSezioneId(row.sezione_id);
    setVoti(String(row.voti));
  }, [row.sezione_id, row.voti]);

  const commit = () => {
    const n = Number.parseInt(voti, 10);
    if (!sezione_id || Number.isNaN(n) || n < 0) return;
    if (sezione_id === row.sezione_id && n === row.voti) return;
    onChange({ sezione_id, voti: n });
  };

  return (
    <div className="flex gap-2 items-end">
      <Select
        label=""
        value={sezione_id}
        onChange={(e) => setSezioneId(e.target.value)}
        onBlur={commit}
        className="flex-1"
      >
        <option value="">— seleziona sezione —</option>
        {sezioniOptions.map((s) => (
          <option key={s.id} value={s.id}>
            Sez. {s.numero} — {s.indirizzo ?? ''}
          </option>
        ))}
      </Select>
      <Input
        label=""
        type="number"
        inputMode="numeric"
        min={0}
        className="w-28"
        value={voti}
        onChange={(e) => setVoti(e.target.value)}
        onBlur={commit}
      />
      <button
        type="button"
        onClick={onDelete}
        className="px-3 py-2 rounded-xl text-slate-400 hover:text-neon-pink"
        aria-label="Rimuovi stima"
      >
        ×
      </button>
    </div>
  );
}
