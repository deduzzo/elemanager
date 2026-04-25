import { describe, it, expect } from 'vitest';
import { coperturePerCircoscrizione } from './proiezioni';
import type {
  RisultatoSezioneRow,
  SezioneRow,
} from '@/lib/database.types';

const sez = (
  id: string,
  numero: number,
  circoscrizione: number | null,
  giornata_id = 'g1',
): SezioneRow => ({
  id,
  giornata_id,
  numero,
  indirizzo: null,
  ubicazione: null,
  lat: null,
  lng: null,
  circoscrizione,
  note: null,
  accessibilita: null,
});

const rs = (overrides: Partial<RisultatoSezioneRow>): RisultatoSezioneRow => ({
  id: overrides.id ?? 'rs',
  sezione_id: overrides.sezione_id ?? 'sez',
  elezione_id: overrides.elezione_id ?? 'el1',
  schede_totali: null,
  schede_bianche: null,
  schede_nulle: null,
  schede_contestate: null,
  stato: overrides.stato ?? 'submitted',
  created_by: null,
  updated_by: null,
  created_at: '2026-04-25T00:00:00Z',
  updated_at: '2026-04-25T00:00:00Z',
});

describe('coperturePerCircoscrizione', () => {
  it('raggruppa sezioni per circoscrizione e calcola coverage e total', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1), sez('s2', 2, 1), sez('s3', 3, 2)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted' }),
        rs({ id: 'r2', sezione_id: 's3', stato: 'verified' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([
      { circoscrizione: 1, total: 2, coverage: 1 },
      { circoscrizione: 2, total: 1, coverage: 1 },
    ]);
  });

  it('sezioni con circoscrizione null sono raggruppate come 0', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, null), sez('s2', 2, null), sez('s3', 3, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([
      { circoscrizione: 0, total: 2, coverage: 1 },
      { circoscrizione: 1, total: 1, coverage: 0 },
    ]);
  });

  it('ignora risultati di altre elezioni', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'submitted', elezione_id: 'altra' }),
      ],
      elezioneId: 'el1',
    });
    expect(result).toEqual([{ circoscrizione: 1, total: 1, coverage: 0 }]);
  });

  it('ignora risultati in stato draft', () => {
    const result = coperturePerCircoscrizione({
      sezioni: [sez('s1', 1, 1)],
      risultatiSezione: [
        rs({ id: 'r1', sezione_id: 's1', stato: 'draft' }),
      ],
      elezioneId: 'el1',
    });
    expect(result[0].coverage).toBe(0);
  });
});
