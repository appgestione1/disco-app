# disco-app — Stato del Progetto

> Questo file è la fonte di verità del progetto per Claude Code.
> Aggiornarlo e committarlo ogni volta che lo stato cambia significativamente.
> **Ultimo aggiornamento: 04/05/2026 — commit `8325fe2`**

---

## Cos'è

Webapp gestionale per eventi/discoteca — portale eventi locale per Catania e provincia.
Obiettivo: gestire serate, prenotazioni lista/privé, scanner ingresso, dashboard PR, e mostrare cinema/concerti/teatro locali.

**Deploy:** Vercel — repo `appgestione1/disco-app`, branch `main`
**Dev server:** `npm run dev -- --host` → `http://192.168.1.86:5173` dal cellulare/tablet

---

## Stack

- React 19, Vite, Tailwind CSS
- Firebase Firestore (database)
- lucide-react, qrcode.react, html2canvas, html5-qrcode
- GitHub Actions (scraper notturni)

---

## Route

| Path | Componente | Accesso |
|---|---|---|
| `/` | `Home.jsx` | Pubblico |
| `/scanner` | `Scanner` (in App.jsx) | Staff |
| `/pr/:prId` | `PRDashboard` (in App.jsx) | PR |
| `/admin-segreto-stefano` | `Admin.jsx` | Admin (7 click logo) |
| `/super-control-room` | `SuperAdmin.jsx` | SuperAdmin (7 click lucchetto + password "superadmin") |
| `/proponi-evento` | `SubmitEvent.jsx` | Pubblico |

---

## Sistema Multi-Admin (gruppi)

Ogni "gruppo" è un'organizzazione indipendente (es. una discoteca) con i propri PR, eventi e dati.

### Login Admin (`AdminLogin` in `Admin.jsx`)
- Schermata di login con **ID Gruppo** + **Password**
- Verifica contro Firestore collection `groups/{groupId}` → campo `password`
- Sessione salvata in `localStorage` come `adminGroup: { groupId, groupName, groupType }`
- Logout disponibile dal pannello

### Pannello Admin (`AdminPanel` in `Admin.jsx`)
Tab navigation con 4 sezioni (`activeTab`):
- **DATI LIVE** (`stats`) — ingressi live, conteggi per PR
- **TEAM PR** (`prs`) — gestione PR, pagamenti, contabilità
- **SERATE** (`events`) — gestione eventi
- **SPONSOR** (`sponsors`) — gestione sponsor

Tutti i dati sono **filtrati per `groupId`** (query Firestore con `where("groupId", "==", groupId)`).

Funzionalità chiave:
- Creazione/modifica eventi con upload immagine
- Gestione PR: aggiunta, sostituzione, pagamenti, azzeramento contabilità
- Password admin modificabile da Firestore (`settings/admin`)
- Gestione privé per evento
- QR code generazione per ogni PR
- MASTER PR creato automaticamente al momento della creazione del gruppo (`MASTER_{groupId}`)

### SuperAdmin (`SuperAdmin.jsx`)

Menu a tile (`activeView`): `null | 'events' | 'proposals' | 'settings' | 'stats' | 'groups'`
- **EVENTI** — toggle visibilità/privé + **elimina evento** per ogni evento
- **PROPOSTE** — accetta/rifiuta proposte evento esterni
- **IMPOSTAZIONI** — prezzo invio proposta evento (gratuito o a pagamento)
- **STATISTICHE** — dashboard analytics completo (vedi sezione Analytics)
- **GRUPPI** — gestione completa dei gruppi/organizzazioni:
  - Crea nuovo gruppo (id, nome, tipo, password) → crea anche MASTER PR automaticamente
  - Vedi lista PR per ogni gruppo
  - Imposta **commissioni per gruppo**: `perOrfano`, `perPR`, `perEvento`, `perQR` (€)
  - Mostra/nascondi password gruppo
  - Elimina gruppo

---

## Sezione Cinema (`Home.jsx`)

Griglia 2 colonne con locandine → click apre `FilmDetail`.

**Dati film:**
- TMDB `now_playing` → cache Firestore `external_events_cache/CINEMA_v4` (TTL 6h)
- Film locali (non su TMDB) → `showtimes/{today}`, enrichment TMDB search, cache in-memory sessione
- Merge: `[...tmdbFilms, ...localFilms]`

**FilmDetail per ogni cinema:**
- Selettore date (7 chip scorrevoli)
- Ordinamento cinema: Cinestar → The Space Belpasso → UCI → Eplanet Canalicchio → altri
- Orari: solo futuri per oggi, tutti per date future
- `"Fine programmazione odierna"` se orari passati o `[]` in Firestore
- `"Cerca Orari"` (Google) se cinema mai nel scraper (chiave assente)
- `"Acquista Biglietto"` attivo solo se il cinema ha orari disponibili
  - Link diretto al film: The Space (`/film/slug`), UCI
  - Link pagina cinema: Cinestar e altri

---

## Scraper Cinema (`scripts/scrape-showtimes.js`)

