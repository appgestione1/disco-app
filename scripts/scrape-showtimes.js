const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TMDB_KEY = process.env.TMDB_API_KEY;
const DAYS_AHEAD = 6; // oggi + 6 giorni

// ── MYmovies.it — pagine da scrapare ─────────────────────────────────────────
const MYMOVIES_BASE_URLS = [
  'https://www.mymovies.it/cinema/catania/provincia/',
  'https://www.mymovies.it/cinema/catania/',
];

// MYmovies cinema ID (stringa) → nostro ID interno
const MYMOVIES_CINEMA_MAP = {
  '5000':  'politeamacaltagirone',
  '5004':  'cinemaking',
  '5005':  'eplanetlopo',
  '5006':  'moderno',
  '5190':  'eplanetariston',
  '5543':  'spadaro',
  '5700':  'artanis',
  '5877':  'eden',
  '5997':  'macherione',
  '6011':  'cinemaplanet',
  '6333':  'centrale',
  '20036': 'acireale',
  '20169': 'thespaceetnapolis',
  '20562': 'cinestar',
  '21433': 'ucicentrosicilia',
  '5379':  'corsaro',
  '5701':  'adua',
  '5702':  'argentina',
  // '24660': Sala Karol Caltagirone — non nel nostro elenco
};

// Cinema nel nostro elenco non presenti su MYmovies → salviamo []
const CINEMAS_NOT_ON_MYMOVIES = [
  'eplanetaalfieri', 'garibaldi', 'rex', 'musmeci', 'trinacria', 'metropol',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Normalizzazione titolo (stessa logica del frontend) ───────────────────────
const normalizeTitle = t => t.toLowerCase()
  .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
  .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
  .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

// ── TMDB: cerca film e recupera poster + trailer ──────────────────────────────
async function enrichWithTmdb(title) {
  if (!TMDB_KEY) return null;
  try {
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=it-IT`,
      { headers: { Accept: 'application/json' } }
    );
    const searchData = await searchRes.json();
    const m = searchData.results?.[0];
    if (!m) return null;

    let trailerKey = null;
    for (const lang of ['it-IT', 'en-US']) {
      const vidRes = await fetch(
        `https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${TMDB_KEY}&language=${lang}`,
        { headers: { Accept: 'application/json' } }
      );
      const vidData = await vidRes.json();
      const v = vidData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (v) { trailerKey = v.key; break; }
      await delay(150);
    }

    return {
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      tmdbId: m.id,
      trailerKey,
      description: m.overview || null,
      rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
    };
  } catch (e) {
    console.log(`    ⚠ TMDB: ${e.message}`);
    return null;
  }
}

// ── Parser MYmovies.it ────────────────────────────────────────────────────────
function parseMYmovies(html) {
  const $ = cheerio.load(html);

  // film_id → {title, posterUrl}
  const filmMap = new Map();
  $('img[id^="imgSplash_"]').each((_, img) => {
    const $img = $(img);
    const onclick = $img.attr('onclick') || '';
    const match = onclick.match(/GetVideo\(\d+,\s*(\d+),/);
    if (!match) return;
    const filmId = match[1];
    const title = ($img.attr('alt') || '').trim();
    let posterUrl = ($img.attr('src') || '').replace('covermd_home.jpg', 'coverlg_home.jpg');
    if (!posterUrl.startsWith('http') || posterUrl.includes('nondisponibile')) posterUrl = null;
    if (title && !filmMap.has(filmId)) filmMap.set(filmId, { title, posterUrl });
  });

  // internalCinemaId → [{title, times, siteImgUrl, filmId}]
  const result = {};

  $('div.orari-dettaglio').each((_, orariEl) => {
    const $orari = $(orariEl);
    const $mappa = $orari.prev();
    const mappaId = $mappa.attr('id') || '';
    const m = mappaId.match(/^mappa_(\d+)_(\d+)$/);
    if (!m) return;

    const [, cinemaId, filmId] = m;
    const internalId = MYMOVIES_CINEMA_MAP[cinemaId];
    if (!internalId) return;

    const filmInfo = filmMap.get(filmId);
    if (!filmInfo) return;

    const times = [];
    $orari.find('span.mm-weight-700').each((_, span) => {
      const t = $(span).text().trim();
      if (/^\d{1,2}:\d{2}$/.test(t)) times.push(t);
    });
    if (times.length === 0) return;

    if (!result[internalId]) result[internalId] = [];
    if (!result[internalId].some(f => f.filmId === filmId)) {
      result[internalId].push({
        title: filmInfo.title,
        times: [...new Set(times)].sort(),
        siteImgUrl: filmInfo.posterUrl,
        filmId,
      });
    }
  });

  return result;
}

// ── Scraping di un singolo giorno (due pagine in parallelo) ───────────────────
async function scrapeDay(date, isToday) {
  const param = isToday ? '' : `?data=${date}`;
  const urls = MYMOVIES_BASE_URLS.map(base => base + param);

  const htmlPages = await Promise.all(
    urls.map(async url => {
      try { return await fetchHtml(url); }
      catch (e) { console.error(`  ✗ ${url}: ${e.message}`); return ''; }
    })
  );

  const showtimes = {};
  for (const html of htmlPages) {
    if (!html) continue;
    const parsed = parseMYmovies(html);
    for (const [cinemaId, films] of Object.entries(parsed)) {
      if (!showtimes[cinemaId]) showtimes[cinemaId] = [...films];
      else for (const f of films) if (!showtimes[cinemaId].some(e => e.filmId === f.filmId)) showtimes[cinemaId].push(f);
    }
  }

  // Cinema mappati senza dati → []
  for (const id of Object.values(MYMOVIES_CINEMA_MAP)) if (!showtimes[id]) showtimes[id] = [];
  for (const id of CINEMAS_NOT_ON_MYMOVIES) showtimes[id] = [];

  return showtimes;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  const dates = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  console.log(`\n=== Scraping MYmovies.it: ${dates[0]} → ${dates[dates.length - 1]} ===\n`);

  // ── Scraping giorno per giorno ─────────────────────────────────────────────
  const allDaysData = {}; // date → showtimes map
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    process.stdout.write(`[${date}] fetching... `);
    const showtimes = await scrapeDay(date, i === 0);
    allDaysData[date] = showtimes;
    const withData = Object.values(showtimes).filter(f => f.length > 0).length;
    console.log(`${withData} cinema con dati`);
    if (i < dates.length - 1) await delay(600); // rispetta rate limit MYmovies
  }

  // ── Arricchimento TMDB (una sola volta per tutti i giorni) ────────────────
  const uniqueTitles = new Map(); // norm → {title, siteImgUrl}
  for (const showtimes of Object.values(allDaysData)) {
    for (const films of Object.values(showtimes)) {
      for (const f of films) {
        const n = normalizeTitle(f.title);
        if (!n) continue;
        if (!uniqueTitles.has(n)) uniqueTitles.set(n, { title: f.title, siteImgUrl: f.siteImgUrl || null });
        else if (!uniqueTitles.get(n).siteImgUrl && f.siteImgUrl) uniqueTitles.get(n).siteImgUrl = f.siteImgUrl;
      }
    }
  }
  console.log(`\n=== Arricchimento TMDB: ${uniqueTitles.size} titoli unici ===\n`);

  const metadataMap = new Map(); // norm → metadata
  if (TMDB_KEY) {
    for (const [norm, info] of uniqueTitles) {
      process.stdout.write(`  [${info.title}] `);
      const tmdb = await enrichWithTmdb(info.title);
      if (tmdb) {
        metadataMap.set(norm, { posterUrl: tmdb.posterUrl || info.siteImgUrl, backdropUrl: tmdb.backdropUrl, tmdbId: tmdb.tmdbId, trailerKey: tmdb.trailerKey, description: tmdb.description });
        console.log(`✓ TMDB${tmdb.trailerKey ? ' + trailer' : ''}`);
      } else {
        metadataMap.set(norm, { posterUrl: info.siteImgUrl || null, backdropUrl: null, tmdbId: null, trailerKey: null, description: null });
        console.log(info.siteImgUrl ? '◐ poster MYmovies' : '✗ nessuna locandina');
      }
      await delay(350);
    }
  } else {
    console.log('⚠ TMDB_API_KEY non configurata — uso poster MYmovies');
    for (const [norm, info] of uniqueTitles) {
      metadataMap.set(norm, { posterUrl: info.siteImgUrl || null, backdropUrl: null, tmdbId: null, trailerKey: null, description: null });
    }
  }

  // ── Applica metadati e salva su Firestore ─────────────────────────────────
  console.log('\n=== Salvataggio Firestore ===\n');
  const batch = db.batch();

  for (const [date, rawShowtimes] of Object.entries(allDaysData)) {
    const cinemas = {};
    for (const [cinemaId, films] of Object.entries(rawShowtimes)) {
      cinemas[cinemaId] = films.map(({ filmId, siteImgUrl, ...f }) => {
        const n = normalizeTitle(f.title);
        const meta = (n && metadataMap.get(n)) || {};
        return {
          title: f.title,
          times: f.times,
          posterUrl: meta.posterUrl || null,
          backdropUrl: meta.backdropUrl || null,
          tmdbId: meta.tmdbId || null,
          trailerKey: meta.trailerKey || null,
          description: meta.description || null,
          rating: meta.rating || null,
          trailerSearchUrl: meta.trailerKey ? null
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(f.title + ' trailer italiano')}`,
        };
      });
    }

    const ref = db.collection('showtimes').doc(date);
    batch.set(ref, {
      date,
      cinemas,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      cinemaCount: Object.keys(cinemas).length,
    });
    console.log(`  ✓ showtimes/${date}`);
  }

  await batch.commit();
  console.log(`\n✓ ${dates.length} giorni salvati su Firestore (${dates[0]} → ${dates[dates.length - 1]})`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
