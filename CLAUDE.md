# disco-app — Stato del Progetto

> Questo file è la fonte di verità del progetto per Claude Code.
> Aggiornarlo e committarlo ogni volta che lo stato cambia significativamente.
> **Ultimo aggiornamento: 15/05/2026 — commit `4ec564c`**

---

## Cos'è

Webapp gestionale per eventi/discoteca — portale eventi locale per Catania e provincia.
Nome app (PWA): **EVENT**
Obiettivo: gestire serate, prenotazioni lista/privé, scanner ingresso, dashboard PR, e mostrare cinema/concerti/teatro/sagre locali.

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
| `/admin-segreto-stefano` | `Admin.jsx` | Admin (login gruppo) |
| `/super-control-room` | `SuperAdmin.jsx` | SuperAdmin (7 click lucchetto + password "superadmin") |
| `/proponi-evento` | `SubmitEvent.jsx` | Pubblico |

---

## Categorie Home (`Home.jsx`)

Ordine attuale nel grid:
1. DISCOTECA
2. TEATRO
3. CINEMA
4. CONCERTI
5. ARENE ESTIVE
6. LOUNGE/PUB
7. SAGRE
8. ALTRO (id: `TUTTI`)

`EXTERNAL_CATS = ['CINEMA', 'TEATRO', 'CONCERTI', 'SAGRE']` — dati da API/scraper, non da Firestore eventi.

---

## Sezione SAGRE (`Home.jsx`)

