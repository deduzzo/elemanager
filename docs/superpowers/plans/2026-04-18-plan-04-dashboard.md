# Plan 04 — Viewer Dashboard

**Goal:** Dashboard realtime con KPI, charts per lista/candidato, copertura sezioni, e proiezioni statistiche (linear extrapolation sui voti raccolti).

**Tech:** Recharts, TanStack Query + realtime esistente.

**Prerequisiti:** Plan 03 completato.

## UX

- Route `/dashboard` accessibile a tutti i ruoli (admin/editor/viewer).
- Filtro top: giornata (select) + elezione (select, dipende da giornata).
- **KPI cards (4)**:
  - Sezioni totali / coperte (submitted+verified) con progress bar + %
  - Schede totali scrutinate
  - Voti per lista top 1
  - Voti preferenza top 1 con nome candidato
- **Charts**:
  - Bar chart orizzontale: voti per lista (tutte)
  - Bar chart top 10 candidati per preferenze
- **Proiezioni**:
  - Card "Proiezione finale" che estrapola linearmente i voti di ogni lista in base alle sezioni coperte: `voti_proj_lista = voti_attuali * (sezioni_totali / sezioni_coperte)`.
  - Fallback: "Proiezione non disponibile: almeno 10% di sezioni devono essere coperte".
- **Realtime**: dashboard si aggiorna live via le query hooks esistenti (hanno useRealtimeTable).
- **Sezioni mancanti**: lista pilloline con i numeri sezione non coperte (max 20 visibili + "+N altre").

## File Structure

```
src/
├── lib/aggregates.ts                        # pure funcs di calcolo
├── features/dashboard/
│   ├── DashboardPage.tsx
│   ├── KpiCards.tsx
│   ├── VotiListaChart.tsx
│   ├── TopCandidatiChart.tsx
│   ├── ProiezioneCard.tsx
│   └── CopertuaCard.tsx
```

## Task 1 — aggregates.ts + chart components

**File**: `src/lib/aggregates.ts` (pure functions, 100% testabili).

Exports:
- `type Copertura = { totali: number; coperte: number; pct: number; mancanti: number[] }`
- `type AggregatiElezione = { totaliSchede: { totali, bianche, nulle, contestate }; votiPerLista: Array<{lista_id, nome, voti, pct}>; preferenzePerCandidato: Array<{candidato_id, nome, cognome, lista_id, voti}>; topLista: ...; topCandidato: ... }`
- `function computeCopertura(sezioni, risultati, elezioneId)` — quante sezioni hanno risultato in stato submitted|verified per quella elezione.
- `function computeAggregati(liste, candidati, risultati, votiLista, preferenze)` — raccoglie i risultati dell'elezione, somma voti_lista per lista_id, somma preferenze per candidato_id.
- `function computeProiezione(aggregati, copertura)` — se copertura.pct < 10 return null, else scale linearmente.

Test:
- `src/lib/aggregates.test.ts` con dati sintetici.

**Steps:**
- [ ] 1. `npm install recharts` (se non già presente).
- [ ] 2. Implementa aggregates.ts + test.
- [ ] 3. `npm run test:run` → verifica pass (nuovi test incluso).
- [ ] 4. Commit.

## Task 2 — DashboardPage + chart components

Implementa la UI.

**DashboardPage**:
- Fetch: `useGiornate`, `useElezioniByGiornata(selectedGiornata)`, `useSezioniByGiornata`, `useListeByElezione(selectedElezione)`, `useCandidatiByLista` (for each lista), `useRisultatiByGiornata`, `useVotiListaByRisultato` + `usePreferenzeByRisultato` (per risultato)
- Compute aggregates tramite `aggregates.ts`
- Layout: filter bar + 4 KPI cards (grid 2×2 mobile, 4 col desktop) + sezione charts + proiezione card

**Componenti chart con Recharts**:
- `VotiListaChart`: `<BarChart layout="vertical" data={votiPerLista}>` con `Bar dataKey="voti"` colore `url(#neon)` linearGradient 0°, XAxis hide, YAxis dataKey nome.
- `TopCandidatiChart`: top 10 preferenze, bar verticale.

**Steps:**
- [ ] 1. Implementa KpiCards, VotiListaChart, TopCandidatiChart, ProiezioneCard, CopertuaCard.
- [ ] 2. Implementa DashboardPage con orchestrazione.
- [ ] 3. Aggiorna routing se serve (/dashboard è già registrato in BottomNav, ma manca la route — aggiungila dentro AppShell).
- [ ] 4. tsc + build + test ok.
- [ ] 5. Commit.

## Task 3 — Verifica finale + tag

- [ ] Docker rebuild e push.
- [ ] Tag `plan-04-dashboard-complete`.
