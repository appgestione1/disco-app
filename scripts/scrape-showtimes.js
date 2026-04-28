const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── URL diretti per cinema su MYmovies ────────────────────────────────────────
const CINEMA_URLS = (date) => [
  { url: `https://www.mymovies.it/cinema/catania/5190/?data=${date}`,               id: 'eplanetariston' },
  { url: `https://www.mymovies.it/cinema/catania/6011/?data=${date}`,               id: 'cinemaplanet' },
  { url: `https://www.mymovies.it/cinema/catania/5004/?data=${date}`,               id: 'cinemaking' },
  { url: `https://www.mymovies.it/cinema/catania/20169/?data=${date}`,              id: 'thespaceetnapolis' },
  { url: `https://www.mymovies.it/cinema/catania/misterbianco/?data=${date}`,       id: 'ucicentrosicilia', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/mascalucia/?data=${date}`,         id: 'mascalucia', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/sangiovannilapunta/?data=${date}`, id: 'sangiovannilapunta', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/giarre/?data=${date}`,             id: 'giarre', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/caltagirone/?data=${date}`,        id: 'caltagirone', isArea: true },
];

// ── Estrazione film via DOM ───────────────────────────────────────────────────
// Per ogni link a /film/YYYY/slug/ risale il DOM cercando il contenitore più
// piccolo che abbia orari ma non altri link-film: garantisce isolamento preciso.
async function extractFilmsFromPage(page) {
  return await page.evaluate(() => {
    const TIME_RE = /\b([0-1]?\d|2[0-3]):[0-5]\d\b/g;
    const FILM_HREF_RE = /\/film\/\d{4}\/[^/]+\//;
    const results = [];
    const seenTitles = new Set();

    const filmLinks = [...document.querySelectorAll('a[href]')]
      .filter(a => FILM_HREF_RE.test(a.href));

    for (const link of filmLinks) {
      const title = link.textContent?.trim().replace(/\s+/g, ' ');
      if (!title || title.length < 2 || title.length > 100) continue;
      if (seenTitles.has(title)) continue;

      let container = link.parentElement;
      for (let level = 0; level < 10 && container; level++) {
        const containerText = container.textContent || '';
        const times = [...new Set(
          (containerText.match(TIME_RE) || [])
            .filter(t => parseInt(t.split(':')[0]) >= 8)
        )].sort();

        if (times.length === 0) { container = container.parentElement; continue; }

        // Questo contenitore è dedicato solo a questo film?
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
async function scrapeCinemaPage(browser, url, cinemaId, isArea = false) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Pagine area: cerca link a cinema specifici (con ID numerico) e visita il primo
    if (isArea) {
      const subLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href]').forEach(a => {
          if (/\/cinema\/[^/]+\/\d+\//.test(a.href))
            links.push({ href: a.href, text: a.innerText?.trim() });
        });
        return [...new Map(links.map(l => [l.href, l])).values()];
      });

      if (subLinks.length > 0) {
        console.log(`  Area ${cinemaId}: trovati ${subLinks.length} cinema`);
        for (const { href, text } of subLinks.slice(0, 2)) {
          console.log(`    → ${text} (${href})`);
          const subPage = await browser.newPage();
          await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          try {
            await subPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await new Promise(r => setTimeout(r, 1500));
            const films = await extractFilmsFromPage(subPage);
            if (films.length > 0) return films;
          } catch (e) {
            console.error(`    Errore sub-cinema: ${e.message}`);
          } finally {
            await subPage.close();
          }
        }
      }
    }

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
  console.log(`\n=== Scraping orari per ${today} ===\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const showtimes = {};

  try {
    for (const { url, id, isArea } of CINEMA_URLS(today)) {
      console.log(`\n[${id}] ${url}`);
      const films = await scrapeCinemaPage(browser, url, id, isArea);

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
