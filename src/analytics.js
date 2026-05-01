import { db } from './firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

// ── Google Analytics 4 ────────────────────────────────────────────────────────
const GA_ID = import.meta.env.VITE_GA4_ID;
if (GA_ID && !document.getElementById('ga4-script')) {
  const s = document.createElement('script');
  s.id = 'ga4-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

const gtag = (...args) => { if (window.gtag) window.gtag(...args); };

const today = () => new Date().toISOString().split('T')[0];

async function track(docId, data) {
  try {
    await setDoc(doc(db, 'analytics', docId), data, { merge: true });
  } catch {}
}

export function trackShare() {
  track('shares', { total: increment(1), [`daily.${today()}`]: increment(1) });
  gtag('event', 'share', { method: 'app' });
}

export function trackCategoryView(category) {
  track('categories', { [category]: increment(1), [`daily.${today()}.${category}`]: increment(1) });
  gtag('event', 'select_content', { content_type: 'category', item_id: category });
}

export function trackFilmView(title) {
  const key = title.slice(0, 50).replace(/[./#[\]]/g, '_');
  track('films', { [`titles.${key}`]: increment(1) });
  gtag('event', 'view_item', { item_name: title, item_category: 'CINEMA' });
}

export function trackBooking(type) {
  track('bookings', { [type]: increment(1), [`daily.${today()}.${type}`]: increment(1) });
  gtag('event', 'purchase', { transaction_id: Date.now(), items: [{ item_name: type }] });
}

export function trackPageView(page) {
  track('pageviews', { total: increment(1), [page]: increment(1), [`daily.${today()}`]: increment(1) });
  gtag('event', 'page_view', { page_title: page });
}
