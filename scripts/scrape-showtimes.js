const cheerio = require('cheerio');
const admin = require('firebase-admin');
const { execSync } = require('child_process');
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
  // adua (5701) e argentina (5702) → scraped da siti dedicati (vedi scrapeAreneCustom)
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
async function fetchHtml(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...HEADERS, ...extraHeaders } });
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
// ── Scraper arene (siti dedicati) ─────────────────────────────────────────────
const ITALIAN_MONTHS = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
};
// Parser per cinemamodernomascalucia.com/cinema-arena-adua/
// Formato: "Venerdì 29 Maggio ore 21:00 "TITOLO""
function parseArenaAduaText(text, year) {
  const result = {};
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    const low = line.toLowerCase();
    if (!/^(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)/i.test(low)) continue;
    const monthKey = Object.keys(ITALIAN_MONTHS).find(m => low.includes(m));
    if (!monthKey) continue;
    const month = ITALIAN_MONTHS[monthKey];
    // tutti i numeri 1-31 nella riga = giorni (escludi quelli seguiti da ":" = ore)
    const dayNums = [...line.matchAll(/\b(\d{1,2})\b(?!:\d)/g)]
      .map(m => parseInt(m[1])).filter(d => d >= 1 && d <= 31);
    if (!dayNums.length) continue;
    const timeM = line.match(/ore\s+(\d{1,2}[:.]\d{2})/i);
    const time = timeM ? timeM[1].replace('.', ':') : '21:00';
    // titolo: preferisce testo tra virgolette
    let title = '';
    // supporta virgolette dritte " e curve „"" (WordPress auto-converte)
    const quoted = line.match(/[“„"](.*?)[”“"]/u);
    if (quoted) {
      title = quoted[1].trim();
    } else {
      title = line
        .replace(/(Luned[iì]|Marted[iì]|Mercoled[iì]|Gioved[iì]|Venerd[iì]|Sabato|Domenica)/gi, '')
        .replace(/\b\d{1,2}\b(?!:\d)/g, '')
        .replace(new RegExp(monthKey, 'gi'), '')
        .replace(/ore\s+\d{1,2}[:.]\d{2}/gi, '')
        .replace(/\be\b/gi, ' ')
        .replace(/\([^)]+\)/g, '')
        .replace(/Regia:.*$/i, '')
        .replace(/con\s+.*/i, '')
        .replace(/[–—\-]\s*.*/i, '')
        .replace(/[“”„""]/g, '')
        .trim().replace(/^[^a-zA-ZÀ-ɏ0-9]+/, '').trim();
    }
    if (!title || title.length < 2) continue;
    for (const day of dayNums) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      if (!result[dateStr]) result[dateStr] = [];
      if (!result[dateStr].some(f => normalizeTitle(f.title) === normalizeTitle(title)))
        result[dateStr].push({ title, times: [time], siteImgUrl: null });
    }
  }
  return result;
}
// Parser cinestudio.eu/programma-argentina-ANNO/
// Split HTML del <p> su em-dash (&#8212; U+2014) per proiezioni multiple.
// Titolo = primo <strong> di ogni blocco (senza prefisso "Giorno DD:").
// Mese aggiornato da <h3> nel DOM; lastDay reset su rollover.
function parseArenaArgentinaHtml(html, year) {
  const $ = cheerio.load(html);
  const result = {};
  let ctxMonth = new Date().getMonth() + 1;
  let lastDay = 0;

  $('h1,h2,h3,h4,p').each((_, el) => {
    const tag = el.name;
    const fullText = $(el).text().replace(/ /g, ' ').trim();
    if (!fullText) return;

    if (tag !== 'p') {
      const hdr = Object.keys(ITALIAN_MONTHS).find(m => fullText.toLowerCase().includes(m));
      if (hdr) { ctxMonth = ITALIAN_MONTHS[hdr]; lastDay = 0; }
      return;
    }

    if (!/^(?:Luned[iì]|Marted[iì]|Mercoled[iì]|Gioved[iì]|Venerd[iì]|Sabato|Domenica)\s+\d+/i.test(fullText)) return;

    const colonIdx = fullText.indexOf(':');
    if (colonIdx < 0) return;
    const prefix = fullText.slice(0, colonIdx);
    const prefixNums = [...prefix.matchAll(/\b(\d{1,2})\b/g)].map(x => parseInt(x[1])).filter(d => d >= 1 && d <= 31);
    if (!prefixNums.length) return;
    const startDay = prefixNums[0];
    const endDay = prefixNums[prefixNums.length - 1];

    if (startDay < lastDay - 5) { ctxMonth = ctxMonth === 12 ? 1 : ctxMonth + 1; lastDay = 0; }
    lastDay = Math.max(lastDay, endDay);

    // Split su em-dash &#8212; (U+2014) — non su en-dash &#8211; che compare nei titoli
    const pHtml = $(el).html() || '';
    // Split su em-dash &#8212; o en-dash &#8211; quando precede lettera maiuscola dopo un orario
    const parts = pHtml.split(/&#8212;|—|(?<=:\d{2}[^<]{1,30}?)&#8211;(?=\s*<strong>)|(?<=:\d{2}[^<]{1,30}?)–(?=\s*<strong>)/);

    parts.forEach((part, partIdx) => {
      const $p = cheerio.load(part);
      const rawStrong = $p('strong').first().text().replace(/ /g, ' ').trim().replace(/,\s*$/, '');
      if (!rawStrong || rawStrong.length < 2) return;
      const title = partIdx === 0 ? rawStrong.replace(/^[^:]+:\s*/, '').trim() : rawStrong.trim();
      if (!title) return;

      const oreM = part.match(/\bore\s+(\d{1,2}[:.]\d{2})/i);
      const fallM = part.match(/\b(\d{1,2}:\d{2})\b/);
      const time = oreM ? oreM[1].replace('.', ':') : (fallM ? fallM[1] : null);
      if (!time) return;

      for (let day = startDay; day <= endDay; day++) {
        const dateStr = `${year}-${String(ctxMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (!result[dateStr]) result[dateStr] = [];
        if (!result[dateStr].some(f => normalizeTitle(f.title) === normalizeTitle(title) && f.times.includes(time)))
          result[dateStr].push({ title, times: [time], siteImgUrl: null });
      }
    });
  });
  return result;
}

async function scrapeAreneCustom(allDaysData) {
  const year = new Date().getFullYear();
  console.log('\n=== Scraping arene (siti dedicati) ===\n');
  // Arena Adua
  try {
    process.stdout.write('  [adua] cinemamodernomascalucia.com... ');
    const html = await fetchHtml('https://cinemamodernomascalucia.com/cinema-arena-adua/');
    const $ = cheerio.load(html);
    const text = $('.entry-content, .post-content, main, article').first().text() || $('body').text();
    const data = parseArenaAduaText(text, year);
    let count = 0;
    for (const [date, films] of Object.entries(data)) {
      if (!allDaysData[date]) allDaysData[date] = {};
      allDaysData[date].adua = films;
      count += films.length;
    }
    console.log(`✓ ${Object.keys(data).length} giorni, ${count} film`);
  } catch (e) { console.log(`✗ ${e.message}`); }
  await delay(800);
  // Arena Argentina — usa curl (TLS fingerprint nativo, bypassa Cloudflare bot check)
  try {
    process.stdout.write('  [argentina] cinestudio.eu... ');
    const url = `https://www.cinestudio.eu/programma-argentina-${year}/`;
    const html = execSync(
      `curl -s -L --compressed --max-time 15 ` +
      `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" ` +
      `-H "Accept-Language: it-IT,it;q=0.9" ` +
      `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" ` +
      `-H "Referer: https://www.google.it/" ` +
      `"${url}"`,
      { encoding: 'utf8', timeout: 20000 }
    );
    const data = parseArenaArgentinaHtml(html, year);
    let count = 0;
    for (const [date, films] of Object.entries(data)) {
      if (!allDaysData[date]) allDaysData[date] = {};
      allDaysData[date].argentina = films;
      count += films.length;
    }
    if (Object.keys(data).length === 0) {
      // Risposta ricevuta ma 0 film parsati → preserva da Firestore
      process.stdout.write('⚠ 0 film — recupero da Firestore... ');
      const refs = Object.keys(allDaysData).map(d => db.collection('showtimes').doc(d));
      const snaps = await db.getAll(...refs);
      let preserved = 0;
      for (const snap of snaps) {
        if (snap.exists && snap.data().cinemas?.argentina?.length) {
          if (allDaysData[snap.id] && !allDaysData[snap.id].argentina) {
            allDaysData[snap.id].argentina = snap.data().cinemas.argentina;
            preserved++;
          }
        }
      }
      console.log(preserved ? `↩ ${preserved} date` : 'nessun dato');
    } else {
      console.log(`✓ ${Object.keys(data).length} giorni, ${count} film`);
    }
  } catch (e) {
    console.log(`✗ ${e.message} — recupero dati Argentina da Firestore`);
    // Legge i docs esistenti per preservare i dati argentina già salvati
    try {
      const refs = Object.keys(allDaysData).map(d => db.collection('showtimes').doc(d));
      const snaps = await db.getAll(...refs);
      let preserved = 0;
      for (const snap of snaps) {
        if (snap.exists && snap.data().cinemas?.argentina?.length) {
          if (allDaysData[snap.id] && !allDaysData[snap.id].argentina) {
            allDaysData[snap.id].argentina = snap.data().cinemas.argentina;
            preserved++;
          }
        }
      }
      if (preserved) console.log(`  ↩ preservati dati Argentina per ${preserved} date`);
    } catch (_) {}
  }
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
  // ── Arene (siti dedicati: Adua + Argentina) ───────────────────────────────
  await scrapeAreneCustom(allDaysData);
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
        metadataMap.set(norm, { posterUrl: tmdb.posterUrl || info.siteImgUrl, backdropUrl: tmdb.backdropUrl, tmdbId: tmdb.tmdbId, trailerKey: tmdb.trailerKey, description: tmdb.description, rating: tmdb.rating || null });
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
