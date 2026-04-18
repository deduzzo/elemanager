import { ChangeEvent, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Button, useToast } from '@/components/ui';
import { useBulkUpsertSezioni } from '@/lib/queries/sezioni';
import type { SezioneInsert } from '@/lib/database.types';

const COLONNE_RICHIESTE = [
  'sezione',
  'indirizzo',
  'ubicazione',
  'lat',
  'long',
  'circoscrizione',
] as const;

interface UploadCsvSectionProps {
  giornataId: string;
}

/** Mappa una singola riga CSV in SezioneInsert (con filtraggio a livello caller). */
function mapRowToSezione(
  row: Record<string, string>,
  giornataId: string,
): SezioneInsert | null {
  const numero = parseInt(row.sezione ?? '', 10);
  if (!numero) return null;

  const lat = parseFloat(row.lat ?? '');
  const lng = parseFloat(row.long ?? '');
  const circoscrizione = parseInt(row.circoscrizione ?? '', 10);

  return {
    giornata_id: giornataId,
    numero,
    indirizzo: row.indirizzo?.trim() || null,
    ubicazione: row.ubicazione?.trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    circoscrizione: Number.isFinite(circoscrizione) ? circoscrizione : null,
    note: row.note?.trim() || null,
    accessibilita: row.accessibilita?.trim() || null,
  };
}

export function UploadCsvSection({ giornataId }: UploadCsvSectionProps) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SezioneInsert[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const bulkUpsert = useBulkUpsertSezioni();

  const resetState = () => {
    setRows([]);
    setTotalParsed(0);
    setMissingCols([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setMissingCols([]);
    setRows([]);
    setTotalParsed(0);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = (result.meta.fields ?? []).map((f) => f.trim());
        const missing = COLONNE_RICHIESTE.filter((c) => !fields.includes(c));
        if (missing.length > 0) {
          setMissingCols(missing);
          return;
        }
        const mapped = result.data
          .map((r) => mapRowToSezione(r, giornataId))
          .filter((r): r is SezioneInsert => r !== null);
        setRows(mapped);
        setTotalParsed(result.data.length);
      },
      error: (err) => {
        setParseError(err.message);
      },
    });
  };

  const handleImport = () => {
    if (rows.length === 0) return;
    bulkUpsert.mutate(
      { giornataId, rows },
      {
        onSuccess: (data) => {
          push(`Importate ${data.length} sezioni`, { type: 'success' });
          resetState();
        },
        onError: (err) => {
          push(`Errore import: ${(err as Error).message}`, { type: 'error' });
        },
      },
    );
  };

  const preview = rows.slice(0, 10);

  return (
    <div className="glass p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Import CSV</h3>
        <p className="text-sm text-slate-400 mt-1">
          Formato atteso: colonne{' '}
          <code className="text-neon-cyan">
            sezione,indirizzo,ubicazione,lat,long,circoscrizione,note,accessibilita
          </code>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          File CSV
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-300
            file:mr-4 file:py-2 file:px-4
            file:rounded-xl file:border-0
            file:text-sm file:font-medium
            file:bg-white/10 file:text-slate-100
            hover:file:bg-white/15 file:cursor-pointer
            cursor-pointer"
        />
      </div>

      {parseError && (
        <div className="glass border border-neon-pink/40 p-3 text-sm text-neon-pink">
          Errore parsing: {parseError}
        </div>
      )}

      {missingCols.length > 0 && (
        <div className="glass border border-neon-pink/40 p-3 text-sm text-neon-pink">
          <p className="font-semibold mb-1">Colonne mancanti nel CSV:</p>
          <ul className="list-disc list-inside">
            {missingCols.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {totalParsed} righe parsed · {rows.length} valide
              {totalParsed !== rows.length && (
                <span className="text-neon-pink">
                  {' '}
                  ({totalParsed - rows.length} scartate senza numero sezione)
                </span>
              )}
            </div>
            <Button
              onClick={handleImport}
              disabled={bulkUpsert.isPending}
            >
              {bulkUpsert.isPending
                ? 'Import in corso...'
                : `Importa ${rows.length} sezioni`}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2 px-2">Sezione</th>
                  <th className="py-2 px-2">Ubicazione</th>
                  <th className="py-2 px-2">Indirizzo</th>
                  <th className="py-2 px-2">Lat</th>
                  <th className="py-2 px-2">Lng</th>
                  <th className="py-2 px-2">Circ.</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 text-slate-200"
                  >
                    <td className="py-1 px-2 font-mono">{r.numero}</td>
                    <td className="py-1 px-2">{r.ubicazione ?? '-'}</td>
                    <td className="py-1 px-2">{r.indirizzo ?? '-'}</td>
                    <td className="py-1 px-2 font-mono">
                      {r.lat?.toFixed(4) ?? '-'}
                    </td>
                    <td className="py-1 px-2 font-mono">
                      {r.lng?.toFixed(4) ?? '-'}
                    </td>
                    <td className="py-1 px-2">{r.circoscrizione ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="text-xs text-slate-500 mt-2">
                Mostrate le prime 10 di {rows.length} righe
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
