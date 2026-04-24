import { useEffect, useState } from 'react';
import { Input } from '@/components/ui';

export function CandidatoVotiRow({
  cognome,
  nome,
  listaNome,
  currentValue,
  onCommit,
}: {
  cognome: string;
  nome: string;
  listaNome: string;
  currentValue: number | null;
  onCommit: (next: number | null) => void;
}) {
  const [text, setText] = useState<string>(currentValue === null ? '' : String(currentValue));

  useEffect(() => {
    setText(currentValue === null ? '' : String(currentValue));
  }, [currentValue]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (currentValue !== null) onCommit(null);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0) return;
    if (n === currentValue) return;
    onCommit(n);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center border-t border-white/5 py-2">
      <div className="text-sm">
        <div>
          {cognome} {nome}
        </div>
        <div className="text-xs text-slate-500">{listaNome}</div>
      </div>
      <Input
        label=""
        type="number"
        inputMode="numeric"
        min={0}
        className="w-24"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="—"
      />
    </div>
  );
}
