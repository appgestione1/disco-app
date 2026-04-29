const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// ── Parsing data italiana (es. "gio 7 mag, 21:00" o "Thu, May 7, 9:00 PM") ──
const MONTHS_IT = { gen:0,feb:1,mar:2,apr:3,mag:4,giu:5,lug:6,ago:7,set:8,ott:9,nov:10,dic:11 };
const MONTHS_EN = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseDate(str) {
  if (!str) return null;
  str = str.toLowerCase();
  // "7 mag" / "7 maggio"
  let m = str.match(/(\d{1,2})\s+([a-zà-ú]{3,})/);
  if (m) {
    const day = parseInt(m[1]);
    const mon = m[2].slice(0, 3);
    const month = MONTHS_IT[mon] ?? MONTHS_EN[mon];
    if (month !== undefined) {
      const year = new Date().getFullYear();
      const d = new Date(year, month, day);
      if (d < new Date()) d.setFullYear(year + 1);
      return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function parseTime(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// ── Parser Eventbrite ─────────────────────────────────────────────────────────
function parseEventbrite(html, category) {
  const $ = cheerio.load(html);
  const events = [];
  const seen = new Set();

  $('a[href*="/e/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';

    // Estrai ID numerico dall'URL (≥10 cifre per escludere link UI)
    const idMatch = href.match(/-(\d{10,})(?:\?|$)/);
    if (!idMatch) return;
    const numId = idMatch[1];
    if (seen.has(numId)) return;
    seen.add(numId);

    const externalUrl = href.split('?')[0];

    // Sali di livello per trovare il card container con immagine + titolo
    let $card = $a;
    for (let i = 0; i < 6; i++) {
      const $p = $card.parent();
      if (!$p.length || $p.is('body')) break;
      $card = $p;
      if ($card.find('img').length && $card.find('h3, h2').length) break;
    }

    // Titolo
    const $h = $card.find('h3, h2').first();
    const title = ($h.length ? $h.text() : $a.text()).replace(/\s+/g, ' ').trim().split('\n')[0].trim();
    if (!title || title.length < 4) return;

    // Immagine
    const $img = $card.find('img').first();
    const rawSrc = $img.attr('src') || $img.attr('data-src') || '';
    const imageUrl = rawSrc.includes('evbuc.com') || rawSrc.includes('cdn.evbuc') ? rawSrc : null;

    // Testi <p> per data e venue
    const pTexts = [];
    $card.find('p').each((_, p) => {
      const t = $(p).text().replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 200) pTexts.push(t);
    });

    const dateRaw = pTexts.find(t => /\d/.test(t)) || null;
    const venue = pTexts.find(t => t !== dateRaw) || null;

    events.push({
      id: `eb_${numId}`,
      title,
      description: '',
      imageUrl,
      externalUrl,
      date: parseDate(dateRaw),
      time: parseTime(dateRaw),
      venue: venue || null,
      source: 'EVENTBRITE',
      category,
    });
  });

  return events;
}

// ── Scraping di una categoria + salvataggio Firestore ─────────────────────────
async function scrapeCategory(category, url) {
  console.log(`\n=== ${category} — Eventbrite ===`);
  try {
    const html = await fetchHtml(url);
    const events = parseEventbrite(html, category);
    console.log(`  ${events.length} eventi trovati`);

    if (events.length === 0) {
      console.log('  ⚠ Nessun evento — salto');
      return;
    }

    await db.collection('external_events_cache').doc(`${category}_v4`).set({
      events,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ Salvato in Firestore: ${category}_v4`);
    events.slice(0, 3).forEach(e => console.log(`    - ${e.title} | ${e.date || '?'} | ${e.venue || '?'}`));
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Scraper eventi Eventbrite — Catania ===');
  await scrapeCategory('CONCERTI', 'https://www.eventbrite.it/d/italy--catania/music--events/');
  await delay(2000);
  await scrapeCategory('TEATRO', 'https://www.eventbrite.it/d/italy--catania/performing-arts--events/');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
