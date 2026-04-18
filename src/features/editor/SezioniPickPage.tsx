import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui';

export function SezioniPickPage() {
  const { giornataId } = useParams();
  return (
    <div>
      <PageHeader title="Sezioni" subtitle={`Giornata ${giornataId ?? ''}`} />
      <div className="glass p-6 text-slate-400">In arrivo nel prossimo task.</div>
    </div>
  );
}
