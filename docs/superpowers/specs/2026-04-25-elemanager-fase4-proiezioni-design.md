# Elemanager — Fase 4: Statistiche avanzate + Proiezioni

**Data**: 2026-04-25
**Autore**: Roberto De Domenico + Claude
**Status**: Draft in review
**Riferimenti**:
- `docs/superpowers/specs/2026-04-18-elemanager-mvp-fase1-design.md` (roadmap)
- `docs/superpowers/specs/2026-04-23-elemanager-fase3-voti-presunti-design.md` (Fase 3)

## Obiettivo

Fornire all'admin un cruscotto avanzato di **proiezioni statistiche** del risultato finale, basate sulla copertura parziale delle sezioni. Pagina `/admin/proiezioni` con header KPI di copertura, proiezione liste, proiezione candidati, vista sezioni mancanti, matrice circoscrizione × lista, ed export CSV.

I valori si aggiornano in tempo reale man mano che gli editor chiudono nuove sezioni.

## Non-goal

- Non sostituisce le proiezioni ufficiali del Ministero/Comune.
- Non include export PDF (rimandato a futuro).
- Non usa i voti presunti (Fase 3) per la proiezione — variante "ibrida" rimandata.
- Non confronta proiezioni nel tempo (T1 vs T2) — feature autonoma.
- Non duplica i KPI base già presenti su `/dashboard` (viewer-facing).

## Decisioni chiave (brainstorming)

1. **Algoritmo proiezione** → pesata per **circoscrizione** (campo `sezioni.circoscrizione`), con **fallback** alla media globale per circoscrizioni con 0 sezioni coperte.
2. **Visibilità** → **solo admin** (`/admin/proiezioni`). I viewer continuano a vedere solo `/dashboard` con i totali grezzi.
3. **Widget inclusi** (tutti i 6, senza PDF):
   1. Header KPI (copertura globale + per circoscrizione).
   2. Bar chart proiezione liste con bande di confidenza.
   3. Top 10 candidati per preferenze proiettate.
   4. Sezioni mancanti raggruppate per circoscrizione.
   5. Matrice circoscrizione × lista (voti reali vs proiezione).
   6. Export CSV (3 file separati).

## Algoritmo di proiezione

### Variabili

Tutto il calcolo è scopato all'**elezione selezionata** (filtro UI). Le sezioni appartengono però alla giornata: lo stesso insieme di sezioni vale per tutte le elezioni della giornata.

Per ogni circoscrizione `C` (intero da `sezioni.circoscrizione`; sezioni con valore `null` raggruppate come circoscrizione `0`):
- `total_C` = numero totale sezioni della **giornata corrente** appartenenti alla circoscrizione `C`.
- `coverage_C` = numero sezioni di `C` per le quali esiste un `risultati_sezione` per l'**elezione selezionata** in stato `submitted` o `verified`.

