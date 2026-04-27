const fetch = require('node-fetch');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Mapping nomi cinema scraping → ID app ─────────────────────────────────────
const CINEMA_MAP = {
  'the space cinema catania':          'thespaceleporte',
  'the space catania':                 'thespaceleporte',
  'the space porte di catania':        'thespaceleporte',
  'the space cinema etnapolis':        'thespaceetnapolis',
  'the space etnapolis':               'thespaceetnapolis',
  'cinema king':                       'cinemaking',
  'king':                              'cinemaking',
  'odeon':                             'odeon',
  'multisala odeon':                   'odeon',
  'cinestar':                          'cinestar',
  'cinestar i portali':                'cinestar',
  'cinema planet':                     'cinemaplanet',
  'planet':                            'cinemaplanet',
  'uci cinemas centro sicilia':        'ucicentrosicilia',
  'uci centro sicilia':                'ucicentrosicilia',
  'uci cinemas':                       'ucicentrosicilia',
  'cinema margherita':                 'acireale',
  'margherita':                        'acireale',
};

function matchCinema(name) {
  const normalized = name.toLowerCase().trim();
  for (const [key, id] of Object.entries(CINEMA_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return id;
  }
  return null;
}

function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function extractTimes(text) {
  return (text.match(/\d{1,2}:\d{2}/g) || []).filter(t => {
    const [h] = t.split(':').map(Number);
    return h >= 8 && h <= 24;
  });
}

// ── Scraping MYmovies.it Catania ───────────────────────────────────────────────
async function scrapeMyMovies(date) {
  const url = `https://www.mymovies.it/cinema/catania/?data=${date}`;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9',
    }
  });

  const html = await res.text();
  const $ = cheerio.load(html);
  const result = {};

  // Strategia 1: box cinema con lista film
  $('[class*="cinema"]:not([class*="img"]):not([class*="icon"])').each((_, cinemaEl) => {
    const nameEl = $(cinemaEl).find('h2, h3, [class*="nome"], [class*="name"], [class*="title"]').first();
    const cinemaName = nameEl.text().trim();
    const cinemaId = matchCinema(cinemaName);
    if (!cinemaId || !cinemaName) return;

    const films = [];
    $(cinemaEl).find('[class*="film"],[class*="movie"],[class*="spettacolo"]').each((_, filmEl) => {
      const titleEl = $(filmEl).find('h3, h4, a, [class*="titolo"],[class*="title"]').first();
      const title = titleEl.text().trim();
      const timesText = $(filmEl).find('[class*="ora"],[class*="time"],[class*="orari"],[class*="spettacoli"]').text();
      const times = extractTimes(timesText);
      if (title && times.length) films.push({ title, times });
    });

    if (films.length) {
      console.log(`  ✓ ${cinemaName} (${cinemaId}): ${films.length} film`);
      result[cinemaId] = films;
    }
  });

  // Strategia 2: tabella con orari inline (fallback)
  if (Object.keys(result).length === 0) {
    let currentCinema = null;
    $('h2, h3, [class*="cinema-name"], [class*="nome-cinema"]').each((_, el) => {
      const text = $(el).text().trim();
      const id = matchCinema(text);
      if (id) { currentCinema = id; result[id] = result[id] || []; }
    });

    if (currentCinema) {
      $('[class*="film"],[class*="movie"]').each((_, el) => {
        const title = $(el).find('a, h4, h3, [class*="title"]').first().text().trim();
        const times = extractTimes($(el).text());
        if (title && times.length && currentCinema) {
          result[currentCinema].push({ title, times });
        }
      });
    }
  }

  return result;
}

// ── Scraping ComingSoon.it Catania (fallback) ─────────────────────────────────
async function scrapeComingSoon(date) {
  const url = `https://www.comingsoon.it/cinema/programmazione/catania/?data=${date}`;
  console.log(`Fallback ComingSoon: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'it-IT,it;q=0.9',
    }
  });

  const html = await res.text();
  const $ = cheerio.load(html);
  const result = {};

  $('[class*="cinema"]').each((_, cinemaEl) => {
    const cinemaName = $(cinemaEl).find('[class*="name"],[class*="nome"],h2,h3').first().text().trim();
    const cinemaId = matchCinema(cinemaName);
    if (!cinemaId) return;

    const films = [];
    $(cinemaEl).find('[class*="film"],[class*="spettacolo"]').each((_, filmEl) => {
      const title = $(filmEl).find('a,[class*="title"],[class*="titolo"]').first().text().trim();
      const times = extractTimes($(filmEl).text());
      if (title && times.length) films.push({ title, times });
    });

    if (films.length) {
      console.log(`  ✓ ComingSoon - ${cinemaName} (${cinemaId}): ${films.length} film`);
      result[cinemaId] = films;
    }
  });

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Scraping orari per ${today} ===\n`);

  let showtimes = {};

  try {
    showtimes = await scrapeMyMovies(today);
    console.log(`\nMYmovies: trovati ${Object.keys(showtimes).length} cinema`);
  } catch (e) {
    console.error('MYmovies fallito:', e.message);
  }

  if (Object.keys(showtimes).length === 0) {
    try {
      showtimes = await scrapeComingSoon(today);
      console.log(`ComingSoon: trovati ${Object.keys(showtimes).length} cinema`);
    } catch (e) {
      console.error('ComingSoon fallito:', e.message);
    }
  }

  if (Object.keys(showtimes).length === 0) {
    console.log('Nessun dato trovato — salvo documento vuoto per segnalare esecuzione');
  }

  // Salva su Firestore
  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: Object.keys(showtimes).length,
  });

  console.log(`\n✓ Salvato su Firestore: showtimes/${today}`);
  console.log(`  Cinema con orari: ${Object.keys(showtimes).join(', ') || 'nessuno'}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
