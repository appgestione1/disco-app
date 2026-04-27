const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Mapping testo pagina → ID app ─────────────────────────────────────────────
const CINEMA_KEYWORDS = {
  'misterbianco':            'thespaceleporte',
  'the space catania':       'thespaceleporte',
  'porte di catania':        'thespaceleporte',
  'belpasso':                'thespaceetnapolis',
  'the space etnapolis':     'thespaceetnapolis',
  'king multisala':          'cinemaking',
  'king cinestudio':         'cinemaking',
  'odeon':                   'odeon',
  'cinestar':                'cinestar',
  'i portali':               'cinestar',
  'eplanet catania':         'cinemaplanet',
  'cinema planet':           'cinemaplanet',
  'planet':                  'cinemaplanet',
  'uci':                     'ucicentrosicilia',
  'centro sicilia':          'ucicentrosicilia',
  'acireale':                'acireale',
  'margherita':              'acireale',
  'paternò':                 'paterno',
  'paterno':                 'paterno',
};

function matchCinema(text) {
  if (!text) return null;
  const n = text.toLowerCase();
  for (const [key, id] of Object.entries(CINEMA_KEYWORDS)) {
    if (n.includes(key)) return id;
  }
  return null;
}

function extractTimes(text) {
  return [...new Set((String(text).match(/\b([0-1]?\d|2[0-3]):[0-5]\d\b/g) || [])
    .filter(t => { const h = parseInt(t); return h >= 8 && h <= 23; })
  )].sort();
}

// ── Scraping MYmovies: segue i link dei cinema ────────────────────────────────
async function scrapeMYMovies(browser, today) {
  const baseUrl = `https://www.mymovies.it/cinema/catania/?data=${today}`;
  const showtimes = {};
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Trova tutti i link cinema nella pagina
    const cinemaLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const text = a.innerText?.trim();
        if (href.includes('/cinema/') && text && text.length > 2 && text.length < 60) {
          links.push({ href, text });
        }
      });
      return [...new Map(links.map(l => [l.href, l])).values()]; // deduplica
    });

    console.log(`\nLink cinema trovati: ${cinemaLinks.length}`);
    cinemaLinks.forEach(l => console.log(`  ${l.text} → ${l.href}`));

    // Visita ogni link rilevante
    for (const { href, text } of cinemaLinks) {
      const cinemaId = matchCinema(text) || matchCinema(href);
      if (!cinemaId) continue;

      console.log(`\nVisito: ${text} (${cinemaId}) → ${href}`);
      const cinemaPage = await browser.newPage();
      await cinemaPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      try {
        const url = href.includes('data=') ? href : `${href}?data=${today}`;
        await cinemaPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        // Estrai film e orari dalla pagina cinema
        const films = await cinemaPage.evaluate(() => {
          const results = [];
          // Cerca blocchi film
          const selectors = [
            '[class*="film"]', '[class*="movie"]', '[class*="spettacol"]',
            '[class*="scheda"]', '[class*="titolo"]', 'article', '.item'
          ];
          for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
              const titleEl = el.querySelector('h2,h3,h4,a,[class*="title"],[class*="titolo"]');
              const title = titleEl?.innerText?.trim();
              if (!title || title.length < 2 || title.length > 80) return;
              const times = [...new Set((el.innerText.match(/\b([0-1]?\d|2[0-3]):[0-5]\d\b/g) || [])
                .filter(t => parseInt(t) >= 8))].sort();
              if (times.length > 0) results.push({ title, times });
            });
          }
          // Fallback: estrai tutti gli orari dalla pagina se nessun film trovato
          if (results.length === 0) {
            const allTimes = [...new Set((document.body.innerText.match(/\b([0-1]?\d|2[0-3]):[0-5]\d\b/g) || [])
              .filter(t => parseInt(t) >= 8))].sort();
            if (allTimes.length > 0) results.push({ title: 'Programmazione', times: allTimes });
          }
          return results;
        });

        if (films.length > 0) {
          showtimes[cinemaId] = films;
          console.log(`  ✓ ${films.length} film trovati`);
          films.forEach(f => console.log(`    - ${f.title}: ${f.times.join(', ')}`));
        } else {
          console.log(`  ✗ Nessun orario trovato`);
        }

      } catch (e) {
        console.error(`  Errore: ${e.message}`);
      } finally {
        await cinemaPage.close();
      }
    }

  } catch (e) {
    console.error(`Errore MYmovies:`, e.message);
  } finally {
    await page.close();
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
    showtimes = await scrapeMYMovies(browser, today);
  } finally {
    await browser.close();
  }

  const total = Object.keys(showtimes).length;
  console.log(`\n=== Totale cinema con orari: ${total} ===`);
  Object.entries(showtimes).forEach(([id, films]) =>
    console.log(`  ${id}: ${films.length} film`)
  );

  await db.collection('showtimes').doc(today).set({
    date: today,
    cinemas: showtimes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    cinemaCount: total,
  });
  console.log(`\n✓ Salvato su Firestore: showtimes/${today}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
