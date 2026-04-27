// ─────────────────────────────────────────────────────────────────────────────
// CINEMA CATANIA E PROVINCIA
//
// partnerId: null → Opzione A (Google search orari)
// partnerId: 'id' → Opzione C (orari ufficiali dal partner in Firestore)
//
// Per aggiungere un cinema: copia un blocco e compila i campi.
// ─────────────────────────────────────────────────────────────────────────────

export const CATANIA_CINEMAS = [

  // ── CATANIA CITTÀ ──────────────────────────────────────────────────────────

  {
    id: 'thespaceleporte',
    name: 'The Space Cinema',
    area: 'Le Porte di Catania – Misterbianco',
    address: 'Via Duca D\'Aosta 37, Misterbianco (CT)',
    website: 'https://www.thespacecinema.it',
    programUrl: 'https://www.thespacecinema.it/cinema/porte-di-catania/programmazione',
    mapsUrl: 'https://maps.google.com/?q=The+Space+Cinema+Le+Porte+di+Catania+Misterbianco',
    partnerId: null,
  },

  {
    id: 'cinemaking',
    name: 'Cinema King Multisala',
    area: 'Catania Centro',
    address: 'Via Umberto I, Catania',
    website: null,
    programUrl: null,
    mapsUrl: 'https://maps.google.com/?q=Cinema+King+Catania',
    partnerId: null,
  },

  {
    id: 'odeon',
    name: 'Odeon Multisala',
    area: 'Catania',
    address: 'Catania (CT)',
    website: null,
    programUrl: null,
    mapsUrl: 'https://maps.google.com/?q=Cinema+Odeon+Catania',
    partnerId: null,
  },

  {
    id: 'cinestar',
    name: 'Cinestar I Portali',
    area: 'I Portali – Catania',
    address: 'Via Domenico Tempio, Catania (CT)',
    website: null,
    programUrl: null,
    mapsUrl: 'https://maps.google.com/?q=Cinestar+I+Portali+Catania',
    partnerId: null,
  },

  {
    id: 'ucicentrosicilia',
    name: 'UCI Cinemas Centro Sicilia',
    area: 'Centro Sicilia – Catania',
    address: 'Centro Commerciale Centro Sicilia, Catania (CT)',
    website: 'https://www.ucicinemas.it',
    programUrl: 'https://www.ucicinemas.it/cinema/sicilia/uci-cinemas-centro-sicilia',
    mapsUrl: 'https://maps.google.com/?q=UCI+Cinemas+Centro+Sicilia+Catania',
    partnerId: null,
  },

  // ── CATANIA PROVINCIA ──────────────────────────────────────────────────────

  {
    id: 'thespaceetnapolis',
    name: 'The Space Cinema Etnapolis',
    area: 'Etnapolis – Belpasso (CT)',
    address: 'SS 121, Belpasso (CT)',
    website: 'https://www.thespacecinema.it',
    programUrl: 'https://www.thespacecinema.it/cinema/etnapolis/programmazione',
    mapsUrl: 'https://maps.google.com/?q=The+Space+Cinema+Etnapolis+Belpasso',
    partnerId: null,
  },

  {
    id: 'acireale',
    name: 'Cinema Margherita',
    area: 'Acireale (CT)',
    address: 'Acireale (CT)',
    website: null,
    programUrl: null,
    mapsUrl: 'https://maps.google.com/?q=Cinema+Acireale+Catania',
    partnerId: null,
  },

  {
    id: 'paterno',
    name: 'Cinema Multisala',
    area: 'Paternò (CT)',
    address: 'Paternò (CT)',
    website: null,
    programUrl: null,
    mapsUrl: 'https://maps.google.com/?q=Cinema+Paternò+Catania',
    partnerId: null,
  },

];
