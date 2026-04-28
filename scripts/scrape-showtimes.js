const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Cinema Catania e provincia — fonte: ComingSoon.it ─────────────────────────
const CINEMA_URLS = [
  { url: 'https://www.comingsoon.it/cinema/catania/cinestar-catania/4968/',                            id: 'cinestar' },
  { url: 'https://www.comingsoon.it/cinema/catania/eplanet-alfieri-catania/1263/',                     id: 'eplanetaalfieri' },
  { url: 'https://www.comingsoon.it/cinema/catania/eplanet-ariston-catania/1266/',                     id: 'eplanetariston' },
  { url: 'https://www.comingsoon.it/cinema/catania/eplanet-catania/1255/',                             id: 'cinemaplanet' },
  { url: 'https://www.comingsoon.it/cinema/catania/eplanet-lo-po/1272/',                               id: 'eplanetlopo' },
  { url: 'https://www.comingsoon.it/cinema/catania/king/1271/',                                        id: 'cinemaking' },
  { url: 'https://www.comingsoon.it/cinema/catania/the-space-cinema-belpasso/4827/',                   id: 'thespaceetnapolis' },
  { url: 'https://www.comingsoon.it/cinema/catania/margherita-acireale/1233/',                         id: 'acireale' },
  { url: 'https://www.comingsoon.it/cinema/catania/spadaro-acireale/1235/',                            id: 'spadaro' },
  { url: 'https://www.comingsoon.it/cinema/catania/artanis-caltagirone/1248/',                         id: 'artanis' },
  { url: 'https://www.comingsoon.it/cinema/catania/multisala-politeama-caltagirone/1247/',             id: 'politeamacaltagirone' },
  { url: 'https://www.comingsoon.it/cinema/catania/multisala-macherione-fiumefreddo-di-sicilia/1286/', id: 'macherione' },
  { url: 'https://www.comingsoon.it/cinema/catania/cine-teatro-garibaldi-giarre/1289/',                id: 'garibaldi' },
  { url: 'https://www.comingsoon.it/cinema/catania/cine-teatro-rex-giarre/6150/',                     id: 'rex' },
  { url: 'https://www.comingsoon.it/cinema/catania/eden-giarre/3461/',                                id: 'eden' },
  { url: 'https://www.comingsoon.it/cinema/catania/moderno-mascalucia/1292/',                         id: 'moderno' },
  { url: 'https://www.comingsoon.it/cinema/catania/trinacria-misterbianco/1302/',                     id: 'trinacria' },
  { url: 'https://www.comingsoon.it/cinema/catania/uci-cinemas-catania-misterbianco/5469/',           id: 'ucicentrosicilia' },
  { url: 'https://www.comingsoon.it/cinema/catania/cinema-musmeci-riposto/3481/',                     id: 'musmeci' },
  { url: 'https://www.comingsoon.it/cinema/catania/centrale-san-giovanni-la-punta/1347/',             id: 'centrale' },
  { url: 'https://www.comingsoon.it/cinema/catania/metropol-scordia/2063/',                           id: 'metropol' },
];

// ── Estrazione film via DOM (ComingSoon.it) ───────────────────────────────────
// Film link: <a href="/cinema/catania/?idf=XXXXX">
// Orari formato HH.MM → convertiamo in HH:MM
async function extractFilmsFromPage(page) {
  return await page.evaluate(() => {
    const TIME_RE = /\b([0-1]?\d|2[0-3])\.\d{2}\b/g;
    const FILM_HREF_RE = /\/cinema\/catania\/\?idf=\d+/;
    const results = [];
    const seenTitles = new Set();

    const filmLinks = [...document.querySelectorAll('a[href]')]
      .filter(a => FILM_HREF_RE.test(a.href));

    for (const link of filmLinks) {
      const title = link.textContent?.trim().replace(/\s+/g, ' ');
      if (!title || title.length < 2 || title.length > 120) continue;
      if (seenTitles.has(title)) continue;

      let container = link.parentElement;
      for (let level = 0; level < 10 && container; level++) {
        const containerText = container.textContent || '';
        const rawTimes = containerText.match(TIME_RE) || [];
        const times = [...new Set(
          rawTimes
            .filter(t => parseInt(t.split('.')[0]) >= 8)
            .map(t => t.replace('.', ':'))
        )].sort();

        if (times.length === 0) { container = container.parentElement; continue; }

        const otherFilmLinks = [...container.querySelectorAll('a[href]')]
          .filter(a => FILM_HREF_RE.test(a.href) && a !== link);

        if (otherFilmLinks.length === 0) {
          seenTitles.add(title);
          results.push({ title, times });
          break;
        }

        container = container.parentElement;
      }
    }

    return results;
  });
}

// ── Scraping singola pagina cinema ────────────────────────────────────────────
async function scrapeCinemaPage(browser, url, cinemaId) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    return await extractFilmsFromPage(page);
  } catch (e) {
    console.error(`  Errore ${cinemaId}: ${e.message}`);
    return [];
  } finally {
    await page.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Scraping orari per ${today} (ComingSoon.it) ===\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const showtimes = {};

  try {
    for (const { url, id } of CINEMA_URLS) {
      console.log(`\n[${id}] ${url}`);
      const films = await scrapeCinemaPage(browser, url, id);

      if (films.length > 0) {
        showtimes[id] = films;
        films.forEach(f => console.log(`  ✓ ${f.title}: ${f.times.join(', ')}`));
      } else {
        console.log(`  ✗ Nessun dato`);
      }
    }
  } finally {
    await browser.close();
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