- **Fonte:** mymovies.it — 2 fetch parallele (provincia + città)
- Parsing HTML cheerio: `img[id^="imgSplash_"]` + `div.orari-dettaglio`
- TMDB enrichment: poster HD, trailer, descrizione
- Salva `showtimes/{date}` per oggi + 6 giorni
- Salva SEMPRE `showtimes[id]` anche se `[]` (tentato, nessuna programmazione)
- **GitHub Actions:** `scrape-showtimes.yml` → `0 5 * * *` (7:00 IT) + `workflow_dispatch`

### Mappatura MYmovies ID → ID interno

| MYmovies ID | ID interno |
|---|---|
| 5000 | politeamacaltagirone |
| 5004 | cinemaking |
| 5005 | eplanetlopo |
| 5006 | moderno |
| 5190 | eplanetariston |
| 5543 | spadaro |
| 5700 | artanis |
| 5877 | eden |
| 5997 | macherione |
| 6011 | cinemaplanet (Eplanet Canalicchio) |
| 6333 | centrale |
| 20036 | acireale |
| 20169 | thespaceetnapolis |
| 20562 | cinestar |
| 21433 | ucicentrosicilia |

**Cinema NON su MYmovies** (salvati come `[]`): eplanetaalfieri, garibaldi, rex, musmeci, trinacria, metropol

---

## Sezioni Concerti & Teatro (`Home.jsx`)

- Griglia 2 colonne, immagini 16:9, link pagina esterna
- Filtri: TUTTI / OGGI / DATA (chip scorrevoli giornalieri)
- Cache Firestore: `external_events_cache/CONCERTI_v4` e `TEATRO_v4` (TTL 26h)

**Scraper (`scripts/scrape-events.js`):**
- **Fonte principale: AWIN** — 4 partner: TicketOne, VivaTicket, Tiqets, IlTuoTicket
  - Parser XML con filtro geografico Sicilia
  - Categorizzazione automatica CONCERTI/TEATRO da titolo/categoria
  - Segreti AWIN su GitHub Actions: **da aggiungere quando arrivano i feed**
- **Fallback automatico: Eventbrite** se AWIN non configurato
- **Fallback secondario: Ticketmaster API** (`VITE_TICKETMASTER_API_KEY`, raggio 150km)
- **GitHub Actions:** `scrape-events.yml` → `30 5 * * *` (7:30 IT) + `workflow_dispatch`

---

## Analytics (`src/analytics.js`)

Tracking su Firestore + GA4 (`G-9XS7FT5ZV1`):
- Condivisioni per PR ref, categorie, film, prenotazioni, pageviews
- PWA installs, session duration

**Dashboard SuperAdmin → STATISTICHE:**
- Filtro periodo: OGGI / 7G / 30G / TOTALE
- KPI Sponsor Media Kit (utenti unici, pageviews, sessioni)
- PR Share Leaderboard
- Top film/categorie
- Trend 7 giorni (line charts, growth % badges, barre verticali con toggle)

---

## Firestore Collections

| Collection | Contenuto |
|---|---|
| `groups/{groupId}` | Gruppi/organizzazioni: name, type, password, commissions |
| `events` | Serate/eventi (campo `groupId`) |
| `tickets` | Biglietti QR generati |
| `prs_registry` | Anagrafica PR con eventIds assegnati (campo `groupId`) |
| `prs` | Contatori ingressi live per PR |
| `event_proposals` | Proposte evento da utenti esterni |
| `settings/admin` | Password pannello admin |
| `settings/eventSubmission` | Prezzo/flag gratuito per proposta evento |
| `external_events_cache/CINEMA_v4` | Cache film TMDB (6h) |
| `external_events_cache/CONCERTI_v4` | Cache concerti (26h) |
| `external_events_cache/TEATRO_v4` | Cache teatro (26h) |
| `showtimes/{YYYY-MM-DD}` | Orari cinema per data |
| `analytics/{date}` | Dati analytics giornalieri |

---

## File struttura `src/`

```
src/
  App.jsx          — Router + Scanner + PRDashboard
  Home.jsx         — Home pubblica (cinema, concerti, teatro, eventi, prenotazioni)
  Admin.jsx        — Login gruppo + pannello admin (tab: stats/prs/events/sponsors)
  SuperAdmin.jsx   — Pannello superadmin (eventi/proposte/impostazioni/statistiche/gruppi)
  SubmitEvent.jsx  — Form pubblico proposta evento
  analytics.js     — Funzioni tracking Firestore + GA4
  firebase.js      — Config Firebase
  constants/
    cataniaCinemas.js   — Lista cinema con ticketUrl, slug, priorità
    externalEvents.js   — Helpers eventi esterni
  services/        — Servizi fetch dati
```

---

## TODO aperti

- [ ] Aggiungere chiave Ticketmaster (`VITE_TICKETMASTER_API_KEY`) su Vercel
- [ ] Aggiungere segreti AWIN su GitHub Actions quando arrivano i feed
- [ ] `filmsWithShowtimesToday` (Set) aggiunto in `Home.jsx` — verificare se la logica è completa

---

## Accesso rapido

```bash
# Avvia dev server (accessibile da tablet/cellulare)
cd C:/Users/stefa/disco-app
npm run dev -- --host

# Run manuale scraper cinema
node scripts/scrape-showtimes.js

# Run manuale scraper concerti/teatro
node scripts/scrape-events.js
```
