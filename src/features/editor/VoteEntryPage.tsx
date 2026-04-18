import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui';

export function VoteEntryPage() {
  const { giornataId, sezioneId } = useParams();
  return (
    <div>
      <PageHeader
        title="Inserimento voti"
        subtitle={`Sezione ${sezioneId ?? ''} · Giornata ${giornataId ?? ''}`}
      />
      <div className="glass p-6 text-slate-400">In arrivo nel prossimo task.</div>
    </div>
  );
}
