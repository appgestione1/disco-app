import { db } from './firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

const gtag = (...a) => { if (typeof window !== 'undefined' && window.gtag) window.gtag(...a); };

const today = () => new Date().toISOString().split('T')[0];
const hour  = () => new Date().getHours();

async function track(docId, data) {
  try { await setDoc(doc(db, 'analytics', docId), data, { merge: true }); } catch {}
}

// ── Sessione (durata) ─────────────────────────────────────────────────────────
const _sessionStart = Date.now();
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const sec = Math.round((Date.now() - _sessionStart) / 1000);
      if (sec > 5) {
        track('sessions', {
          total: increment(1),
          total_seconds: increment(sec),
          [`daily.${today()}`]: increment(1),
        });
        gtag('event', 'session_end', { duration_seconds: sec });
      }
    }
  });
}

// ── PWA Install ───────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // già installata come PWA
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    track('installs', { pwa_sessions: increment(1), [`daily_pwa.${today()}`]: increment(1) });
  }
  // evento installazione
  window.addEventListener('appinstalled', () => {
    track('installs', { total: increment(1), [`daily.${today()}`]: increment(1) });
    gtag('event', 'pwa_install');
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function trackShare(prRef = 'MASTER') {
  const key = prRef.replace(/[./#[\]]/g, '_');
  track('shares', {
    total: increment(1),
    [`daily.${today()}`]: increment(1),
    [`by_pr.${key}`]: increment(1),
    [`hour.${hour()}`]: increment(1),
  });
  gtag('event', 'share', { method: 'app', content_id: prRef });
}

export function trackCategoryView(category) {
  track('categories', {
    [category]: increment(1),
    [`daily.${today()}.${category}`]: increment(1),
    [`hour.${hour()}`]: increment(1),
  });
  gtag('event', 'select_content', { content_type: 'category', item_id: category });
}

export function trackFilmView(title) {
  const key = title.slice(0, 50).replace(/[./#[\]]/g, '_');
  track('films', { [`titles.${key}`]: increment(1) });
  gtag('event', 'view_item', { item_name: title });
}

export function trackPageView(page) {
  track('pageviews', {
    total: increment(1),
    [`daily.${today()}`]: increment(1),
    [`hour.${today()}.${hour()}`]: increment(1),
  });
  gtag('event', 'page_view', { page_title: page });
}
