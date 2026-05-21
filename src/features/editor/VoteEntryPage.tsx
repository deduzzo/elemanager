import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui';
import { useGiornata } from '@/lib/queries/giornate';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { VoteEntryForm } from './VoteEntryForm';

export function VoteEntryPage() {
  const { giornataId, sezioneId } = useParams<{ giornataId: string; sezioneId: string }>();
  const { data: giornata, isLoading: lg } = useGiornata(giornataId);
  const { data: sezioni, isLoading: ls } = useSezioniByGiornata(giornataId);
  const { data: elezioni, isLoading: le } = useElezioniByGiornata(giornataId);

  if (lg || ls || le) return <div className="p-6 text-slate-400">Caricamento…</div>;
  if (!giornata || !giornataId || !sezioneId) {
    return <div className="p-6 glass">Giornata o sezione non trovata.</div>;
  }

  const sezione = sezioni?.find((s) => s.id === sezioneId);
  if (!sezione) return <div className="p-6 glass">Sezione non trovata in questa giornata.</div>;
  if (!elezioni || elezioni.length === 0) {
    return (
      <div className="space-y-3">
        <Link to={`/app/editor/giornate/${giornataId}`} className="text-neon-cyan text-sm">
          ← Torna alle sezioni
        </Link>
        <PageHeader
          title={`Sezione ${sezione.numero}`}
          subtitle={sezione.ubicazione ?? sezione.indirizzo ?? ''}
        />
        <div className="glass p-6 text-slate-400">
          Nessuna elezione configurata in questa giornata. Admin deve aggiungerle.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link to={`/app/editor/giornate/${giornataId}`} className="text-neon-cyan text-sm">
        ← Torna alle sezioni
      </Link>
      <PageHeader
        title={`Sezione ${sezione.numero}`}
        subtitle={`${sezione.ubicazione ?? ''} · ${sezione.indirizzo ?? ''}`}
      />
      <VoteEntryForm sezione={sezione} elezioni={elezioni} />
    </div>
  );
}
