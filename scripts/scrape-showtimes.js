const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Mapping nomi cinema → ID app ──────────────────────────────────────────────
const CINEMA_MAP = {
  'the space cinema catania':   'thespaceleporte',
  'the space catania':          'thespaceleporte',
  'the space porte di catania': 'thespaceleporte',
  'porte di catania':           'thespaceleporte',
  'the space cinema etnapolis':  'thespaceetnapolis',
  'the space etnapolis':         'thespaceetnapolis',
  'etnapolis':                   'thespaceetnapolis',
  'cinema king':                 'cinemaking',
  'king multisala':              'cinemaking',
  'odeon':                       'odeon',
  'multisala odeon':             'odeon',
  'cinestar':                    'cinestar',
  'cinestar i portali':          'cinestar',
  'cinema planet':               'cinemaplanet',
  'planet':                      'cinemaplanet',
  'uci cinemas centro sicilia':  'ucicentrosicilia',
  'uci centro sicilia':          'ucicentrosicilia',
  'uci cinemas':                 'ucicentrosicilia',
  'cinema margherita':           'acireale',
  'cinema multisala':            'paterno',
};

function matchCinema(name) {
  const n = name.toLowerCase().trim();
  for (const [key, id] of Object.entries(CINEMA_MAP)) {
    if (n.includes(key) || key.includes(n)) return id;
  }
  return null;
}

function extractTimes(text) {
  return [...new Set((text.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => {
    const h = parseInt(t.split(':')[0]);
    return h >= 8 && h <= 24;
  }))];
}

// ── Scraping con Puppeteer ────────────────────────────────────────────────────
async function scrapePage(browser, url, siteName) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    console.log(`\nFetching ${siteName}: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Aspetta che i dati siano caricati
    await new Promise(r => setTimeout(r, 3000));

    const result = await page.evaluate((cinemaMapKeys) => {
      const out = {};

      // Cerca tutti i testi della pagina organizzati per cinema
      const allText = document.body.innerText;

      // Strategia 1: cerca blocchi con nome cinema noto
      for (const key of cinemaMapKeys) {
        const idx = allText.toLowerCase().indexOf(key);
        if (idx === -1) continue;
        // Prende il blocco di testo dopo il nome cinema (500 char)
        const block = allText.substring(idx, idx + 500);
        const times = [...new Set((block.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => {
          const h = parseInt(t.split(':')[0]);
          return h >= 8 && h <= 24;
        }))];
        if (times.length > 0) out[key] = times;
      }

      // Strategia 2: cerca elementi DOM con classi cinema/film
      const cinemaEls = document.querySelectorAll([
        '[class*="cinema"]', '[class*="Cinema"]',
        '[class*="multisala"]', '[data-cinema]',
        '[class*="structure"]', '[class*="theater"]'
      ].join(','));

      cinemaEls.forEach(el => {
        const nameEl = el.querySelector('h1,h2,h3,h4,[class*="name"],[class*="nome"],[class*="title"]');
        if (!nameEl) return;
        const name = nameEl.innerText?.trim().toLowerCase();
        if (!name || name.length > 60) return;

        const filmEls = el.querySelectorAll('[class*="film"],[class*="movie"],[class*="spettacolo"],[class*="title"]');
        filmEls.forEach(filmEl => {
          const filmTitle = filmEl.querySelector('h3,h4,a,[class*="title"],[class*="titolo"]')?.innerText?.trim();
          const timesText = filmEl.innerText || '';
          const times = [...new Set((timesText.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => {
            const h = parseInt(t.split(':')[0]);
            return h >= 8 && h <= 24;
          }))];
          if (filmTitle && times.length > 0) {
            if (!out[name]) out[name] = {};
            out[name][filmTitle] = times;
          }
        });
      });

      return out;
    }, Object.keys(CINEMA_MAP));

    console.log(`  Trovate chiavi: ${JSON.stringify(Object.keys(result))}`);

    // Converti al formato { cinemaId: [{title, times}] }
    const showtimes = {};
    for (const [key, value] of Object.entries(result)) {
      const cinemaId = matchCinema(key);
      if (!cinemaId) continue;
      if (Array.isArray(value)) {
        // Solo orari senza titoli film specifici
        if (!showtimes[cinemaId]) showtimes[cinemaId] = [];
      } else if (typeof value === 'object') {
        showtimes[cinemaId] = Object.entries(value).map(([title, times]) => ({ title, times }));
      }
    }

    return showtimes;
  } catch (e) {
    console.error(`  Errore ${siteName}:`, e.message);
    return {};
  } finally {
    await page.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Scraping orari per ${today} ===`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let showtimes = {};

  try {
    // Tentativo 1: MYmovies
    const mymovies = await scrapePage(browser,
      `https://www.mymovies.it/cinema/catania/?data=${today}`,
      'MYmovies'
    );
    Object.assign(showtimes, mymovies);
    console.log(`MYmovies: ${Object.keys(mymovies).length} cinema trovati`);

    // Tentativo 2: ComingSoon (aggiunge cinema mancanti)
    const comingsoon = await scrapePage(browser,
      `https://www.comingsoon.it/cinema/programmazione/catania/?data=${today}`,
      'ComingSoon'
    );
    for (const [id, films] of Object.entries(comingsoon)) {
      if (!showtimes[id]) showtimes[id] = films;
    }
    console.log(`ComingSoon: ${Object.keys(comingsoon).length} cinema trovati`);

  } finally {
    await browser.close();
  }

  const total = Object.keys(showtimes).length;
  console.log(`\nTotale cinema con orari: ${total}`);
  if (total > 0) console.log(`  Cinema: ${Object.keys(showtimes).join(', ')}`);

  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: total,
  });

  console.log(`✓ Salvato su Firestore: showtimes/${today}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
