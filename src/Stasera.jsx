import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { fetchConcerti, fetchTeatro, fetchSagre } from './services/externalEvents';
import { trackShare } from './analytics';
import {
  ChevronLeft, Flame, MapPin, Clock, Share2, ArrowRight, Ticket,
  Music, Mic2, Theater, Church, RefreshCw, CalendarClock,
} from 'lucide-react';

// Normalizza qualunque formato data → 'YYYY-MM-DD' (coerente con getFilteredEvents di Home)
const dstr = (d) => {
  try { return new Date(d).toISOString().split('T')[0]; }
  catch { return String(d || '').slice(0, 10); }
};

const CAT_ICON = { DISCOTECA: Music, CONCERTI: Mic2, TEATRO: Theater, SAGRE: Church };
const CAT_LABEL = { DISCOTECA: 'Serata', CONCERTI: 'Concerto', TEATRO: 'Teatro', SAGRE: 'Sagra' };

/**
 * Sezione "STASERA A CATANIA" — aggregatore auto-aggiornante.
 * - Eventi locali (discoteca/serate) letti in tempo reale da Firestore `events` (onSnapshot).
 * - Concerti/Teatro/Sagre dalle cache esterne che si auto-aggiornano (scraper/API già esistenti).
 * Tutto filtrato su OGGI; se oggi è vuoto, mostra i prossimi in arrivo così la sezione
 * è sempre popolata e distribuibile da subito.
 */
const Stasera = ({ events: eventsProp = [], onSelectEvent, onBack, navigate, prRef = 'MASTER' }) => {
  const [liveEvents, setLiveEvents] = useState(eventsProp);
  const [external, setExternal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [tick, setTick] = useState(0); // forza refresh periodico dell'ora/giorno

  const todayStr = dstr(new Date());

  // Aggiornamento in tempo reale degli eventi locali (serate/discoteca)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'events'),
      (snap) => setLiveEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {} // in caso di errore, resta sui dati passati via prop
    );
    return () => unsub();
  }, []);

  // Concerti / Teatro / Sagre di stasera (dalle fonti che già si auto-aggiornano)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [concerti, teatro, sagre] = await Promise.all([
          fetchConcerti().catch(() => []),
          fetchTeatro().catch(() => []),
          fetchSagre().catch(() => []),
        ]);
        if (!alive) return;
        setExternal([...(concerti || []), ...(teatro || []), ...(sagre || [])]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  // Refresh automatico ogni 5 minuti (ora, "stasera", nuove cache)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Costruzione feed "stasera" ────────────────────────────────────────────
  const { tonight, upcoming, isFallback } = useMemo(() => {
    const local = (liveEvents || [])
      .filter((e) => !e.isCancelled)
      .map((e) => ({ ...e, _cat: e.category || 'DISCOTECA', _local: true }));
    const ext = (external || []).map((e) => ({ ...e, _cat: e.category, _local: false }));
    const all = [...local, ...ext];

    const today = all.filter((e) => dstr(e.date) === todayStr);
    const sortByTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
    today.sort(sortByTime);

    if (today.length > 0) return { tonight: today, upcoming: [], isFallback: false };

    // Fallback: prossimi eventi (entro 10 giorni) così la sezione non è mai vuota
    const soon = all
      .filter((e) => dstr(e.date) > todayStr)
      .sort((a, b) => dstr(a.date).localeCompare(dstr(b.date)) || sortByTime(a, b))
      .slice(0, 8);
    return { tonight: [], upcoming: soon, isFallback: true };
  }, [liveEvents, external, todayStr]);

  const list = isFallback ? upcoming : tonight;

  const dateLabel = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleShare = async () => {
    const url = window.location.origin + '/?stasera=1';
    try { trackShare(prRef); } catch {}
    const payload = { title: 'Stasera a Catania', text: 'Guarda cosa si fa stasera a Catania 🔥', url };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {}
  };

  const openItem = (ev) => {
    if (ev._local) {
      onSelectEvent?.(ev); // → flusso prenotazione esistente (lista / privé con acconto)
    } else if (ev.externalUrl) {
      window.open(ev.externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-8 bg-gradient-to-b from-[#D4AF37]/10 to-transparent">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-zinc-500 uppercase text-[10px] tracking-widest font-black active:scale-95 transition-all"
        >
          <ChevronLeft size={16} strokeWidth={3} /> Indietro
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Flame size={26} className="text-[#D4AF37]" />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37] flex items-center gap-2">
            <RefreshCw size={11} /> Aggiornato in tempo reale
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-none">
          Stasera<br />a Catania
        </h1>
        <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mt-3 capitalize">{dateLabel}</p>

        <button
          onClick={handleShare}
          className="mt-5 inline-flex items-center gap-3 px-6 py-3 rounded-[2rem] border border-[#D4AF37]/30 bg-zinc-900/40 text-[#D4AF37] active:scale-95 transition-all"
        >
          <Share2 size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {shareCopied ? 'Link Copiato!' : 'Condividi Stasera'}
          </span>
        </button>
      </div>

      {/* Etichetta fallback */}
      {isFallback && !loading && list.length > 0 && (
        <div className="px-6 mb-2">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            <CalendarClock size={13} className="text-[#D4AF37]" />
            Niente di confermato per stasera — ecco i prossimi in arrivo
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="px-6 pb-16 space-y-4 max-w-2xl mx-auto">
        {loading && list.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
            Carico gli eventi…
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-500 text-sm font-black uppercase tracking-widest">Ancora nessun evento in programma</p>
            <button
              onClick={() => navigate?.('/proponi-evento')}
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-[2rem] border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black uppercase tracking-widest active:scale-95"
            >
              Proponi un evento <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          list.map((ev) => {
            const Icon = CAT_ICON[ev._cat] || Music;
            const place = ev.city || ev.venue || 'Catania';
            const time = ev.time ? ev.time.slice(0, 5) : null;
            return (
              <button
                key={(ev._local ? 'l_' : 'e_') + ev.id}
                onClick={() => openItem(ev)}
                className="w-full flex items-stretch gap-4 text-left rounded-[1.75rem] border border-white/5 bg-zinc-900/40 overflow-hidden active:scale-[0.98] transition-all"
              >
                <div className="w-24 sm:w-28 flex-none bg-zinc-800 overflow-hidden">
                  {ev.imageUrl ? (
                    <img src={ev.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full min-h-[112px] grid place-items-center text-zinc-600">
                      <Icon size={28} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-3 pr-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={12} className="text-[#D4AF37] flex-none" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
                      {CAT_LABEL[ev._cat] || ev._cat}
                    </span>
                    {isFallback && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        · {new Date(ev.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-black uppercase text-sm tracking-tight leading-tight line-clamp-2">
                    {ev.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-zinc-400">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest line-clamp-1">
                      <MapPin size={11} /> {place}
                    </span>
                    {time && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                        <Clock size={11} /> {time}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-black bg-[#D4AF37] px-3 py-1.5 rounded-full">
                      {ev._local ? (<><Ticket size={12} /> Prenota</>) : (<>Info <ArrowRight size={12} /></>)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Stasera;
