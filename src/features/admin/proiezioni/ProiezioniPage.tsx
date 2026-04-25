import { PageHeader } from '@/components/ui';

export function ProiezioniPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Proiezioni"
        subtitle="Stime di risultato basate sullo spoglio in corso (solo admin)."
      />
      <div className="glass-strong p-6 rounded-2xl text-slate-300">
        <p className="text-sm">
          Lavori in corso. Questa pagina mostrera' le proiezioni dei risultati
          calcolate a partire dai voti reali gia' inseriti, con scaling sulle
          sezioni mancanti e intervalli di confidenza.
        </p>
      </div>
    </div>
  );
}
