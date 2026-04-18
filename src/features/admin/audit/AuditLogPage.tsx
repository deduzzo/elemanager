import { PageHeader } from '@/components/ui';

export function AuditLogPage() {
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Storico operazioni" />
      <div className="glass p-6 text-slate-400">In arrivo nel prossimo task.</div>
    </div>
  );
}
