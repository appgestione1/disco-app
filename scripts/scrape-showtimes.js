const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Configurazione cinema ─────────────────────────────────────────────────────
// type: 'webtic' → usa il parser Webtic (cinestarweb.it e simili)
// type: null     → nessun sito disponibile, skip
const CINEMA_CONFIG = [
  // ── Webtic ──────────────────────────────────────────────────────────────────
  {
    id: 'cinestar',
    type: 'webtic',
    url: d => `https://www.cinestarweb.it/programmazione/?d=${d}%2000%3A00%3A00`,
  },

  // ── Nessun sito disponibile (acquista/cerca orari via Google) ───────────────
  { id: 'eplanetaalfieri',       type: null },
  { id: 'eplanetariston',        type: null },
  { id: 'cinemaplanet',          type: null },
  { id: 'eplanetlopo',           type: null },
  { id: 'cinemaking',            type: null },
  { id: 'thespaceetnapolis',     type: null },
  { id: 'acireale',              type: null },
  { id: 'spadaro',               type: null },
  { id: 'artanis',               type: null },
  { id: 'politeamacaltagirone',  type: null },
  { id: 'macherione',            type: null },
  { id: 'garibaldi',             type: null },
  { id: 'rex',                   type: null },
  { id: 'eden',                  type: null },
  { id: 'moderno',               type: null },
  { id: 'trinacria',             type: null },
  { id: 'ucicentrosicilia',      type: null },
  { id: 'musmeci',               type: null },
  { id: 'centrale',              type: null },
  { id: 'metropol',              type: null },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Parser Webtic (cinestarweb.it e compatibili) ──────────────────────────────
// Struttura: <h5><a href="/scheda-film/?id_pro=ID">Titolo</a></h5>
//            <a href="film-ricercato/?mult=X&per=Y&pro=ID">HH:MM</a>
// Il parametro pro= collega ogni orario al film corretto.
function parseWebtic(html) {
  const $ = cheerio.load(html);
  const filmMap = {};

  $('h5 a[href*="scheda-film"]').each((_, a) => {
    const match = ($(a).attr('href') || '').match(/id_pro=(\d+)/);
    if (match) filmMap[match[1]] = { title: $(a).text().trim(), times: [] };
  });

  $('a[href*="film-ricercato"]').each((_, a) => {
    const proMatch = ($(a).attr('href') || '').match(/[?&]pro=(\d+)/);
    const time = $(a).text().trim();
    if (proMatch && filmMap[proMatch[1]] && /^\d{1,2}:\d{2}$/.test(time)) {
      filmMap[proMatch[1]].times.push(time);
    }
  });

  return Object.values(filmMap)
    .filter(f => f.times.length > 0)
    .map(f => ({ ...f, times: [...new Set(f.times)].sort() }));
}

// ── Scraping per cinema ───────────────────────────────────────────────────────
async function scrapeCinema(config, date) {
  if (!config.type) return null;

  try {
    const url = config.url(date);
    console.log(`  → ${url}`);
    const html = await fetchHtml(url);

    if (config.type === 'webtic') {
      if (!html.includes('scheda-film')) {
        console.log(`  ⚠ Pagina non riconosciuta`);
        return null;
      }
      return parseWebtic(html);
    }

    return null;
  } catch (e) {
    console.error(`  ✗ Errore: ${e.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Scraping orari per ${today} ===\n`);

  const showtimes = {};

  for (const config of CINEMA_CONFIG) {
    if (!config.type) continue;
    process.stdout.write(`[${config.id}] `);
    const films = await scrapeCinema(config, today);

    if (films && films.length > 0) {
      showtimes[config.id] = films;
      console.log(`${films.length} film trovati`);
      films.forEach(f => console.log(`    ✓ ${f.title}: ${f.times.join(', ')}`));
    } else {
      console.log(`nessun dato`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const total = Object.keys(showtimes).length;
  console.log(`\n=== Totale: ${total} cinema con orari ===`);

  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: total,
  });
  console.log(`✓ Salvato su Firestore: showtimes/${today}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