- Dati da `external_events_cache/SAGRE_v6` (TTL 26h)
- Scraper `scripts/scrape-events.js` → `scrapeVivaSicilia()` — 6 mesi da vivasicilia.com
- GitHub Actions `scrape-events.yml`: `30 5 * * *` (7:30 IT)
- Ogni evento ha: `id, title, imageUrl, externalUrl, date, city, province, source:'VIVASICILIA', category:'SAGRE'`
- **Filtri UI**: `<select>` compatti — Mese + Provincia (in riga) + Città (sotto, solo se provincia selezionata)
- **Layout**: 1 colonna, immagini `h-auto object-contain` (adattive all'aspect ratio reale)
- **Province mapping** in `scrape-events.js`: `SICILY_PROVINCE` + `getProvince()` con partial-match fallback
- **Stati Home**: `sagreMonth`, `sagreProvince`, `sagreCity`

---

## Sezione CONCERTI & TEATRO (`Home.jsx`)

- 1 colonna, immagini `h-auto object-contain` (adattive)
- Filtri: TUTTI / OGGI / DATA + toggle area geografica (Catania / Tutta Sicilia)
- Cache `CONCERTI_v6` e `TEATRO_v6` (TTL 26h)

---

## Sezione ARENE ESTIVE (`Home.jsx`)

- Dati da Firestore `events` con `category: 'ARENE ESTIVE'`
- Selettore arena compatto (`<select>`) — appare solo in questa categoria
- Arene hardcoded: Arena Adua, Arena Argentina, Arena Corsaro, Villa Bellini, Arena Moderno, Arena Giardino
- Filtro per `ev.location.toLowerCase().includes(arenaId)` — l'admin imposta il campo Luogo nell'evento

---

## Sistema Multi-Admin (gruppi)

Ogni "gruppo" è un'organizzazione indipendente (es. una discoteca) con i propri PR, eventi e dati.

### Login Admin (`AdminLogin` in `Admin.jsx`)
- Schermata di login con **ID Gruppo** + **Password**
- Verifica contro Firestore `groups/{groupId}` → campo `password`
- Sessione salvata in `localStorage` come `adminGroup: { groupId, groupName, groupType }`

### Pannello Admin (`AdminPanel` in `Admin.jsx`) — ottimizzato mobile
Header + tab in blocco sticky unico. Tab: LIVE / TEAM / SERATE / SPONSOR (icona + label sempre visibile).

**Tab DATI LIVE (`stats`)** — card per ogni serata con stats (pass, ingressi, drink, costo PR)

**Tab TEAM PR (`prs`)** — bottoni SETUP RAPIDO SERATE e + NUOVO COLLABORATORE a larghezza piena (w-full), ravvicinati (mb-2), separati dalle card da bordo nero spesso (border-t-4).

Card PR (collassabili di default, stato in `expandedPrIds` Set):
- Intestazione nera/gialla: click espande/collassa (ChevronDown)
- Slot serate assegnate: titolo + tariffa statica + contatore ingressi + totale netto (NO dropdown, NO inline edit)
- Se nessuna serata → "Nessuna serata — usa Setup Rapido"
- Bottoni azioni in griglia 2×2: **RESET PWD** | **VEDI E PAGA** (o CONTEGGI) / **SOSTITUISCI** (o MOD.ALIAS) | 🗑️
- **INVIA LINK APP** → WhatsApp nativo (`whatsapp://send?phone=...`)
- Bonus supervisore: solo visualizzazione statica nel card (modifica solo da Setup Rapido SUP)

**Licenziamento PR** (bottone 🗑️):
- Dialog semplificato: "Vuoi licenziare [nome]?" — nessun dettaglio tecnico
- Imposta `mergedInto: masterId` + `redirectTo: masterId` → link utenti reindirizzati automaticamente al MASTER
- Il PR licenziato appare nella sezione "Collaboratori Archiviati" dell'Admin (esistente)
- Il MASTER vede i PR licenziati e i loro ingressi nella sezione "PR INGLOBATI" della sua pagina

**Setup Rapido Serate** — sezione collassabile con:
- Flag serata (checkbox ON/OFF) e chevron collapse/expand **separati e indipendenti**
- Flag evento → sync automatico di tutti i PR (seleziona/deseleziona)
- PR disabilitati (opacity-30) se la serata non è flaggata
- Lista PR gerarchica: top-level (mb-3) → sub-PR indentati (ml-5, border-l-2, mt-1)
- Per ogni PR: checkbox + nome + ID + [SUP input se sub-PR] + [€ pay input]
- Campo **SUP**: `type=number step=0.01`, salva `supervisorPay` su Firestore all'onBlur in tempo reale
- Salvataggio **real-time** su Firestore: ogni modifica aggiorna subito le schede PR — **nessun bottone APPLICA** (rimosso)
- `applySetupSilently(configs, prIds)` gestisce il salvataggio silenzioso

**Modal SOSTITUISCI** (bottom sheet mobile, 3 sezioni):
- **Anagrafica**: modifica nome/alias
- **Supervisore**: select per assegnare/rimuovere supervisore (salva su Firestore)
- **Zona Pericolosa**: fusione/archiviazione (campo `mergedInto`)

**Collaboratori Archiviati** (fondo tab TEAM, sezione collassabile):
- Mostra PR con `mergedInto` impostato
- Per ogni archiviato: select destinazione + SPOSTA + 🗑️ (ingloba nel Master, non cancella)

**Security Vault** (lucchetto in header Admin — bottom sheet mobile):
- Cambio password + Zona Pericolosa
- **RESET PR**: elimina tutti i collaboratori + contatori + ticket del gruppo, ricrea Master pulito (non tocca `MASTER_{groupId}`)
- **RESET SERATE**: elimina tutti gli eventi + ticket del gruppo
- Entrambi richiedono di digitare il nome del gruppo come conferma

Form **+ NUOVO COLLABORATORE** collassabile (chiuso di default):
- Ordine campi: Nome → Telefono → Codice Assegnato (readonly)
- Codice mostra `---` finché il nome è vuoto, poi fetcha `settings/prCounter` e mostra il prossimo ID
- Formato: `PR0001` (4 cifre, es. PR0007)
- All'invio: `runTransaction` su `settings/prCounter` per ID globale atomico

**Contatore globale PR** (`settings/prCounter.lastId`):
- Condiviso tra tutti i gruppi, sopravvive al RESET PR
- Garantisce ID univoci globalmente — nessun riutilizzo dopo reset

**Logica calcolo netto sub-PR:**
- `calculatePrFinancials` / `calculatePrFinancialsForEvent`: tariffa netta = `eventPay - supervisorPay`
- Il supervisore riceve +`supervisorPay` × ingressi del sub-PR come bonus

**Tab SERATE (`events`):**
- Header "PUBBLICA NUOVO EVENTO" collassabile (chiuso di default, `showEventForm` state)
- Tipologie selezionabili: DISCOTECA · LOUNGE/PUB · CONCERTI · TEATRO · ALTRO
- Campi: Nome Evento, Tipologia, Data, Luogo/Location, Info & Listino prezzi, Foto locandina

**Tab SPONSOR (`sponsors`)** — placeholder "sezione in aggiornamento" (popup gestito da SuperAdmin)

Tutti i dati filtrati per `groupId`.

### Redirect link PR — logica `redirectTo`
- `prs_registry/{prId}.redirectTo` — se impostato, `fetchPrInfo` in `Home.jsx` aggiorna silenziosamente `?ref=` al valore target (`setSearchParams replace:true`)
- Se il doc non esiste affatto → redirect automatico a `MASTER`
- Al licenziamento: `redirectTo: masterId` impostato automaticamente
- Impostabile manualmente da SuperAdmin → GRUPPI → select sotto ogni PR del gruppo

### Contabilità PR — logica `lastReset`
- `prs_registry/{prId}.lastReset` — timestamp salvato quando si preme "AZZERA CONTABILITÀ"
- Tutti i calcoli (`calculatePrFinancials`, `calculatePrFinancialsForEvent`, colonna IN, modal VEDI E PAGA) escludono i ticket con `timestamp <= lastReset`
- Così AZZERA azzera anche il bonus supervisore (filtra i ticket dei sub-PR con lo stesso lastReset)
- `prs_registry/{prId}.eventTitles.{eventId}` — snapshot del titolo evento salvato all'assegnazione slot (persiste anche dopo eliminazione evento)

### Modal "VEDI E PAGA"
- Dettaglio serate: nome evento (da DB o da `eventTitles` snapshot) + ingressi × tariffa + importo
- Bonus supervisore (se presente, da sub-PR)
- Riepilogo: Totale Lordo → Acconti Versati → Residuo (sfondo nero/giallo)
- Input importo + CONFERMA PAGAMENTO + AZZERA CONTABILITÀ

### PRDashboard (`/pr/:prId`) — Pagina PR
- Accessibile da Home con sequenza stelle (R R L L) + password
- Sezioni: INGRESSI / CONTEGGI / ELENCO LISTA / PRIVÉ
- **Sezione PR INGLOBATI** (solo MASTER, pulsante rosso):
  - Rilevamento MASTER: `prData.isMaster === true` OR `prId.startsWith("MASTER")`
  - Mostra PR licenziati con `mergedInto.startsWith("MASTER")` che hanno ticket non ancora svuotati
  - Ogni card espandibile → lista ingressi (customerName, customerPhone, data) dopo `masterClearedAt`
  - Pulsante **SVUOTA LISTA**: imposta `masterClearedAt: serverTimestamp()` → PR scompare
  - Riappare al prossimo caricamento solo se nuovi ticket `timestamp > masterClearedAt`

### SuperAdmin (`SuperAdmin.jsx`)
`activeView`: `null | 'events' | 'proposals' | 'settings' | 'stats' | 'groups' | 'popup'`
- **GRUPPI** — crea/elimina gruppi, lista PR per gruppo con select **redirectTo** per ogni PR (redirect silenzioso al PR/MASTER scelto); commissioni Master (8 voci, griglia 2×4, salvate su `groups/{groupId}.commissions`):
  - `perOrfano` → "Per ingresso extra", `perPR` → "Per ingresso", `perEvento` → "Fisso per evento", `perQR` → "Per QR realizzato"
  - `bonusDaPR` → "Bonus da PR", `fissoPublicita` → "Fisso Pubblicità", `prive` → "Privé", `extra` → "Extra"
- **EVENTI** — toggle + elimina evento
- **STATISTICHE** — analytics completo (vedi sezione Analytics)
- **Pop-up Apertura** — gestione popup pubblicitario all'apertura app:
  - Toggle ON/OFF, switch Immagine/Video
  - Immagine: upload → base64 (resize max 900px)
  - Video: URL diretto o YouTube (iframe embed auto-rilevato) + durata countdown
  - Slogan, indirizzo, data scadenza
  - Immagine extra (logo/QR) con 6 posizioni selezionabili (griglia 3×2)
  - Toggle mostra/nascondi bottone "Salva Promo in Galleria"
  - Bottone TESTA POPUP (resetta cooldown localStorage)
  - Salva su `settings/popup`

---

## Sezione Cinema (`Home.jsx`)

- TMDB `now_playing` → cache `external_events_cache/CINEMA_v6` (TTL 6h)
- Film locali → `showtimes/{today}` + enrichment TMDB search
- FilmDetail: 7 chip date, ordinamento cinema, orari futuri, link acquisto diretto (The Space `/film/slug`, UCI), bottone attivo solo se orari disponibili
- Scraper `scrape-showtimes.js`: mymovies.it, GitHub Actions `0 5 * * *` (7:00 IT)

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

## Analytics (`src/analytics.js`)

- Tracking su Firestore + GA4 (`G-9XS7FT5ZV1`, tag in `index.html`)
- Condivisioni per PR ref, categorie, film, prenotazioni, pageviews, PWA installs
- SuperAdmin → STATISTICHE: KPI Media Kit, PR Leaderboard, top film, trend 7gg, filtro OGGI/7G/30G/TOTALE

---

## Firestore Collections

| Collection | Contenuto |
|---|---|
| `groups/{groupId}` | name, type, password, commissions |
| `events` | Serate/eventi (campo `groupId`, `category`, `location`) |
| `tickets` | QR generati — campi: prId, eventId, customerName, customerPhone, used, timestamp, type, guestCount |
| `prs_registry` | PR con eventIds, eventPays, eventTitles, lastReset, acconto, supervisorId, supervisorPay, mergedInto, redirectTo, masterClearedAt |
| `prs` | Contatori ingressi live |
| `event_proposals` | Proposte evento esterni |
| `settings/admin` | Password admin |
| `settings/prCounter` | `{ lastId: number }` — contatore globale ID PR (non resettabile) |
| `settings/eventSubmission` | Prezzo proposta evento |
| `external_events_cache/CINEMA_v6` | Cache film (6h) |
| `external_events_cache/CONCERTI_v6` | Cache concerti (26h) |
| `external_events_cache/TEATRO_v6` | Cache teatro (26h) |
| `external_events_cache/SAGRE_v6` | Cache sagre vivasicilia (26h) |
| `showtimes/{YYYY-MM-DD}` | Orari cinema per data |
| `analytics/{date}` | Dati analytics giornalieri |
| `settings/popup` | Config popup pubblicitario (imageUrl, videoUrl) |

---

## PWA / Icona / Nome

- Nome app: **EVENT** (manifest.json + apple-mobile-web-app-title)
- Icona: `public/icon.svg` — stella 4 punte (sparkle) con bagliore dorato su sfondo nero
- Favicon: `public/favicon.svg` (identica a icon.svg)
- `handleExit` in Home.jsx: resetta tutti gli overlay + tenta window.close() + fallback about:blank

---

## PRDashboard (`/pr/:prId`) — logica eventi e ticket

**Caricamento eventi:**
- PR normale: eventi da `groupId` filtrati per `eventIds` assegnati + storico da `eventTitles`
- MASTER: tutti gli eventi attivi del gruppo + serate concluse raccolte dagli `eventTitles` di TUTTI i PR del gruppo
- MASTER legacy (prId = `"MASTER"` senza suffisso): `prGroupId` null → carica tutti gli eventi senza filtro groupId

**Caricamento ticket:**
- PR normale: `where("prId", "==", prId)`
- MASTER: `where("eventId", "in", [...evIds])` per tutti gli eventi attivi, a chunk di 30

**Sezioni implementate:**
- INGRESSI: livecount via onSnapshot per serata selezionata
- CONTEGGI: per serata → Lista/Privé × tariffa + riepilogo lordo/acconti/residuo (PR) | orfani/PR breakdown (MASTER)
- ELENCO LISTA: nominativi con telefono e orario, filtro per serata
- PRIVÉ: prenotazioni raggruppate per gruppo ospiti con stati ticket

---

## TODO aperti

- [ ] Chiave Ticketmaster (`VITE_TICKETMASTER_API_KEY`) su Vercel
- [ ] Segreti AWIN su GitHub Actions quando arrivano i feed
- [ ] Ottimizzazione grafica Admin mobile (tab DATI LIVE, SERATE)
- [ ] PRDashboard — verificare funzionamento su Vercel produzione (MASTER storico serate)
- [ ] Valutare dominio personalizzato (es. eventcatania.it) per nascondere URL Vercel
- [x] Sezione SAGRE con scraper vivasicilia.com (6 mesi, province + città)
- [x] SAGRE: filtri compatti <select> mese/provincia/città + layout 1 colonna adattivo
- [x] TEATRO/CONCERTI: layout 1 colonna, immagini adattive h-auto
- [x] ARENE ESTIVE: selettore arena compatto con 6 arene catanesi
- [x] Categorie Home: ALTRO (ex TUTTI) spostato dopo SAGRE
- [x] Admin SERATE: form "PUBBLICA NUOVO EVENTO" collassabile + tipologie DISCOTECA/LOUNGE-PUB/CONCERTI/TEATRO/ALTRO
- [x] Icona PWA: stella 4 punte gold su nero (rimpiazza fulmine viola)
- [x] Nome app: EVENT (era DiscoEntry)
- [x] handleExit: chiude tutti gli overlay prima di tentare window.close()

---

## Accesso rapido

```bash
cd C:/Users/stefa/disco-app
npm run dev -- --host              # dev server (accessibile da cellulare/tablet)
node scripts/scrape-showtimes.js   # run manuale scraper cinema
node scripts/scrape-events.js      # run manuale scraper concerti/teatro/sagre
gh workflow run scrape-events.yml --repo appgestione1/disco-app  # trigger GitHub Actions
```
