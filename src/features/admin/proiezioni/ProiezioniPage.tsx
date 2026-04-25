import { useMemo, useState } from 'react';
import { PageHeader, Select, Skeleton } from '@/components/ui';
import { useGiornate } from '@/lib/queries/giornate';
import { useElezioniByGiornata } from '@/lib/queries/elezioni';
import { useProiezioniData } from '@/lib/queries/proiezioni';
import {
  coperturePerCircoscrizione,
  matriceCircoscrizioneListe,
  proiezioneCandidati,
  proiezioneListe,
  sezioniMancanti,
} from './proiezioni';
import { KPIHeader } from './components/KPIHeader';
import { ProiezioneListeChart } from './components/ProiezioneListeChart';
import { ProiezioneCandidatiTop } from './components/ProiezioneCandidatiTop';
import { SezioniMancantiList } from './components/SezioniMancantiList';
import { MatriceCircoscrizioneListe } from './components/MatriceCircoscrizioneListe';
import { ExportCsvButtons } from './components/ExportCsvButtons';

const itTime = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

export function ProiezioniPage() {
  const { data: giornate = [] } = useGiornate();
  const [giornataId, setGiornataId] = useState<string>('');
  const giornataAttiva = giornate.find((g) => g.stato === 'open') ?? giornate[0];
  const selectedGiornataId = giornataId || giornataAttiva?.id || '';

  const { data: elezioni = [] } = useElezioniByGiornata(selectedGiornataId || undefined);
  const [elezioneId, setElezioneId] = useState<string>('');
  const selectedElezioneId = elezioneId || elezioni[0]?.id || '';

  const bundle = useProiezioniData(selectedGiornataId || undefined, selectedElezioneId || undefined);

  const coperture = useMemo(
    () =>
      coperturePerCircoscrizione({
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        elezioneId: selectedElezioneId,
      }),
    [bundle.sezioni, bundle.risultati, selectedElezioneId],
  );

  const proiListe = useMemo(
    () =>
      proiezioneListe({
        liste: bundle.liste,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        votiLista: bundle.votiLista,
        elezioneId: selectedElezioneId,
      }),
    [bundle.liste, bundle.sezioni, bundle.risultati, bundle.votiLista, selectedElezioneId],
  );

  const proiCand = useMemo(
    () =>
      proiezioneCandidati({
        candidati: bundle.candidati,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        preferenze: bundle.preferenze,
        elezioneId: selectedElezioneId,
      }),
    [bundle.candidati, bundle.sezioni, bundle.risultati, bundle.preferenze, selectedElezioneId],
  );

  const mancanti = useMemo(
    () =>
      sezioniMancanti({
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        elezioneId: selectedElezioneId,
      }),
    [bundle.sezioni, bundle.risultati, selectedElezioneId],
  );

  const matrice = useMemo(
    () =>
      matriceCircoscrizioneListe({
        liste: bundle.liste,
        sezioni: bundle.sezioni,
        risultatiSezione: bundle.risultati,
        votiLista: bundle.votiLista,
        elezioneId: selectedElezioneId,
      }),
    [bundle.liste, bundle.sezioni, bundle.risultati, bundle.votiLista, selectedElezioneId],
  );

  const listeNomeById = useMemo(
    () => new Map(bundle.liste.map((l) => [l.id, l.nome])),
    [bundle.liste],
  );

  // Ultimo aggiornamento dal risultati submitted/verified più recente
  const ultimoUpdate = useMemo(() => {
    const counted = bundle.risultati.filter(
      (r) => r.elezione_id === selectedElezioneId && (r.stato === 'submitted' || r.stato === 'verified'),
    );
    if (counted.length === 0) return null;
    const latest = counted.reduce((a, b) =>
      new Date(b.updated_at) > new Date(a.updated_at) ? b : a,
    );
    return {
      when: itTime.format(new Date(latest.updated_at)),
      who: latest.updated_by ?? '—',
    };
  }, [bundle.risultati, selectedElezioneId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proiezioni"
        subtitle="Stima del risultato finale pesata per circoscrizione (admin only). I valori marcati 'proiezione' sono stime, non risultati definitivi."
      />

      <div className="flex flex-wrap gap-3 glass p-3 rounded-2xl">
        <Select
          label="Giornata"
          value={selectedGiornataId}
          onChange={(e) => {
            setGiornataId(e.target.value);
            setElezioneId('');
          }}
        >
          {giornate.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Elezione"
          value={selectedElezioneId}
          onChange={(e) => setElezioneId(e.target.value)}
        >
          {elezioni.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      {!selectedElezioneId ? (
        <div className="glass p-6 rounded-2xl text-slate-300">
          Seleziona giornata ed elezione per vedere le proiezioni.
        </div>
      ) : bundle.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <KPIHeader coperture={coperture} ultimoUpdate={ultimoUpdate} />
          <ProiezioneListeChart rows={proiListe} />
          <ProiezioneCandidatiTop rows={proiCand} listeNomeById={listeNomeById} />
          <SezioniMancantiList sezioni={mancanti} coperture={coperture} />
          <MatriceCircoscrizioneListe rows={matrice} liste={bundle.liste} />
          <ExportCsvButtons
            liste={proiListe}
            candidati={proiCand}
            sezioni={mancanti}
            listeNomeById={listeNomeById}
          />
        </>
      )}
    </div>
  );
}
