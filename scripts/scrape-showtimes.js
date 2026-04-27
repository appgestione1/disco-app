const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Mapping nomi cinema → ID app ──────────────────────────────────────────────
const CINEMA_MAP = {
  'the space cinema catania':    'thespaceleporte',
  'the space catania':           'thespaceleporte',
  'porte di catania':            'thespaceleporte',
  'the space etnapolis':         'thespaceetnapolis',
  'etnapolis':                   'thespaceetnapolis',
  'cinema king':                 'cinemaking',
  'king':                        'cinemaking',
  'odeon':                       'odeon',
  'cinestar':                    'cinestar',
  'i portali':                   'cinestar',
  'cinema planet':               'cinemaplanet',
  'planet':                      'cinemaplanet',
  'uci cinemas centro sicilia':  'ucicentrosicilia',
  'uci centro sicilia':          'ucicentrosicilia',
  'centro sicilia':              'ucicentrosicilia',
  'margherita':                  'acireale',
};

function matchCinema(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  for (const [key, id] of Object.entries(CINEMA_MAP)) {
    if (n.includes(key) || key.includes(n)) return id;
  }
  return null;
}

function extractTimes(text) {
  return [...new Set((String(text).match(/\b([0-1]?\d|2[0-4]):[0-5]\d\b/g) || []).filter(t => {
    const h = parseInt(t.split(':')[0]);
    return h >= 8 && h <= 24;
  }))].sort();
}

// ── Intercetta chiamate API JSON della pagina ─────────────────────────────────
async function interceptJsonApi(browser, url, label) {
  const page = await browser.newPage();
  const captured = [];

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  page.on('response', async response => {
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    const u = response.url();
    if (!u.includes('cinema') && !u.includes('program') && !u.includes('schedule') &&
        !u.includes('film') && !u.includes('spettacol') && !u.includes('show')) return;
    try {
      const json = await response.json();
      captured.push({ url: u, data: json });
      console.log(`  [API] ${u.substring(0, 80)}`);
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Log diagnostico
    const title = await page.title();
    console.log(`  Titolo pagina: ${title}`);
    console.log(`  Chiamate API intercettate: ${captured.length}`);

    // Log HTML per debug struttura
    const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 300));
    console.log(`  Contenuto pagina (300 char): ${bodySnippet?.replace(/\n+/g, ' ')}`);

  } catch (e) {
    console.error(`  Errore navigazione ${label}:`, e.message);
  } finally {
    await page.close();
  }

  return captured;
}

// ── Analizza JSON catturati e cerca orari ─────────────────────────────────────
function parseApiData(captured) {
  const showtimes = {};

  for (const { url, data } of captured) {
    const flat = JSON.stringify(data);

    // Cerca nomi cinema nei dati JSON
    for (const [key, cinemaId] of Object.entries(CINEMA_MAP)) {
      if (!flat.toLowerCase().includes(key)) continue;

      // Estrai orari vicini al nome cinema
      const idx = flat.toLowerCase().indexOf(key);
      const block = flat.substring(Math.max(0, idx - 200), idx + 500);
      const times = extractTimes(block);

      if (times.length > 0 && !showtimes[cinemaId]) {
        showtimes[cinemaId] = [{ title: 'Programmazione', times }];
        console.log(`  ✓ ${key} → ${cinemaId}: ${times.join(', ')}`);
      }
    }

    // Cerca array di film/cinema nel JSON
    const tryParse = (obj, depth = 0) => {
      if (depth > 5 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(i => tryParse(i, depth + 1)); return; }

      const cinemaName = obj.cinemaName || obj.cinema_name || obj.name || obj.nomeCinema || obj.teatro;
      const filmTitle = obj.filmTitle || obj.title || obj.titolo || obj.filmName;
      const times = obj.times || obj.orari || obj.spettacoli || obj.performances;

      if (cinemaName) {
        const id = matchCinema(String(cinemaName));
        if (id && filmTitle && Array.isArray(times) && times.length > 0) {
          if (!showtimes[id]) showtimes[id] = [];
          showtimes[id].push({
            title: String(filmTitle),
            times: times.map(t => typeof t === 'string' ? t : t.time || t.orario || String(t)).filter(Boolean)
          });
          console.log(`  ✓ JSON: ${cinemaName} → ${filmTitle}: ${times.join ? times.join(', ') : times}`);
        }
      }
      Object.values(obj).forEach(v => tryParse(v, depth + 1));
    };
    tryParse(data);
  }

  return showtimes;
}

// ── The Space Cinema diretto ──────────────────────────────────────────────────
async function scrapeTheSpace(browser, today) {
  const urls = [
    { url: `https://www.thespacecinema.it/cinema/porte-di-catania/programmazione`, id: 'thespaceleporte' },
    { url: `https://www.thespacecinema.it/cinema/etnapolis/programmazione`, id: 'thespaceetnapolis' },
  ];

  const showtimes = {};

  for (const { url, id } of urls) {
    const page = await browser.newPage();
    const apiCalls = [];

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    page.on('response', async response => {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      try {
        const json = await response.json();
        apiCalls.push(json);
      } catch {}
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));

      console.log(`\nThe Space ${id}: ${apiCalls.length} API calls`);

      // Cerca orari nel testo della pagina
      const text = await page.evaluate(() => document.body?.innerText || '');
      const times = extractTimes(text);

      if (times.length > 0) {
        showtimes[id] = [{ title: 'Programmazione', times }];
        console.log(`  Trovati orari: ${times.join(', ')}`);
      }

      // Analizza anche le API intercettate
      for (const json of apiCalls) {
        const parsed = parseApiData([{ url: '', data: json }]);
        if (parsed[id]) showtimes[id] = parsed[id];
      }

    } catch (e) {
      console.error(`  Errore The Space ${id}:`, e.message);
    } finally {
      await page.close();
    }
  }

  return showtimes;
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
    // 1. The Space Cinema diretto
    console.log('\n--- The Space Cinema ---');
    const theSpace = await scrapeTheSpace(browser, today);
    Object.assign(showtimes, theSpace);

    // 2. MYmovies.it con intercettazione API
    console.log('\n--- MYmovies.it ---');
    const mymoviesApi = await interceptJsonApi(browser,
      `https://www.mymovies.it/cinema/catania/?data=${today}`, 'MYmovies');
    Object.assign(showtimes, parseApiData(mymoviesApi));

    // 3. ComingSoon.it con intercettazione API
    console.log('\n--- ComingSoon.it ---');
    const csApi = await interceptJsonApi(browser,
      `https://www.comingsoon.it/cinema/programmazione/catania/?data=${today}`, 'ComingSoon');
    Object.assign(showtimes, parseApiData(csApi));

  } finally {
    await browser.close();
  }

  const total = Object.keys(showtimes).length;
  console.log(`\n=== Totale cinema con orari: ${total} ===`);
  if (total > 0) console.log(`Cinema: ${Object.keys(showtimes).join(', ')}`);

  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: total,
  });
  console.log(`✓ Salvato su Firestore: showtimes/${today}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
