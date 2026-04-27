const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── URL diretti per cinema su MYmovies ────────────────────────────────────────
// Per area (misterbianco, belpasso...) cerca prima i link a cinema specifici
const CINEMA_URLS = (date) => [
  { url: `https://www.mymovies.it/cinema/catania/5190/?data=${date}`,              id: 'eplanetariston' },
  { url: `https://www.mymovies.it/cinema/catania/6011/?data=${date}`,              id: 'cinemaplanet' },
  { url: `https://www.mymovies.it/cinema/catania/5004/?data=${date}`,              id: 'cinemaking' },
  { url: `https://www.mymovies.it/cinema/catania/misterbianco/?data=${date}`,      id: 'thespaceleporte', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/belpasso/?data=${date}`,          id: 'thespaceetnapolis', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/mascalucia/?data=${date}`,        id: 'mascalucia', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/sangiovannilapunta/?data=${date}`,id: 'sangiovannilapunta', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/giarre/?data=${date}`,            id: 'giarre', isArea: true },
  { url: `https://www.mymovies.it/cinema/catania/caltagirone/?data=${date}`,       id: 'caltagirone', isArea: true },
];

function extractTimes(text) {
  return [...new Set((String(text).match(/\b([0-1]?\d|2[0-3]):[0-5]\d\b/g) || [])
    .filter(t => parseInt(t.split(':')[0]) >= 8)
  )].sort();
}

// ── Parsing per film: analizza testo riga per riga ────────────────────────────
function parseFilmsFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results = [];
  let currentTitle = null;

  const isTimeLine = line => /\b([0-1]?\d|2[0-3]):[0-5]\d\b/.test(line);
  const isFilmTitle = line =>
    line.length >= 3 && line.length <= 80 &&
    !isTimeLine(line) &&
    !line.match(/^(home|film|serie|tv|festival|cinema|dvd|news|guida|cerca|accedi|cookie|lingua|provincia|dalla|scorsa|settimana)/i) &&
    !line.includes('→') && !line.includes('http') && !line.includes('©') &&
    !line.match(/^\d+$/) && line.split(' ').length >= 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTimeLine(line)) {
      const times = extractTimes(line);
      if (times.length > 0 && currentTitle) {
        // Aggiungi orari al titolo corrente
        const existing = results.find(r => r.title === currentTitle);
        if (existing) {
          existing.times = [...new Set([...existing.times, ...times])].sort();
        } else {
          results.push({ title: currentTitle, times });
        }
      }
    } else if (isFilmTitle(line)) {
      currentTitle = line;
    }
  }

  // Fallback: se non trovati film specifici, prendi tutti gli orari
  if (results.length === 0) {
    const allTimes = extractTimes(text);
    if (allTimes.length > 0) results.push({ title: 'Programmazione', times: allTimes });
  }

  return results;
}

// ── Scraping singola pagina cinema ────────────────────────────────────────────
async function scrapeCinemaPage(browser, url, cinemaId, isArea = false) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Per pagine area: cerca prima link a cinema specifici
    if (isArea) {
      const subLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.href;
          // Link a cinema specifici hanno ID numerico
          if (/\/cinema\/catania\/\d+\//.test(href)) {
            links.push({ href, text: a.innerText?.trim() });
          }
        });
        return [...new Map(links.map(l => [l.href, l])).values()];
      });

      if (subLinks.length > 0) {
        console.log(`  Area ${cinemaId}: trovati ${subLinks.length} cinema specifici`);
        // Visita il primo cinema specifico dell'area (es. The Space)
        const subResult = [];
        for (const { href, text } of subLinks.slice(0, 2)) {
          console.log(`    → ${text} (${href})`);
          const subPage = await browser.newPage();
          await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          try {
            await subPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await new Promise(r => setTimeout(r, 1500));
            const text2 = await subPage.evaluate(() => document.body?.innerText || '');
            const films = parseFilmsFromText(text2);
            subResult.push(...films);
          } catch (e) {
            console.error(`    Errore: ${e.message}`);
          } finally {
            await subPage.close();
          }
        }
        if (subResult.length > 0) return subResult;
      }
    }

    // Leggi testo pagina e analizza film per film
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const films = parseFilmsFromText(pageText);
    return films;

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
