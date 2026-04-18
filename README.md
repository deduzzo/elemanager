# Elemanager

Web app PWA mobile-first per la raccolta **ufficiosa** dei risultati elettorali, con gestione voti reali per sezione, confronto voti presunti vs reali, mappa, foto pannelli e proiezioni.

**Primo deploy target**: elezioni comunali Messina 2026 (31 sezioni da open data).

## Stack

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (design dark/futuristico, glassmorphism) + PWA
- **Backend**: Supabase self-hosted (Postgres + Auth + Storage + Realtime)
- **Mappa**: Leaflet + OpenStreetMap
- **Charts**: Recharts
- **Testing**: Vitest + Playwright

## Ruoli

- **Admin** — configura elezioni, invita utenti, CRUD totale, audit log
- **Editor** — inserisce voti reali per sezione (modifica solo i propri, admin sovrascrive)
- **Viewer** — dashboard aggregati, niente voti presunti

## Stato

🚧 Fase 1 (MVP core) — in sviluppo.

Vedi [docs/superpowers/specs/](docs/superpowers/specs/) per design e roadmap.

## Licenza

TBD (verosimilmente AGPL o MIT).
