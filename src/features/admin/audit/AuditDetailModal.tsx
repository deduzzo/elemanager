import { Modal } from '@/components/ui';
import type { AuditLogRow } from '@/lib/database.types';

type Props = {
  open: boolean;
  onClose: () => void;
  entry: AuditLogRow | null;
};

export function AuditDetailModal({ open, onClose, entry }: Props) {
  if (!entry) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Audit #${entry.id}`} size="lg">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400">Attore:</span>{' '}
            <span className="text-slate-100">
              {entry.actor_email ?? entry.actor_id ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Data:</span>{' '}
            <span className="text-slate-100">
              {new Date(entry.created_at).toLocaleString('it-IT')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Azione:</span>{' '}
            <span className="text-slate-100">{entry.azione}</span>
          </div>
          <div>
            <span className="text-slate-400">Tabella:</span>{' '}
            <span className="text-slate-100">{entry.tabella}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-400">Record ID:</span>{' '}
            <span className="font-mono text-xs text-slate-300">{entry.record_id ?? '—'}</span>
          </div>
        </div>
        <div>
          <div className="text-slate-400 mb-1">Diff</div>
          <pre className="glass p-3 text-xs overflow-auto max-h-[50vh] whitespace-pre-wrap break-words">
{JSON.stringify(entry.diff, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
