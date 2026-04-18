import { useState } from 'react';
import { Button, Input, PageHeader, Select } from '@/components/ui';
import { useAuditLog } from '@/lib/queries/audit';
import { useNotify } from '@/lib/useNotify';
import type { AuditLogRow, AzioneAudit } from '@/lib/database.types';
import { AuditDetailModal } from './AuditDetailModal';

type TabellaFilter = 'tutte' | 'risultati_sezione' | 'voti_lista' | 'preferenze_candidato';

const azioneBadge: Record<AzioneAudit, string> = {
  INSERT: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
  UPDATE: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
  DELETE: 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function AuditLogPage() {
  const [tabella, setTabella] = useState<TabellaFilter>('tutte');
  const [limitInput, setLimitInput] = useState<string>('200');
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const { notify, permission, requestPermission } = useNotify();

  const parsedLimit = Number(limitInput);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 200;

  const { data, isLoading, error } = useAuditLog({
    limit,
    tabella: tabella === 'tutte' ? undefined : tabella,
  });

  async function handleEnableNotifications() {
    const p = await requestPermission();
    if (p === 'granted') {
      notify('Notifiche desktop attivate', { type: 'success' });
    } else if (p === 'denied') {
      notify('Permesso notifiche negato dal browser', { type: 'error' });
    }
  }

  const actions =
    permission === 'default' ? (
      <Button variant="ghost" size="sm" onClick={handleEnableNotifications}>
        Attiva notifiche desktop
      </Button>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Storico modifiche voti (solo admin)"
        actions={actions}
      />

      <div className="glass p-4 mb-4 grid gap-3 md:grid-cols-[1fr_1fr]">
        <Select
          label="Tabella"
          value={tabella}
          onChange={(e) => setTabella(e.target.value as TabellaFilter)}
        >
          <option value="tutte">Tutte</option>
          <option value="risultati_sezione">risultati_sezione</option>
          <option value="voti_lista">voti_lista</option>
          <option value="preferenze_candidato">preferenze_candidato</option>
        </Select>
        <Input
          label="Limit"
          type="number"
          min={1}
          max={5000}
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
          hint="Numero massimo di eventi da caricare"
        />
      </div>

      {isLoading && (
        <div className="glass p-6 space-y-2">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-4/6" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-3/6" />
        </div>
      )}

      {error && !isLoading && (
        <div className="glass p-6 text-sm text-neon-pink">
          Accesso negato. Solo admin può vedere l'audit log.
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="glass p-0 overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase tracking-wider">
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Azione</th>
                  <th className="text-left px-3 py-2 font-medium">Tabella</th>
                  <th className="text-left px-3 py-2 font-medium">Record ID</th>
                  <th className="text-left px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      Nessun evento.
                    </td>
                  </tr>
                )}
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                      {formatData(row.created_at)}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {row.actor_email ?? row.actor_id ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full ${azioneBadge[row.azione]}`}
                      >
                        {row.azione}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{row.tabella}</td>
                    <td className="px-3 py-2">
                      <span
                        className="font-mono text-xs text-slate-400 block max-w-[14ch] truncate"
                        title={row.record_id ?? ''}
                      >
                        {row.record_id ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                        Dettagli
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div>
              Totale: <span className="text-slate-200">{data.length}</span> eventi
            </div>
            <div>Mostro gli ultimi {limit} eventi. Alza il limit per vederne di più.</div>
          </div>
        </>
      )}

      <AuditDetailModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        entry={selected}
      />
    </div>
  );
}
