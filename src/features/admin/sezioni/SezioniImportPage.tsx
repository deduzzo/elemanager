import { useState } from 'react';
import { PageHeader, Select } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useSezioniByGiornata } from '@/lib/queries/sezioni';
import { UploadCsvSection } from './UploadCsvSection';
import { MappaSezioni } from './MappaSezioni';

export function SezioniImportPage() {
  const { data: giornate, isLoading: giornateLoading } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const { data: sezioni } = useSezioniByGiornata(giornataId || undefined);

  const giornateList = giornate ?? [];
  const sezioniList = sezioni ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sezioni"
        subtitle="Import CSV e visualizzazione su mappa"
      />

      <div className="glass p-5">
        {giornateLoading ? (
          <p className="text-sm text-slate-400">Caricamento giornate...</p>
        ) : giornateList.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessuna giornata disponibile. Crea prima una giornata in{' '}
            <code>/admin/giornate</code>.
          </p>
        ) : (
          <Select
            label="Giornata target"
            value={giornataId}
            onChange={(e) => setGiornataId(e.target.value)}
          >
            <option value="">— Seleziona una giornata —</option>
            {giornateList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome} ({g.data})
              </option>
            ))}
          </Select>
        )}
      </div>

      {giornataId && <UploadCsvSection giornataId={giornataId} />}

      {giornataId && sezioniList.length > 0 && (
        <div className="glass p-5 space-y-3">
          <h3 className="text-lg font-semibold text-slate-100">
            Mappa sezioni ({sezioniList.length})
          </h3>
          <MappaSezioni sezioni={sezioniList} />
        </div>
      )}
    </div>
  );
}
