import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function fetchShowtimes(filmTitle) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap = await getDoc(doc(db, 'showtimes', today));
    if (!snap.exists()) return { times: {}, allFilms: {} };

    const cinemas = snap.data().cinemas || {};
    const normalizeT = t => t.toLowerCase().replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const needle = normalizeT(filmTitle);
    const times = {};
    const allFilms = {};

    for (const [cinemaId, films] of Object.entries(cinemas)) {
      allFilms[cinemaId] = films;
      if (films.length === 0) { times[cinemaId] = []; continue; }

      const match = films.find(f => {
        const hay = normalizeT(f.title);
        return hay.includes(needle) || needle.includes(hay) ||
          needle.split(' ').filter(w => w.length > 3).every(w => hay.includes(w));
      });

      if (match) {
        times[cinemaId] = match.times;
      } else {
        const allTimes = [...new Set(films.flatMap(f => f.times))].sort();
        if (allTimes.length > 0) times[cinemaId] = allTimes;
      }
    }
    return { times, allFilms };
  } catch { return { times: {}, allFilms: {} }; }
}

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ore

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TM_KEY = import.meta.env.VITE_TICKETMASTER_API_KEY;

async function getCached(type) {
  try {
    const snap = await getDoc(doc(db, 'external_events_cache', type + '_v2'));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (Date.now() - d.fetchedAt.toMillis() > CACHE_TTL) return null;
    return d.events;
  } catch { return null; }
}

async function setCache(type, events) {
  try {
    await setDoc(doc(db, 'external_events_cache', type + '_v2'), { events, fetchedAt: new Date() });
  } catch {}
}

async function getTrailerKey(tmdbId) {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_KEY}&language=it-IT`
    );
    const data = await res.json();
    let trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    if (!trailer) {
      const resEn = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_KEY}&language=en-US`
      );
      const dataEn = await resEn.json();
      trailer = dataEn.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    }
    return trailer?.key || null;
  } catch { return null; }
}

export async function fetchCinema() {
  const cached = await getCached('CINEMA');
  if (cached) return cached;
  if (!TMDB_KEY) return [];

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=it-IT&region=IT&page=1`
    );
    const data = await res.json();
    const movies = (data.results || []).slice(0, 20).map(m => ({
      id: `tmdb_${m.id}`,
      title: m.title,
      description: m.overview,
      imageUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      rating: m.vote_average ? m.vote_average.toFixed(1) : null,
      releaseDate: m.release_date,
      source: 'TMDB',
      category: 'CINEMA',
      trailerKey: null,
    }));

    // Fetch trailer keys in parallelo e li salva dentro ogni film
    const moviesWithTrailers = await Promise.all(
      movies.map(async m => {
        const tmdbId = m.id.replace('tmdb_', '');
        const trailerKey = await getTrailerKey(tmdbId);
        return { ...m, trailerKey };
      })
    );

    await setCache('CINEMA', moviesWithTrailers);
    return moviesWithTrailers;
  } catch { return []; }
}

export async function fetchConcerti() {
  const cached = await getCached('CONCERTI');
  if (cached) return cached;
  if (!TM_KEY) return [];

  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&city=Catania&countryCode=IT&classificationName=music&size=20&sort=date,asc`
    );
    const data = await res.json();
    const events = (data._embedded?.events || []).map(e => ({
      id: `tm_${e.id}`,
      title: e.name,
      description: e.info || '',
      imageUrl: e.images?.find(i => i.ratio === '16_9' && i.width > 500)?.url || e.images?.[0]?.url || null,
      date: e.dates?.start?.localDate,
      time: e.dates?.start?.localTime?.substring(0, 5),
      venue: e._embedded?.venues?.[0]?.name,
      city: e._embedded?.venues?.[0]?.city?.name,
      priceMin: e.priceRanges?.[0]?.min,
      priceMax: e.priceRanges?.[0]?.max,
      externalUrl: e.url,
      source: 'TICKETMASTER',
      category: 'CONCERTI',
    }));
    await setCache('CONCERTI', events);
    return events;
  } catch { return []; }
}

export async function fetchTeatro() {
  const cached = await getCached('TEATRO');
  if (cached) return cached;
  if (!TM_KEY) return [];

  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&city=Catania&countryCode=IT&classificationName=arts%2Btheatre%2Bfilm&size=20&sort=date,asc`
    );
    const data = await res.json();
    const events = (data._embedded?.events || []).map(e => ({
      id: `tm_teatro_${e.id}`,
      title: e.name,
      description: e.info || '',
      imageUrl: e.images?.find(i => i.ratio === '16_9' && i.width > 500)?.url || e.images?.[0]?.url || null,
      date: e.dates?.start?.localDate,
      time: e.dates?.start?.localTime?.substring(0, 5),
      venue: e._embedded?.venues?.[0]?.name,
      city: e._embedded?.venues?.[0]?.city?.name,
      priceMin: e.priceRanges?.[0]?.min,
      priceMax: e.priceRanges?.[0]?.max,
      externalUrl: e.url,
      source: 'TICKETMASTER',
      category: 'TEATRO',
    }));
    await setCache('TEATRO', events);
    return events;
  } catch { return []; }
}
