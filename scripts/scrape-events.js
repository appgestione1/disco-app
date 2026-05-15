const cheerio = require('cheerio');
const admin = require('firebase-admin');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const AWIN_KEY = process.env.AWIN_API_KEY || '';

// Feed ID per ogni partner (settati come segreti GitHub)
const AWIN_FEEDS = [
  { id: process.env.AWIN_FEED_TICKETONE,   name: 'TicketOne'   },
  { id: process.env.AWIN_FEED_VIVATICKET,  name: 'VivaTicket'  },
  { id: process.env.AWIN_FEED_TIQETS,      name: 'Tiqets'      },
  { id: process.env.AWIN_FEED_ILTUOTICKET, name: 'IlTuoTicket' },
].filter(f => f.id);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xml,application/xhtml+xml,*/*',
  'Accept-Language': 'it-IT,it;q=0.9',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Parole chiave geografiche ─────────────────────────────────────────────────
const CATANIA_KEYWORDS = [
  'catania', 'acireale', 'adrano', 'belpasso', 'biancavilla', 'bronte',
  'caltagirone', 'fiumefreddo', 'giarre', 'gravina di catania', 'grammichele',
  'linguaglossa', 'mascali', 'mascalucia', 'militello', 'misterbianco',
  'nicolosi', 'paternò', 'paterno', 'piedimonte etneo', 'randazzo',
  'riposto', 'san giovanni la punta', 'trecastagni', 'tremestieri',
  'valverde', 'viagrande', 'zafferana',
];

const SICILIA_KEYWORDS = [
  'palermo', 'messina', 'siracusa', 'ragusa', 'agrigento',
  'trapani', 'caltanissetta', 'enna', 'taormina',
  'modica', 'marsala', 'bagheria', 'sicili',
  ...CATANIA_KEYWORDS,
];

function isSicilia(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return SICILIA_KEYWORDS.some(k => t.includes(k));
}

function getArea(text) {
  if (!text) return 'sicilia';
  const t = text.toLowerCase();
  return CATANIA_KEYWORDS.some(k => t.includes(k)) ? 'catania' : 'sicilia';
}

// ── Normalizzazione categoria → CONCERTI o TEATRO ────────────────────────────
const TEATRO_KEYWORDS = ['teatro', 'theatre', 'spettacolo', 'musical', 'opera', 'danza', 'balletto', 'commedia', 'recital'];
const CONCERTI_KEYWORDS = ['concer', 'music', 'live', 'festival', 'tour', 'band', 'rock', 'pop', 'jazz', 'electronic', 'dj'];

function inferCategory(title, cat) {
  const text = ((title || '') + ' ' + (cat || '')).toLowerCase();
  if (TEATRO_KEYWORDS.some(k => text.includes(k))) return 'TEATRO';
  if (CONCERTI_KEYWORDS.some(k => text.includes(k))) return 'CONCERTI';
  return 'CONCERTI'; // default
}

// ── Parsing data italiana / inglese ──────────────────────────────────────────
const MONTHS_IT = { gen:0,feb:1,mar:2,apr:3,mag:4,giu:5,lug:6,ago:7,set:8,ott:9,nov:10,dic:11 };
const MONTHS_EN = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

const MONTHS_IT_FULL = { gennaio:0, febbraio:1, marzo:2, aprile:3, maggio:4, giugno:5, luglio:6, agosto:7, settembre:8, ottobre:9, novembre:10, dicembre:11 };

function parseDate(str) {
  if (!str) return null;
  // ISO: 2026-05-15
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return str.slice(0, 10);
  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // "16 Maggio 2026" — nome mese completo con anno
  const itFull = str.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
  if (itFull) {
    const month = MONTHS_IT_FULL[itFull[2].toLowerCase()];
    if (month !== undefined) return `${itFull[3]}-${String(month + 1).padStart(2, '0')}-${String(parseInt(itFull[1])).padStart(2, '0')}`;
  }
  // "7 mag" / "May 7"
  const m = str.match(/(\d{1,2})\s+([a-zà-ú]{3,})/i) || str.match(/([a-zà-ú]{3,})\s+(\d{1,2})/i);
  if (m) {
    let day, mon;
    if (/\d/.test(m[1])) { day = parseInt(m[1]); mon = m[2].slice(0,3).toLowerCase(); }
    else { mon = m[1].slice(0,3).toLowerCase(); day = parseInt(m[2]); }
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
  const m = str.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${m[2]}`;
}

// ── Download feed AWIN (XML) ──────────────────────────────────────────────────
async function downloadAwinFeed(feedId) {
  const url = `https://productdata.awin.com/datafeed/download/apikey/${AWIN_KEY}/language/it/fid/${feedId}/columns/aw_product_id,product_name,description,merchant_image_url,aw_image_url,merchant_deep_link,aw_deep_link,base_price,store_price,currency,valid_to,start_date,custom_1,custom_2,custom_3,custom_4,custom_5,category_name,brand_name/format/xml/`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Parser XML feed AWIN ──────────────────────────────────────────────────────
function parseAwinXml(xml, sourceName) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const events = [];

  $('product, item, entry').each((_, el) => {
    const $el = $(el);

    const get = (...tags) => {
      for (const t of tags) {
        const v = $el.find(t).first().text().trim();
        if (v) return v;
      }
      return '';
    };

    const title       = get('product_name', 'title', 'name');
    const description = get('description', 'summary');
    const imageUrl    = get('aw_image_url', 'merchant_image_url', 'image', 'image_url');
    const deepLink    = get('aw_deep_link', 'merchant_deep_link', 'link');
    const price       = get('base_price', 'store_price', 'price');
    const category    = get('category_name', 'category');

    // Custom fields — i merchant eventi usano questi per data/venue/city
    const custom1 = get('custom_1');
    const custom2 = get('custom_2');
    const custom3 = get('custom_3');
    const custom4 = get('custom_4');
    const custom5 = get('custom_5');

    // start_date / valid_to per eventi
    const startDate = get('start_date', 'valid_from');
    const brandName = get('brand_name');

    if (!title || !deepLink) return;

    // Determina data e venue dai campi custom o start_date
    // (ogni merchant usa campi diversi — gestiamo i casi più comuni)
    const allCustom = [custom1, custom2, custom3, custom4, custom5].filter(Boolean);
    const dateRaw   = startDate || allCustom.find(c => /\d{4}|\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+[a-z]{3}/i.test(c)) || '';
    const venue     = allCustom.find(c => c !== dateRaw && c.length > 3 && c.length < 100 && !/^\d+[.,]?\d*$/.test(c)) || brandName || '';
    const cityRaw   = custom3 || custom4 || custom5 || venue;

    // Filtro geografico: solo Sicilia
    const locationText = [venue, cityRaw, custom1, custom2, custom3, custom4, custom5].join(' ');
    if (!isSicilia(locationText)) return;

    const idRaw = get('aw_product_id', 'merchant_product_id', 'id') || Math.random().toString(36).slice(2);

    events.push({
      id: `awin_${sourceName.toLowerCase()}_${idRaw}`.replace(/\s+/g, '_'),
      title,
      description: description.slice(0, 300),
      imageUrl: imageUrl || null,
      externalUrl: deepLink,
      date: parseDate(dateRaw),
      time: parseTime(dateRaw),
      venue: venue || null,
      price: price || null,
      source: sourceName.toUpperCase(),
      category: inferCategory(title, category),
      area: getArea(locationText),
    });
  });

  return events;
}

// ── Parser Eventbrite (fallback HTML) ─────────────────────────────────────────
function parseEventbrite(html, category) {
  const $ = cheerio.load(html);
  const events = [];
  const seen = new Set();

  $('a[href*="/e/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/-(\d{10,})(?:\?|$)/);
    if (!idMatch) return;
    const numId = idMatch[1];
    if (seen.has(numId)) return;
    seen.add(numId);

    const externalUrl = href.split('?')[0];

    let $card = $a;
    for (let i = 0; i < 6; i++) {
      const $p = $card.parent();
      if (!$p.length || $p.is('body')) break;
      $card = $p;
      if ($card.find('img').length && $card.find('h3, h2').length) break;
    }

    const $h = $card.find('h3, h2').first();
    const title = ($h.length ? $h.text() : $a.text()).replace(/\s+/g, ' ').trim().split('\n')[0].trim();
    if (!title || title.length < 4) return;

    const $img = $card.find('img').first();
    const rawSrc = $img.attr('src') || '';
    const imageUrl = rawSrc.includes('evbuc.com') ? rawSrc : null;

    const pTexts = [];
    $card.find('p').each((_, p) => {
      const t = $(p).text().replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 200) pTexts.push(t);
    });
    const dateRaw = pTexts.find(t => /\d/.test(t)) || null;
    const venue   = pTexts.find(t => t !== dateRaw) || null;

    const locationText = [venue, dateRaw].join(' ');
    events.push({
      id: `eb_${numId}`,
      title,
      description: '',
      imageUrl,
      externalUrl,
      date: parseDate(dateRaw),
      time: parseTime(dateRaw),
      venue: venue || null,
      price: null,
      source: 'EVENTBRITE',
      category,
      area: getArea(locationText),
    });
  });

  return events;
}

// ── Scraper puntoeacapo.uno ───────────────────────────────────────────────────
async function scrapePuntoeacapo() {
  const url = 'https://puntoeacapo.uno/spettacoli/';
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const events = [];
  const seen = new Set();

  $('a[href*="/spettacolo/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    if (seen.has(href)) return;
    seen.add(href);

    // Nuova struttura: titolo in p.event-title, data/luogo in .meta-line
    const title = $a.find('p.event-title').clone().find('span').remove().end().text().trim();
    if (!title) return;

    const imageUrl = $a.find('img.event-img').attr('src') || $a.find('img').first().attr('src') || null;

    // ".meta-line" contiene es. "16 Mag 2026 / Palermo" o "21 Mag – 24 Nov 2026 / Catania / Palermo"
    const metaLine = $a.find('.meta-line').first().text().trim();
    const parts    = metaLine.split('/');
    const datePart = parts[0]?.trim() || '';
    const locPart  = parts.slice(1).map(s => s.trim()).filter(Boolean).join(', ');

    if (!isSicilia(locPart) && !isSicilia(title)) return;

    const slug = href.replace(/.*\/spettacolo\//, '').replace(/\/$/, '') || title.toLowerCase().replace(/\s+/g, '-');
    const id = `pac_${slug}`;

    events.push({
      id,
      title,
      description: '',
      imageUrl,
      externalUrl: href,
      date: parseDate(datePart),
      time: null,
      venue: locPart || null,
      city: locPart || null,
      price: null,
      source: 'PUNTOEACAPO',
      category: inferCategory(title, ''),
      area: getArea(locPart || title),
    });
  });

  return events;
}

// ── Scraper VivaSicilia.com — pagine mensili (nessuna visita individuale) ──────
const VS_BASE = 'https://www.vivasicilia.com';
const VS_MONTHS = [
  'gennaio','febbraio','marzo','aprile','maggio','giugno',
  'luglio','agosto','settembre','ottobre','novembre','dicembre',
];

async function scrapeVivaSiciliaMonth(monthIdx, year) {
  const slug = VS_MONTHS[monthIdx];
  const url = `${VS_BASE}/feste-e-sagre-sicilia-${slug}/`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const events = [];
  const seen = new Set();

  // Struttura: div.gt-event-style-4 → div.gt-image → a[href][title] → img
  $('.gt-event-style-4').each((_, card) => {
    const $card = $(card);
    const $a = $card.find('.gt-image a[href]').first();
    const href = $a.attr('href') || '';
    const eventUrl = href.startsWith('/') ? `${VS_BASE}${href}` : href;
    if (!eventUrl.startsWith(VS_BASE) || seen.has(eventUrl)) return;
    seen.add(eventUrl);

    const title = $a.attr('title') || '';
    if (title.length < 3) return;

    const $img = $a.find('img').first();
    const rawSrc = $img.attr('src') || '';
    const imageUrl = rawSrc.startsWith('/') ? `${VS_BASE}${rawSrc}` : rawSrc || null;

    // Data e città dal testo della card (format: "Titolo\nGG Mese YYYY\nCittà")
    const cardText = $card.text().replace(/\s+/g, ' ').trim();
    const dateMatch = cardText.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
    let date = null;
    if (dateMatch) {
      const mo = MONTHS_IT_FULL[dateMatch[2].toLowerCase()];
      if (mo !== undefined) date = `${dateMatch[3]}-${String(mo + 1).padStart(2,'0')}-${String(parseInt(dateMatch[1])).padStart(2,'0')}`;
    }

    // Città: ultima parte del testo card dopo data
    const afterDate = dateMatch ? cardText.slice(cardText.indexOf(dateMatch[0]) + dateMatch[0].length).trim() : '';
    const city = afterDate.split(/\s{2,}/)[0]?.trim() || title.match(/[–\-]\s*(.+)$/)?.[1]?.trim() || null;

    const slug = eventUrl.slice(VS_BASE.length + 1).replace(/\/$/, '');
    events.push({
      id: `vs_${slug.replace(/[^a-z0-9]/gi, '_')}`,
      title,
      description: '',
      imageUrl,
      externalUrl: eventUrl,
      date,
      time: null,
      venue: city || null,
      city: city || null,
      price: null,
      source: 'VIVASICILIA',
      category: 'SAGRE',
      area: getArea(city || title),
    });
  });

  return events;
}

async function scrapeVivaSicilia() {
  const now = new Date();
  const curMonth = now.getMonth();   // 0-based
  const curYear  = now.getFullYear();
  const allEvents = [];
  const seenIds   = new Set();

  // Mese corrente + i 5 successivi
  for (let i = 0; i < 6; i++) {
    const monthIdx = (curMonth + i) % 12;
    const year = curYear + Math.floor((curMonth + i) / 12);
    process.stdout.write(`  VivaSicilia [${VS_MONTHS[monthIdx]} ${year}]: `);
    try {
      await delay(900);
      const evs = await scrapeVivaSiciliaMonth(monthIdx, year);
      const fresh = evs.filter(e => !seenIds.has(e.id));
      fresh.forEach(e => seenIds.add(e.id));
      allEvents.push(...fresh);
      console.log(`${fresh.length} eventi`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
  return allEvents;
}

// ── Salvataggio Firestore (non sovrascrive con 0 se la cache esistente ha dati) ──
async function saveToFirestore(category, events) {
  if (!events.length) {
    console.log(`  ⚠ ${category}: nessun evento trovato, cache esistente preservata`);
    // Aggiorna solo il timestamp per evitare scadenza cache lato frontend
    try {
      const existing = await db.collection('external_events_cache').doc(`${category}_v6`).get();
      if (existing.exists && (existing.data().events || []).length > 0) {
        await db.collection('external_events_cache').doc(`${category}_v6`).update({
          fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  ↺ ${category}_v6: timestamp aggiornato, ${existing.data().events.length} eventi preservati`);
      }
    } catch (e) { console.log(`  ✗ update timestamp: ${e.message}`); }
    return;
  }
  await db.collection('external_events_cache').doc(`${category}_v6`).set({
    events,
    fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`  ✓ ${category}_v6: ${events.length} eventi salvati`);
  events.slice(0, 3).forEach(e => console.log(`    - ${e.title} | ${e.date || '?'} | ${e.venue || '?'} | ${e.area}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Scraper eventi — Catania & Sicilia ===\n');

  const allConcerti = [];
  const allTeatro   = [];

  // ── 1. AWIN feeds (se API key + feed ID configurati) ─────────────────────
  if (AWIN_KEY && AWIN_FEEDS.length > 0) {
    console.log(`AWIN: ${AWIN_FEEDS.length} feed configurati`);
    for (const feed of AWIN_FEEDS) {
      process.stdout.write(`  [${feed.name}] download... `);
      try {
        const xml = await downloadAwinFeed(feed.id);
        const events = parseAwinXml(xml, feed.name);
        console.log(`${events.length} eventi in Sicilia`);
        events.forEach(e => (e.category === 'TEATRO' ? allTeatro : allConcerti).push(e));
      } catch (e) {
        console.log(`✗ ${e.message}`);
      }
      await delay(1000);
    }
  } else {
    console.log('AWIN: nessuna chiave configurata — uso Eventbrite come fallback');
  }

  // ── 2. Puntoeacapo.uno (sempre) ──────────────────────────────────────────
  process.stdout.write('Puntoeacapo.uno: fetch... ');
  try {
    const pacEvents = await scrapePuntoeacapo();
    console.log(`${pacEvents.length} eventi in Sicilia`);
    pacEvents.forEach(e => (e.category === 'TEATRO' ? allTeatro : allConcerti).push(e));
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
  await delay(1500);

  // ── 3. Eventbrite — additivo (aggiunge a AWIN+pac, non li sostituisce) ──────
  console.log('\nEventbrite (additivo)...');
  const ebUrls = [
    { url: 'https://www.eventbrite.it/d/italy--catania/music--events/', cat: 'CONCERTI' },
    { url: 'https://www.eventbrite.it/d/italy--catania/performing-arts--events/', cat: 'TEATRO' },
  ];
  const existingIds = new Set([...allConcerti, ...allTeatro].map(e => e.id));

  for (const { url, cat } of ebUrls) {
    process.stdout.write(`  [Eventbrite ${cat}] fetch... `);
    try {
      const res = await fetch(url, { headers: HEADERS });
      const html = await res.text();
      const events = parseEventbrite(html, cat).filter(e => !existingIds.has(e.id));
      console.log(`${events.length} nuovi eventi`);
      if (cat === 'CONCERTI') allConcerti.push(...events);
      else allTeatro.push(...events);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
    await delay(2000);
  }

  // ── 4. VivaSicilia (sagre ed eventi) ────────────────────────────────────
  const allSagre = [];
  process.stdout.write('\nVivaSicilia.com: fetch listing... ');
  try {
    const sagre = await scrapeVivaSicilia();
    console.log(`${sagre.length} eventi`);
    allSagre.push(...sagre);
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }

  // ── 5. Salvataggio ────────────────────────────────────────────────────────
  console.log('\n=== Salvataggio Firestore ===');
  await saveToFirestore('CONCERTI', allConcerti);
  await saveToFirestore('TEATRO',   allTeatro);
  await saveToFirestore('SAGRE',    allSagre);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
