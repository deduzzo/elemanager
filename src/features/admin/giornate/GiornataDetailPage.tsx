import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui';

export function GiornataDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <PageHeader title="Dettaglio giornata" subtitle={`Giornata ${id}`} />
      <div className="glass p-6 text-slate-400">In arrivo nel prossimo task.</div>
    </div>
  );
}
