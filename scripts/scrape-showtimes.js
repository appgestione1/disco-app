const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Configurazione cinema ─────────────────────────────────────────────────────
// type: 'webtic'   → cinestarweb.it (h5+scheda-film+film-ricercato)
// type: 'eplanet'  → eplanetcinemas.it (h3+/eticket/slug/)
// type: null       → nessun sito disponibile, skip
const CINEMA_CONFIG = [
  // ── Webtic ──────────────────────────────────────────────────────────────────
  {
    id: 'cinestar',
    type: 'webtic',
    url: d => `https://www.cinestarweb.it/programmazione/?d=${d}%2000%3A00%3A00`,
  },

  // ── Eplanet (eplanetcinemas.it) ──────────────────────────────────────────────
  {
    id: 'cinemaking',
    type: 'eplanet',
    slug: 'king',
    url: d => `https://www.eplanetcinemas.it/programmazione/king/?data=${d}`,
  },
  {
    id: 'eplanetariston',
    type: 'eplanet',
    slug: 'ariston',
    url: d => `https://www.eplanetcinemas.it/programmazione/ariston/?data=${d}`,
  },
  {
    id: 'eplanetlopo',
    type: 'eplanet-debug',
    slug: 'lo-po',
    url: d => `https://www.eplanetcinemas.it/programmazione/lo-po/?data=${d}`,
  },
  {
    id: 'cinemaplanet',
    type: 'eplanet',
    slug: 'canalicchio',
    url: d => `https://www.eplanetcinemas.it/programmazione/canalicchio/?data=${d}`,
  },

  // ── ComingSoon.it (ticket pages per film) ────────────────────────────────────
  {
    id: 'thespaceetnapolis',
    type: 'comingsoon-ticket',
    baseUrl: 'https://www.comingsoon.it/cinema/catania/the-space-cinema-belpasso/4827/',
  },

  // ── Nessun sito disponibile (acquista/cerca orari via Google) ───────────────
  { id: 'eplanetaalfieri',       type: null },
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

// ── Parser Eplanet (eplanetcinemas.it) ───────────────────────────────────────
// Struttura: <h3>Titolo Film</h3>
//            <a href="/eticket/[slug]/[filmId]/[sessionId]/">HH:MM</a>
// Il filmId nel path collega ogni orario al film corretto.
function parseEplanet(html, slug) {
  const $ = cheerio.load(html);
  const ETICKET_RE = new RegExp(`/eticket/${slug}/(\\d+)/`);
  const filmMap = {};

  $(`a[href*="/eticket/${slug}/"]`).each((_, a) => {
    const href = $(a).attr('href') || '';
    const match = href.match(ETICKET_RE);
    const time = $(a).text().trim();
    if (!match || !/^\d{1,2}:\d{2}$/.test(time)) return;
    const filmId = match[1];
    if (!filmMap[filmId]) filmMap[filmId] = { title: null, times: [] };
    filmMap[filmId].times.push(time);
  });

  // Trova il titolo h3 più vicino a ciascun filmId
  for (const filmId of Object.keys(filmMap)) {
    const firstLink = $(`a[href*="/eticket/${slug}/${filmId}/"]`).first();
    let $container = firstLink.parent();
    for (let i = 0; i < 8; i++) {
      if (!$container.length || $container.is('body')) break;
      const $h3 = $container.find('h3').first();
      if ($h3.length) { filmMap[filmId].title = $h3.text().trim(); break; }
      $container = $container.parent();
    }
  }

  return Object.values(filmMap)
    .filter(f => f.title && f.times.length > 0)
    .map(f => ({ ...f, times: [...new Set(f.times)].sort() }));
}

// ── ComingSoon.it: estrae orari di oggi dalla pagina ticket di un film ────────
// Struttura WebTick Bootstrap media object:
//   div.media → div.media-left (.day + .month) + div.media-body (btn-fab.c HH:MM)
function parseComingSoonTicketPage(html, targetDate) {
  const $ = cheerio.load(html);
  const TIME_RE = /\b([0-1]?\d|2[0-3]):[0-5]\d\b/g;
  const MONTHS_IT = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'];
  const [, month, day] = targetDate.split('-').map(Number);
  const todayDay   = String(day);                 // es. "28"
  const todayMonth = MONTHS_IT[month - 1];        // es. "APR"

  const times = [];
  $('div.media').each((_, el) => {
    const $m = $(el);
    if ($m.find('.day').text().trim()         === todayDay &&
        $m.find('.month').text().trim().toUpperCase() === todayMonth) {
      const t = ($m.find('.media-body').text().match(TIME_RE) || [])
        .filter(t => parseInt(t) >= 8);
      times.push(...t);
    }
  });

  return [...new Set(times)].sort();
}

// ── ComingSoon.it multi-step: main page → idf → ticket page per ogni film ────
async function scrapeComingSoonTickets(baseUrl, date) {
  // Step 1: estrai idf e titoli dalla pagina principale
  const mainHtml = await fetchHtml(baseUrl);
  const $ = cheerio.load(mainHtml);
  const filmMap = new Map();

  $('a[href*="?idf="]').each((_, a) => {
    const match = ($(a).attr('href') || '').match(/\?idf=(\d+)/);
    const title = $(a).text().trim().replace(/\s+/g, ' ');
    if (match && title && title.length >= 2 && title.length <= 120 && !filmMap.has(match[1])) {
      filmMap.set(match[1], title);
    }
  });

  if (filmMap.size === 0) { console.log(`  ⚠ Nessun idf trovato`); return []; }
  console.log(`  ℹ ${filmMap.size} film trovati, fetching ticket pages...`);

  // Step 2: per ogni film, fetcha /ticket/?idf=ID ed estrai orari di oggi
  const results = [];
  for (const [idf, title] of filmMap) {
    try {
      const ticketHtml = await fetchHtml(`${baseUrl}ticket/?idf=${idf}`);
      const times = parseComingSoonTicketPage(ticketHtml, date);
      if (times.length > 0) results.push({ title, times });
      await new Promise(r => setTimeout(r, 200));
    } catch (e) { console.log(`  ✗ ticket ${idf}: ${e.message}`); }
  }
  return results;
}

// ── Scraping per cinema ───────────────────────────────────────────────────────
async function scrapeCinema(config, date) {
  if (!config.type) return null;

  try {
    const url = config.url(date);
    console.log(`  → ${url}`);
    const html = await fetchHtml(url);

    if (config.type === 'eplanet-debug') {
      const $d = cheerio.load(html);
      const firstEticket = $d(`a[href*="/eticket/${config.slug}/"]`).first();
      const p1 = firstEticket.parent().prop('outerHTML') || '';
      const p2 = firstEticket.parent().parent().prop('outerHTML') || '';
      console.log(`  [DBG] parent eticket: ${p1.slice(0,300)}`);
      console.log(`  [DBG] grandparent: ${p2.slice(0,400)}`);
      return null;
    }

    if (config.type === 'webtic') {
      if (!html.includes('scheda-film')) {
        console.log(`  ⚠ Pagina non riconosciuta`);
        return null;
      }
      return parseWebtic(html);
    }

    if (config.type === 'eplanet') {
      if (!html.includes('/eticket/')) {
        console.log(`  ⚠ Pagina senza eticket`);
        return null;
      }
      return parseEplanet(html, config.slug);
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

    let films;
    if (config.type === 'comingsoon-ticket') {
      console.log('');
      films = await scrapeComingSoonTickets(config.baseUrl, today).catch(e => {
        console.error(`  ✗ Errore: ${e.message}`); return [];
      });
    } else {
      films = await scrapeCinema(config, today);
    }

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
