import { Button } from '@/components/ui';
import {
  buildCandidatiCsv,
  buildListeCsv,
  buildSezioniMancantiCsv,
  triggerCsvDownload,
} from '../csvExport';
import type {
  ProiezioneCandidato,
  ProiezioneLista,
  SezioneMancante,
} from '../proiezioni';

export function ExportCsvButtons({
  liste,
  candidati,
  sezioni,
  listeNomeById,
}: {
  liste: ProiezioneLista[];
  candidati: ProiezioneCandidato[];
  sezioni: SezioneMancante[];
  listeNomeById: Map<string, string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="glass p-4 rounded-2xl flex flex-wrap gap-2">
      <Button
        variant="ghost"
        onClick={() => triggerCsvDownload(buildListeCsv(liste), `proiezione_liste_${today}.csv`)}
        disabled={liste.length === 0}
      >
        Export liste CSV
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          triggerCsvDownload(buildCandidatiCsv(candidati, listeNomeById), `proiezione_candidati_${today}.csv`)
        }
        disabled={candidati.length === 0}
      >
        Export candidati CSV
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          triggerCsvDownload(buildSezioniMancantiCsv(sezioni), `sezioni_mancanti_${today}.csv`)
        }
        disabled={sezioni.length === 0}
      >
        Export sezioni mancanti CSV
      </Button>
    </div>
  );
}