Per ogni lista `L` (di un'elezione fissa) e circoscrizione `C`:
- `voti_L_C` = somma `voti_lista.voti` per la coppia `(L, sezione)` con sezione in `C` e risultato_sezione contato (stato submitted/verified).

### Proiezione per circoscrizione

```
se coverage_C > 0:
  proiezione_L_C = voti_L_C × (total_C / coverage_C)
altrimenti se coverage_globale > 0:
  voti_L_globale = sum_C voti_L_C
  media_per_sezione_globale = voti_L_globale / coverage_globale
  proiezione_L_C = media_per_sezione_globale × total_C
altrimenti:
  proiezione_L_C = 0    # niente coperto da nessuna parte
```

Proiezione totale: `proiezione_L = Σ_C proiezione_L_C`.

### Banda di confidenza

Per ogni lista `L`, calcoliamo la deviazione standard relativa della quota voti per circoscrizione coperta:

1. Per ogni circoscrizione coperta `C`: quota_L_C = voti_L_C / total_voti_C (somma `voti_lista` di tutte le liste in C, sezioni coperte).
2. σ_relativa = stddev (popolazione) delle quota_L_C.
3. Banda = `proiezione_L × (1 ± σ_relativa)`, clampata a 0.
4. Edge case: se circoscrizioni coperte ≤ 1, banda = ±15% (default conservativo dichiarato in UI).

### Proiezione candidati

Identica struttura della proiezione liste, sostituendo `voti_lista` con `preferenze_candidato`. Top 10 ordinati per `proiezione_candidato` decrescente.

### Caso elezione senza circoscrizioni

Se l'elezione coinvolge tutte le sezioni della giornata e nessuna ha campo `circoscrizione` valorizzato, l'algoritmo degenera correttamente alla proiezione lineare globale (caso "tutto una circoscrizione"). Nessun trattamento speciale necessario.

## UX della pagina `/admin/proiezioni`

Pagina single-page (scroll), accesso admin-only.

### Filtro elezione (sticky in alto)

Select Giornata + Select Elezione con stessi default delle altre pagine admin (giornata `stato='open'` se presente, prima elezione della giornata).

### 1. Header KPI

Card glass:
- **Copertura globale**: `X / Y sezioni` + badge progress bar percentuale.
- **Sezioni coperte per circoscrizione**: tabellina compatta con righe `Circoscrizione N | x/y sezioni | %` (badge colorato verde >80% / giallo 50-80% / rosso <50%).
- **Ultimo aggiornamento**: timestamp relativo (es. "2 minuti fa") + nome dell'utente che ha submitted l'ultima sezione.

### 2. Proiezione liste — bar chart

Recharts horizontal `BarChart`:
- Una barra per lista, ordinata per `proiezione_lista` decrescente.
- Etichetta sulla barra: `proiezione (% sul totale)`.
- Banda di confidenza overlay come `ErrorBar` Recharts (fattori min/max).
- Tooltip con: voti reali, proiezione, banda min/max.

### 3. Top 10 candidati — tabella

Colonne: posizione, candidato, lista, preferenze reali, proiezione (numero), banda. Sorted by proiezione desc, primi 10 mostrati. Toggle "mostra tutti" espande la lista completa.

### 4. Sezioni mancanti — lista

Sezioni con `risultati_sezione` per l'elezione selezionata in stato ≠ submitted/verified, oppure assenti. Raggruppate per circoscrizione (header: numero circoscrizione + badge colore copertura). Per ogni sezione: numero + indirizzo + ubicazione + stato (`draft` / "in attesa"). Click → naviga a `/admin/sezioni` (vista esistente).

### 5. Matrice circoscrizione × lista

Tabella read-only:
- Righe: una per circoscrizione + riga "Totale".
- Colonne: una per lista + colonna "Totale".
- Cella: `voti_reali / proiezione` con micro barra di copertura inline (% reale sulla proiezione).
- Header colore copertura sulla riga circoscrizione.

### 6. Export CSV

Tre bottoni allineati in fondo alla pagina:
- "Export proiezione liste (CSV)" → `proiezione_liste.csv`: nome_lista, voti_reali, proiezione, banda_min, banda_max, percentuale_su_totale_proiettato.
- "Export proiezione candidati (CSV)" → `proiezione_candidati.csv`: cognome, nome, lista, preferenze_reali, proiezione, banda_min, banda_max.
- "Export sezioni mancanti (CSV)" → `sezioni_mancanti.csv`: numero, indirizzo, ubicazione, circoscrizione, stato.

Generazione client-side con `papaparse.unparse`. Download via `Blob` URL e tag `<a download>`.

## Architettura frontend

```
src/features/admin/proiezioni/
├── ProiezioniPage.tsx                  # /admin/proiezioni
├── proiezioni.ts                       # pure functions (test)
├── proiezioni.test.ts                  # unit test ≥ 10 casi
└── components/
    ├── KPIHeader.tsx
    ├── ProiezioneListeChart.tsx
    ├── ProiezioneCandidatiTop.tsx
    ├── SezioniMancantiList.tsx
    ├── MatriceCircoscrizioneListe.tsx
    └── ExportCsvButtons.tsx

src/lib/queries/
└── proiezioni.ts                       # useProiezioniData(elezioneId): bundle hook
```

### Hook bundle

`useProiezioniData(elezioneId)` orchestrato con `useQueries` per fetch parallele di:
- `liste` per elezione,
- `candidati` per ogni lista (`useQueries`),
- `sezioni` per giornata,
- `risultati_sezione` per elezione,
- `voti_lista` per i risultati ottenuti,
- `preferenze_candidato` per i risultati ottenuti.

Realtime invalidation via `useRealtimeTable` su `risultati_sezione`, `voti_lista`, `preferenze_candidato`, `sezioni`. Ritorna `{ liste, candidati, sezioni, risultati, votiLista, preferenze, isLoading }`.

### Pure functions in `proiezioni.ts`

```typescript
type CoperturaCircoscrizione = { circoscrizione: number; coverage: number; total: number };

coperturePerCircoscrizione(input): CoperturaCircoscrizione[]
proiezioneListe(input): ProiezioneLista[]      // include banda di confidenza
proiezioneCandidati(input): ProiezioneCandidato[]
sezioniMancanti(input): SezioneMancante[]
matriceCircoscrizioneListe(input): MatriceRow[] // righe per circoscrizione + colonna per lista
```

Tutte deterministiche, no IO, no React. Sezioni con `circoscrizione === null` sono raggruppate come circoscrizione `0`.

### CSV utility

`buildCsv<T>(rows: T[], columns: Column<T>[]): string` riusa `papaparse.unparse`. `triggerDownload(csv: string, filename: string)` crea Blob e click programmatico — coerente col pattern usato nei progetti React standard.

## Routing e menu

- Aggiungere `/admin/proiezioni` in `src/app/router.tsx`.
- Voce "Proiezioni" in `src/features/admin/AdminLayout.tsx` (dopo "Confronto", prima di "Audit").
- Card in `src/features/admin/AdminIndexPage.tsx` con descrizione "Proiezione risultato finale pesata per circoscrizione + export CSV".

Visibilità admin-only via il routing già protetto (`<ProtectedRoute allow={['admin']}>`). Nessun cambiamento RLS — tutti i dati sono già accessibili agli admin.

## Testing

### Unit (Vitest) — `proiezioni.test.ts`

- Almeno 10 casi:
  1. Una sola circoscrizione, 5/10 sezioni coperte, lista con 100 voti → proiezione 200.
  2. Due circoscrizioni eterogenee → proiezione = somma proiezioni per C.
  3. Circoscrizione con 0 sezioni coperte → fallback alla media globale.
  4. Coverage globale 0 → tutte le proiezioni 0.
  5. Sezioni con `circoscrizione = null` raggruppate come 0 e proiettate correttamente.
  6. Banda di confidenza con N=1 circoscrizione coperta → ±15% default.
  7. Banda di confidenza con N=3 → calcolata da σ relativa.
  8. Sezioni mancanti esclude submitted e verified.
  9. Sezioni mancanti include sezioni senza `risultati_sezione`.
  10. Matrice circoscrizione × lista: somma per riga uguaglia totale lista, somma per colonna uguaglia totale circoscrizione.

### CSV — `csvExport.test.ts`

- 1 test per ognuno dei 3 export: header + N righe attese + separatore virgola + escape per virgolette.

### E2E smoke (Playwright)

- Admin apre `/admin/proiezioni` → vede header KPI, bar chart liste, tabella candidati, sezioni mancanti, matrice, 3 bottoni CSV.
- Editor e viewer NON vedono la voce di menu "Proiezioni".

## Sicurezza

- Pagina protetta da `<ProtectedRoute allow={['admin']}>` (pattern già usato per `/admin/*`).
- Nessun nuovo dato sensibile esposto: tutto deriva da tabelle già accessibili agli admin via RLS esistenti.
- Export CSV: client-side, nessun upload a terze parti.

## Metriche di successo Fase 4

- Admin apre `/admin/proiezioni` e vede proiezione completa in < 2 secondi su 4G con 31 sezioni.
- Proiezione si aggiorna in < 2 secondi quando un editor `submitted` una sezione (realtime).
- Export CSV genera file scaricabili senza errori per le 3 viste.
- Unit test ≥ 10 con coverage ≥ 80% su `proiezioni.ts`.

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Sezioni con `circoscrizione = null` falsano la proiezione | Medio | Raggruppate come 0; copy UI lo dichiara ("Circoscrizione 0 = non assegnata"). |
| Sezioni 31 sono tutte in 1 circoscrizione → fallback globale degenerato | Basso | L'algoritmo si comporta correttamente come proiezione lineare. |
| Banda di confidenza con poca copertura è instabile | Medio | Default ±15% per N≤1 circoscrizione coperta; tooltip esplicativo. |
| Performance: useQueries con N candidati = 1 query per lista | Basso | N liste tipico 1-10; cache TanStack Query taglia il costo. |
| User confonde proiezione con risultato reale | Alto | Etichette UI esplicite "Proiezione (stima)" e disclaimer in header pagina. |

## Deliverable Fase 4

1. Pure functions + unit test ≥ 10 casi.
2. Hook bundle `useProiezioniData` con realtime.
3. Pagina `/admin/proiezioni` con i 6 widget.
4. CSV export client-side per i 3 file.
5. Aggiornamento routing + menu admin + card index.
6. E2E smoke test (skip se env mancante).
7. Aggiornamento `README.md` sezione Fase 4.

## Fuori scope Fase 4 (per chiarezza)

- Export PDF.
- Proiezioni ibride con voti presunti.
- Confronto proiezioni nel tempo (T1 vs T2).
- Notifiche push su scostamenti significativi.
- Vista mobile-friendly dedicata: la pagina è desktop-first, mobile usabile ma non ottimizzato.
