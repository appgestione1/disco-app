const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TMDB_KEY = process.env.TMDB_API_KEY;

// ── MYmovies.it — pagine da scrapare ─────────────────────────────────────────
// La provincia non include la città di Catania, quindi fetchiamo entrambe.
const MYMOVIES_URLS = [
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
  // '24660': Sala Karol Caltagirone — non nel nostro elenco
};

// Cinema nel nostro elenco non presenti su MYmovies → salviamo [] (tentato, nessun dato)
const CINEMAS_NOT_ON_MYMOVIES = [
  'eplanetaalfieri', 'garibaldi', 'rex', 'musmeci', 'trinacria', 'metropol',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
};

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
      await new Promise(r => setTimeout(r, 150));
    }

    return {
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      tmdbId: m.id,
      trailerKey,
      description: m.overview || null,
    };
  } catch (e) {
    console.log(`    ⚠ TMDB: ${e.message}`);
    return null;
  }
}

// ── Parser MYmovies.it ────────────────────────────────────────────────────────
// Struttura pagina:
//   <img id="imgSplash_N" src="POSTER_URL" alt="TITLE"
//        onclick="GetVideo(N, FILM_ID, ...)">
//
//   Per ogni cinema che proietta il film:
//   <div id="mappa_CINEMA_ID_FILM_ID" style="display:none;"></div>
//   <div class="... orari-dettaglio ...">
//     <span class="mm-medium mm-weight-700">HH:MM</span> ...
//   </div>
function parseMYmovies(html) {
  const $ = cheerio.load(html);

  // Step 1: film_id → {title, posterUrl}
  const filmMap = new Map();
  $('img[id^="imgSplash_"]').each((_, img) => {
    const $img = $(img);
    const onclick = $img.attr('onclick') || '';
    const match = onclick.match(/GetVideo\(\d+,\s*(\d+),/);
    if (!match) return;
    const filmId = match[1];
    const title = ($img.attr('alt') || '').trim();
    // Usa la versione large del poster quando disponibile
    let posterUrl = ($img.attr('src') || '').replace('covermd_home.jpg', 'coverlg_home.jpg');
    if (!posterUrl.startsWith('http') || posterUrl.includes('nondisponibile')) posterUrl = null;
    if (title && !filmMap.has(filmId)) {
      filmMap.set(filmId, { title, posterUrl });
    }
  });

  // Step 2: div.orari-dettaglio → il prev() sibling è sempre div[id^="mappa_"]
  const result = {}; // internalCinemaId → [{title, times, siteImgUrl, filmId}]

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
    // Evita duplicati dello stesso film nello stesso cinema
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Scraping MYmovies.it per ${today} ===\n`);

  // Fetch provincia + città in parallelo
  const htmlPages = await Promise.all(
    MYMOVIES_URLS.map(async url => {
      console.log(`  → ${url}`);
      try { return await fetchHtml(url); }
      catch (e) { console.error(`  ✗ ${url}: ${e.message}`); return ''; }
    })
  );

  // Parsing e merge delle due pagine
  const showtimes = {};
  for (const html of htmlPages) {
    if (!html) continue;
    const parsed = parseMYmovies(html);
    for (const [cinemaId, films] of Object.entries(parsed)) {
      if (!showtimes[cinemaId]) {
        showtimes[cinemaId] = [...films];
      } else {
        // Aggiungi film non ancora presenti (stesso filmId)
        for (const f of films) {
          if (!showtimes[cinemaId].some(e => e.filmId === f.filmId)) {
            showtimes[cinemaId].push(f);
          }
        }
      }
    }
  }

  // Cinema mappati ma senza dati oggi → salva []
  for (const internalId of Object.values(MYMOVIES_CINEMA_MAP)) {
    if (!showtimes[internalId]) showtimes[internalId] = [];
  }
  // Cinema non su MYmovies → salva [] (tentato, nessun dato disponibile)
  for (const id of CINEMAS_NOT_ON_MYMOVIES) {
    showtimes[id] = [];
  }

  // Riepilogo
  console.log('');
  let totalFilms = 0;
  for (const [id, films] of Object.entries(showtimes).sort()) {
    if (films.length > 0) {
      console.log(`[${id}] ${films.length} film`);
      films.forEach(f => console.log(`    ✓ ${f.title}: ${f.times.join(', ')}`));
      totalFilms += films.length;
    }
  }
  const withData = Object.values(showtimes).filter(f => f.length > 0).length;
  console.log(`\nCinema con dati: ${withData}/${Object.keys(showtimes).length} — Film totali: ${totalFilms}`);

  // ── Arricchimento TMDB ────────────────────────────────────────────────────
  if (TMDB_KEY) {
    console.log('\n=== Arricchimento metadati TMDB ===\n');

    // Raccogli titoli unici con il miglior poster disponibile (MYmovies)
    const uniqueTitles = new Map(); // norm → {title, siteImgUrl}
    for (const films of Object.values(showtimes)) {
      for (const f of films) {
        const n = normalizeTitle(f.title);
        if (!n) continue;
        if (!uniqueTitles.has(n)) uniqueTitles.set(n, { title: f.title, siteImgUrl: f.siteImgUrl || null });
        else if (!uniqueTitles.get(n).siteImgUrl && f.siteImgUrl) {
          uniqueTitles.get(n).siteImgUrl = f.siteImgUrl;
        }
      }
    }
    console.log(`  ${uniqueTitles.size} titoli unici\n`);

    const metadataMap = new Map();
    for (const [norm, info] of uniqueTitles) {
      process.stdout.write(`  [${info.title}] `);
      const tmdb = await enrichWithTmdb(info.title);
      if (tmdb) {
        metadataMap.set(norm, {
          posterUrl: tmdb.posterUrl || info.siteImgUrl,
          backdropUrl: tmdb.backdropUrl,
          tmdbId: tmdb.tmdbId,
          trailerKey: tmdb.trailerKey,
          description: tmdb.description,
        });
        console.log(`✓ TMDB${tmdb.trailerKey ? ' + trailer' : ''}`);
      } else {
        metadataMap.set(norm, {
          posterUrl: info.siteImgUrl || null,
          backdropUrl: null, tmdbId: null, trailerKey: null, description: null,
        });
        console.log(info.siteImgUrl ? '◐ poster MYmovies' : '✗ nessuna locandina');
      }
      await new Promise(r => setTimeout(r, 350));
    }

    // Applica metadati e rimuovi campo interno filmId
    for (const [cinemaId, films] of Object.entries(showtimes)) {
      showtimes[cinemaId] = films.map(f => {
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
          trailerSearchUrl: meta.trailerKey ? null
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(f.title + ' trailer italiano')}`,
        };
      });
    }
    console.log('\n=== Arricchimento completato ===');
  } else {
    console.log('\n⚠ TMDB_API_KEY non configurata — uso poster MYmovies dove disponibili');
    for (const [cinemaId, films] of Object.entries(showtimes)) {
      showtimes[cinemaId] = films.map(({ filmId, siteImgUrl, ...f }) => ({
        ...f,
        posterUrl: siteImgUrl || null,
        backdropUrl: null, tmdbId: null, trailerKey: null, description: null,
        trailerSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(f.title + ' trailer italiano')}`,
      }));
    }
  }

  const total = Object.keys(showtimes).length;
  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: total,
  });
  console.log(`\n✓ Salvato su Firestore: showtimes/${today} (${total} cinema)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
