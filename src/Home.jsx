import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { fetchCinema, fetchConcerti, fetchTeatro, fetchSagre, fetchShowtimes, fetchLocalCinemaFilms } from './services/externalEvents';
import { trackShare, trackCategoryView, trackFilmView, trackPageView } from './analytics';
import { CATANIA_CINEMAS } from './constants/cataniaCinemas';

const EXTERNAL_CATS = ['CINEMA', 'TEATRO', 'CONCERTI', 'SAGRE'];
const ARENA_CINEMA_IDS = ['adua', 'argentina', 'corsaro', 'moderno'];

// ── FILM DETAIL (Cinema) ──────────────────────────────────────────────────────
const PRIORITY_CINEMA_IDS = ['cinestar', 'thespaceetnapolis', 'ucicentrosicilia', 'cinemaplanet'];

const toSlug = t => t.toLowerCase()
  .replace(/[àáâ]/g,'a').replace(/[èéê]/g,'e').replace(/[ìíî]/g,'i')
  .replace(/[òóô]/g,'o').replace(/[ùúû]/g,'u')
  .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-').trim();

const buildTicketUrl = (cinema, filmTitle) => {
  if (!cinema.ticketSearchUrl) return null;
  if (cinema.id === 'thespaceetnapolis') {
    // URL diretto al film su The Space: /film/[slug]
    return `https://www.thespacecinema.it/film/${toSlug(filmTitle)}`;
  }
  // UCI e altri: URL statico della pagina cinema
  return cinema.ticketSearchUrl;
};

const FilmDetail = ({ film, onClose }) => {
  const trailerKey = film.trailerKey || null;
  const [showTrailer, setShowTrailer] = useState(false);
  const [showtimes, setShowtimes] = useState({});
  const [loadingShowtimes, setLoadingShowtimes] = useState(true);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const dateChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const sortedCinemas = [
    ...PRIORITY_CINEMA_IDS.map(id => CATANIA_CINEMAS.find(c => c.id === id)).filter(Boolean),
    ...CATANIA_CINEMAS.filter(c => !PRIORITY_CINEMA_IDS.includes(c.id)),
  ];

  useEffect(() => {
    setLoadingShowtimes(true);
    fetchShowtimes(film.title, selectedDate).then(({ times }) => {
      setShowtimes(times);
      setLoadingShowtimes(false);
    });
  }, [film.title, selectedDate]);

  return (
    <div className="min-h-screen bg-black text-white p-6 animate-in slide-in-from-right duration-500 overflow-x-hidden pb-32">
      <button onClick={onClose} className="mb-6 flex items-center gap-2 text-zinc-500 uppercase text-[10px] tracking-widest font-black">
        <ChevronLeft size={16} /> CHIUDI
      </button>

      {/* Poster o Trailer */}
      <div className="w-full mb-6 rounded-[2rem] overflow-hidden shadow-2xl bg-zinc-900">
        {showTrailer && trailerKey ? (
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?rel=0&autoplay=1`}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="relative">
            {film.imageUrl
              ? <img src={film.backdropUrl || film.imageUrl} alt={film.title} className="w-full aspect-video object-cover" />
              : <div className="w-full aspect-video flex items-center justify-center"><Film size={48} className="text-zinc-700" /></div>
            }
            {trailerKey ? (
              <button
                onClick={() => setShowTrailer(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 active:bg-black/60 transition-all group">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl group-active:scale-90 transition-transform">
                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-black border-b-[10px] border-b-transparent ml-1" />
                </div>
              </button>
            ) : film.trailerSearchUrl ? (
              <a
                href={film.trailerSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-full border border-white/20 active:scale-95 transition-transform flex items-center gap-1.5">
                <span>▶</span> Cerca Trailer
              </a>
            ) : null}
          </div>
        )}
      </div>

      {showTrailer && (
        <button onClick={() => setShowTrailer(false)} className="mb-4 text-zinc-500 font-black text-[10px] uppercase tracking-widest">
          ✕ Chiudi trailer
        </button>
      )}

      <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-1">{film.title}</h2>
      {film.rating && <p className="text-[#D4AF37] font-black text-sm mb-4">★ {film.rating} / 10</p>}

      {film.description && (
        <div className="mb-8 p-4 bg-zinc-900/50 border-l-4 border-[#D4AF37] rounded-r-2xl">
          <p className="text-sm text-zinc-300 italic leading-relaxed">{film.description}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="h-[1px] flex-1 bg-[#D4AF37]/20" />
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">Cinema a Catania e Provincia</p>
        <div className="h-[1px] flex-1 bg-[#D4AF37]/20" />
      </div>

      {/* Selettore data */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1 -mx-1 px-1">
        {dateChips.map(d => {
          const date = new Date(d + 'T12:00:00');
          const isSelected = d === selectedDate;
          const isToday = d === todayStr;
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-2xl font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 ${
                isSelected ? 'bg-[#D4AF37] text-black' : 'bg-zinc-900 text-zinc-500 border border-white/5'
              }`}
            >
              <span>{isToday ? 'OGGI' : date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase().replace('.', '')}</span>
              <span className="text-[10px] font-black">{date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {sortedCinemas.map(cinema => (
          <div key={cinema.id} className="bg-zinc-900/80 border border-white/5 rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-black uppercase text-sm text-white">{cinema.name}</p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{cinema.area}</p>
              </div>
              <a href={cinema.mapsUrl} target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0">
                Mappa
              </a>
            </div>

            {loadingShowtimes ? (
              <div className="flex justify-center py-2">
                <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {showtimes[cinema.id] ? (() => {
                  const nowMin = selectedDate === todayStr
                    ? new Date().getHours() * 60 + new Date().getMinutes()
                    : 0;
                  const visible = showtimes[cinema.id].filter(t => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m > nowMin;
                  });
                  return visible.length > 0 ? (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Orari</p>
                      <div className="flex flex-wrap gap-2">
                        {visible.map(time => (
                          <span key={time} className="bg-[#D4AF37] text-black font-black text-xs px-3 py-1.5 rounded-full">
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 py-1">
                      {selectedDate === todayStr ? 'Fine programmazione odierna' : 'Nessuno spettacolo'}
                    </p>
                  );
                })() : (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent('"' + film.title + '" ' + cinema.name + ' orari Catania')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block w-full bg-white text-black text-center py-3 rounded-full font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">
                    Cerca Orari
                  </a>
                )}
                {(() => {
                  const nowMin = selectedDate === todayStr ? new Date().getHours() * 60 + new Date().getMinutes() : 0;
                  const hasTimes = showtimes[cinema.id]?.some(t => { const [h,m] = t.split(':').map(Number); return h*60+m > nowMin; });
                  return cinema.ticketSearchUrl && hasTimes ? (
                    <a
                      href={buildTicketUrl(cinema, film.title)}
                      target="_blank" rel="noopener noreferrer"
                      className="block w-full bg-[#D4AF37] text-black text-center py-3 rounded-full font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">
                      🎟 Acquista Biglietto
                    </a>
                  ) : (
                    <span className="block w-full border border-zinc-800 text-zinc-700 text-center py-3 rounded-full font-black uppercase text-[10px] tracking-widest cursor-not-allowed select-none">
                      Acquista Biglietto
                    </span>
                  );
                })()}

              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-[8px] text-zinc-700 font-black uppercase tracking-widest mt-8 pb-8">
        Orari rilevati dai siti ufficiali · Soggetti a variazioni
      </p>
    </div>
  );
};
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import {
  ChevronLeft, ChevronDown, Star, Minus, Plus, Calendar, Crown, Lock, ArrowRight, ShieldCheck,
  Music, Theater, Film, Mic2, Sun, Utensils, LayoutGrid, Download, Send, Phone,
  Users, Edit3, X, PlusCircle, Share2, Church, Power
} from 'lucide-react';

// --- GRATTA E VINCI ---
const ScratchCard = ({ onWin }) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [won] = useState(Math.random() < 0.15);
  const [winTriggered, setWinTriggered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = 300; const height = 150;
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#D4AF37');
    gradient.addColorStop(0.5, '#F9E498');
    gradient.addColorStop(1, '#B8860B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH TO REVEAL', width / 2, height / 2);

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
        y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top,
      };
    };
    const scratch = (e) => {
      if (!isDrawingRef.current && e.type !== 'mousemove') return;
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
      const { x, y } = getPos(e);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();
      if (won && !winTriggered) { setWinTriggered(true); if (onWin) onWin(); }
    };
    const onStart = (e) => { isDrawingRef.current = true; scratch(e); };
    const onMove = (e) => { if (isDrawingRef.current || e.type === 'touchmove') scratch(e); };
    const onEnd = () => { isDrawingRef.current = false; };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart);
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [won, winTriggered, onWin]);

  return (
    <div className="relative w-[300px] h-[150px] bg-zinc-900 flex items-center justify-center border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-2xl">
      <span className="text-xl font-black text-white text-center px-4 uppercase italic select-none">
        {won ? '🍹 VIP DRINK VINTO!' : '❌ RITENTA'}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none z-10" width="300" height="150" />
    </div>
  );
};

// --- PASS PRIVÉ (un QR univoco per ospite) ---
const PrivePassCard = ({ ticketId, guestIndex, totalGuests, customerName, priveName, priveInclusions, pricePerPerson, eventTitle }) => {
  const passRef = useRef(null);

  const buildCanvas = async () => {
    if (!passRef.current) return null;
    return html2canvas(passRef.current, { backgroundColor: '#000000', scale: 2 });
  };

  const handleDownload = async () => {
    const canvas = await buildCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `Prive_${customerName}_Ospite${guestIndex}.png`;
    link.click();
  };

  const handleShare = async () => {
    const canvas = await buildCanvas();
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      const file = new File([blob], `Prive_${customerName}_Ospite${guestIndex}.png`, { type: 'image/png' });

      // Web Share API con supporto file (funziona su mobile iOS/Android)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Pass Privé — Ospite ${guestIndex}/${totalGuests}`,
            text: `Il tuo pass PRIVÉ per ${eventTitle}. Mostralo all'ingresso. ID: ${ticketId}`,
            files: [file],
          });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return; // utente ha annullato
          // altro errore → fallback
        }
      }

      // Fallback desktop: scarica l'immagine + apre WhatsApp
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `Prive_${customerName}_Ospite${guestIndex}.png`;
      link.click();

      setTimeout(() => {
        const msg = `🎉 *Pass PRIVÉ — Ospite ${guestIndex}/${totalGuests}*\n\n🍾 *${priveName}*${priveInclusions ? `\n✅ ${priveInclusions}` : ''}\n💰 Quota ospite: *€${pricePerPerson.toFixed(2)}*\n\n🎫 ID Ticket: \`${ticketId}\`\n\n📎 _Allega l'immagine del pass appena scaricata._`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }, 600);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div ref={passRef} className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-8 flex flex-col items-center border border-[#D4AF37]/30 shadow-2xl overflow-hidden">
        <div className="absolute top-6 right-6 opacity-5"><Crown size={120} /></div>

        <div className="w-full flex items-center justify-between mb-8">
          <span className="text-[#D4AF37] font-black text-2xl italic tracking-widest uppercase">PRIVÉ</span>
          <span className="text-[8px] font-black text-zinc-500 tracking-widest uppercase bg-zinc-800 px-2 py-1 rounded-full">
            OSPITE {guestIndex}/{totalGuests}
          </span>
        </div>

        <div className="bg-white p-4 rounded-[1.5rem] mb-8">
          <QRCodeCanvas value={ticketId} size={160} />
        </div>

        <p className="text-3xl font-black italic uppercase leading-none tracking-tighter text-center mb-1">{customerName}</p>
        <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mb-4">{priveName}</p>

        {priveInclusions && (
          <p className="text-[10px] text-zinc-400 font-bold italic text-center mb-6 normal-case">{priveInclusions}</p>
        )}

        <div className="w-full bg-black/50 rounded-2xl p-4 text-center mb-6 border border-white/5">
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Quota per ospite</p>
          <p className="text-2xl font-black text-[#D4AF37] italic">€{pricePerPerson.toFixed(2)}</p>
        </div>

        <div className="w-full flex justify-between items-end border-t border-white/10 pt-6">
          <div>
            <p className="text-[8px] text-zinc-600 font-black uppercase mb-1">TICKET ID</p>
            <p className="font-mono text-xs font-bold">{ticketId}</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-zinc-600 font-black uppercase mb-1">EVENTO</p>
            <p className="text-[#D4AF37] font-black italic text-xs leading-none">{eventTitle}</p>
          </div>
        </div>
      </div>

      {/* Pulsanti download + WhatsApp */}
      <div className="flex gap-3 mt-4 mb-2 w-full max-w-sm">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-full font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-transform"
        >
          <Download size={15} /> Scarica
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-full font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-transform"
        >
          <Send size={15} /> WhatsApp
        </button>
      </div>
    </div>
  );
};

// --- HOME ---
const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const prRef = searchParams.get('ref') || 'MASTER';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [bookingMode, setBookingMode] = useState(null);
  const [prName, setPrName] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [groupNames, setGroupNames] = useState('');
  const [guestCount, setGuestCount] = useState(1);

  const [priveGuests, setPriveGuests] = useState(1);
  const PRIVE_ADVANCE_FEE = 50;

  const [selectedPriveType, setSelectedPriveType] = useState(null);
  const [priveTickets, setPriveTickets] = useState([]);

  const [ticketId, setTicketId] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [winClaimed, setWinClaimed] = useState(false);

  const [clickCount, setClickCount] = useState(0);
  const [lockClickCount, setLockClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showSuperAdminLogin, setShowSuperAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');

  const [starSequence, setStarSequence] = useState([]);
  const [externalEvents, setExternalEvents] = useState([]);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [filmsWithShowtimesToday, setFilmsWithShowtimesToday] = useState(new Set());
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedEventMonth, setSelectedEventMonth] = useState(null);
  const [concertiFilter, setConcertiFilter] = useState('TUTTI'); // 'TUTTI' | 'OGGI' | 'DATA'
  const [selectedConcertiDate, setSelectedConcertiDate] = useState(new Date());
  const [extendSicilia, setExtendSicilia] = useState(true);
  const [sagreMonth, setSagreMonth] = useState(null);
  const [sagreProvince, setSagreProvince] = useState('TUTTI');
  const [sagreCity, setSagreCity] = useState('TUTTI');
  const [selectedArena, setSelectedArena] = useState('TUTTE');
  const [arenaDate, setArenaDate] = useState(new Date().toISOString().split('T')[0]);
  const [arenaFilms, setArenaFilms] = useState({});
  const [loadingArena, setLoadingArena] = useState(false);
  const [arenaTrailerKey, setArenaTrailerKey] = useState(null);
  const [expandedArenaDescs, setExpandedArenaDescs] = useState(new Set());
  const [showPrAccess, setShowPrAccess] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showPrPasswordModal, setShowPrPasswordModal] = useState(false);
  const [prPasswordInput, setPrPasswordInput] = useState('');
  const [isFirstPrAccess, setIsFirstPrAccess] = useState(false);

  const passRef = useRef(null);

  const [popupData, setPopupData] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupCountdown, setPopupCountdown] = useState(5);
  const [savingGallery, setSavingGallery] = useState(false);
  const popupRef = useRef(null);

  const categories = [
    { id: 'DISCOTECA', label: 'DISCOTECA', icon: Music },
    { id: 'TEATRO', label: 'TEATRO', icon: Theater },
    { id: 'CINEMA', label: 'CINEMA', icon: Film },
    { id: 'CONCERTI', label: 'CONCERTI', icon: Mic2 },
    { id: 'ARENE ESTIVE', label: 'ARENE ESTIVE', icon: Sun },
    { id: 'PUB', label: 'LOUNGE/PUB', icon: Utensils },
    { id: 'SAGRE', label: 'SAGRE', icon: Church },
    { id: 'TUTTI', label: 'ALTRO', icon: LayoutGrid },
  ];

  useEffect(() => { fetchEvents(); fetchPrInfo(); fetchPopup(); trackPageView('home'); }, [prRef]);

  useEffect(() => {
    if (!showPopup || popupCountdown <= 0) return;
    const t = setTimeout(() => setPopupCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showPopup, popupCountdown]);

  useEffect(() => {
    if (!activeCategory || !EXTERNAL_CATS.includes(activeCategory)) return;
    setExternalEvents([]);
    setLoadingExternal(true);
    setSelectedEventMonth(null);
    setConcertiFilter('TUTTI');
    if (activeCategory === 'CINEMA') {
      fetchCinema().then(async tmdb => {
        const local = await fetchLocalCinemaFilms(tmdb);
        setExternalEvents([...tmdb, ...local]);
        setLoadingExternal(false);
      });
    } else {
      const fetcher = { TEATRO: fetchTeatro, CONCERTI: fetchConcerti, SAGRE: fetchSagre }[activeCategory];
      fetcher().then(data => { setExternalEvents(data); setLoadingExternal(false); });
    }
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory !== 'ARENE ESTIVE') return;
    setLoadingArena(true);
    getDoc(doc(db, 'showtimes', arenaDate)).then(snap => {
      if (!snap.exists()) { setArenaFilms({}); setLoadingArena(false); return; }
      const cinemas = snap.data().cinemas || {};
      const data = {};
      for (const id of ARENA_CINEMA_IDS) {
        if (cinemas[id]?.length) data[id] = cinemas[id];
      }
      setArenaFilms(data);
      setLoadingArena(false);
    }).catch(() => { setArenaFilms({}); setLoadingArena(false); });
  }, [activeCategory, arenaDate]);

  const fetchEvents = async () => {
    try {
      const evSnap = await getDocs(collection(db, 'events'));
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchPrInfo = async () => {
    try {
      const snap = await getDoc(doc(db, 'prs_registry', prRef));
      if (!snap.exists()) {
        setSearchParams({ ref: 'MASTER' }, { replace: true });
        return;
      }
      const data = snap.data();
      if (data.redirectTo) {
        setSearchParams({ ref: data.redirectTo }, { replace: true });
        return;
      }
      setPrName(data.name);
    } catch (e) { console.error(e); }
  };

  const fetchPopup = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'popup'));
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data.enabled) return;
      if (!data.imageUrl && !data.videoUrl) return;
      const last = localStorage.getItem('popup_last_shown');
      if (last && Date.now() - Number(last) < 5 * 60 * 1000) return;

      // Video salvato in Firestore a chunk → riassembla e crea blob URL
      if (data.videoUrl === 'firestore://popup_video') {
        const metaSnap = await getDoc(doc(db, 'settings', 'popup_video_meta'));
        if (metaSnap.exists()) {
          const { chunks, type } = metaSnap.data();
          const parts = await Promise.all(
            Array.from({ length: chunks }, (_, i) => getDoc(doc(db, 'settings', `popup_video_chunk_${i}`)))
          );
          const base64 = parts.map(p => p.data()?.data || '').join('');
          const byteStr = atob(base64.split(',')[1] || base64);
          const arr = new Uint8Array(byteStr.length);
          for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
          const blobUrl = URL.createObjectURL(new Blob([arr], { type }));
          data.videoUrl = blobUrl;
        }
      }

      setPopupData(data);
      setPopupCountdown(data.mediaType === 'video' ? (Number(data.videoDuration) || 5) : 5);
      setShowPopup(true);
    } catch (e) { console.error(e); }
  };

  const handleClosePopup = () => {
    localStorage.setItem('popup_last_shown', String(Date.now()));
    setShowPopup(false);
  };

  const handleSavePromoGallery = async () => {
    if (!popupRef.current) return;
    setSavingGallery(true);
    await new Promise(r => setTimeout(r, 80));
    try {
      const canvas = await html2canvas(popupRef.current, { backgroundColor: '#000000', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'promo.png';
      link.click();
    } catch (e) { console.error(e); } finally { setSavingGallery(false); }
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T23:59:59');
    if (d - new Date() < 0) return null;
    const diffDays = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Scade oggi!';
    if (diffDays === 1) return 'Scade domani';
    return `Scade tra ${diffDays} giorni`;
  };

  const formatExpiryExact = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T23:59:59');
    if (d - new Date() < 0) return null;
    return `Scade il ${d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  const handleStarClick = (side) => {
    const seq = [...starSequence, side];
    if (seq.length === 4) {
      if (seq[0] === 'R' && seq[1] === 'R' && seq[2] === 'L' && seq[3] === 'L') setShowPrAccess(v => !v);
      setStarSequence([]);
    } else {
      setStarSequence(seq);
      setTimeout(() => setStarSequence([]), 3000);
    }
  };

  const handleOpenPrDashboard = async () => {
    try {
      const snap = await getDoc(doc(db, 'prs_registry', prRef));
      setIsFirstPrAccess(!snap.data()?.prPassword);
      setShowPrPasswordModal(true);
    } catch { alert('Errore verifica credenziali'); }
  };

  const handleVerifyPrPassword = async () => {
    if (!prPasswordInput) return;
    try {
      const ref = doc(db, 'prs_registry', prRef);
      const snap = await getDoc(ref);
      if (isFirstPrAccess) {
        await updateDoc(ref, { prPassword: prPasswordInput });
        navigate(`/pr/${prRef}`);
      } else {
        if (snap.data().prPassword === prPasswordInput) navigate(`/pr/${prRef}`);
        else alert('Password Errata');
      }
      setPrPasswordInput(''); setShowPrPasswordModal(false);
    } catch { alert('Errore sistema'); }
  };

  const dates = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  const getFilteredEvents = () => {
    const sel = selectedDate.toISOString().split('T')[0];
    return events.filter(ev => {
      const matchCat = activeCategory === 'TUTTI' || ev.category === activeCategory;
      return matchCat && new Date(ev.date).toISOString().split('T')[0] === sel;
    });
  };

  const handleDateChange = (e) => {
    const idx = Math.round(e.target.scrollTop / 50);
    if (dates[idx] && selectedDate.toDateString() !== dates[idx].toDateString()) setSelectedDate(dates[idx]);
  };

  const handleVerifyPassword = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'admin'));
      if (adminPassword === (snap.exists() ? snap.data().password : 'admin')) {
        window.location.href = '/admin-segreto-stefano';
      } else { alert('Password Errata'); setAdminPassword(''); }
    } catch { alert('Errore'); }
  };

  const handleVerifySuperAdminPassword = () => {
    if (superAdminPassword === 'superadmin') window.location.href = '/super-control-room';
    else { alert('Password SuperAdmin Errata'); setSuperAdminPassword(''); }
  };

  const handleDownloadPass = async () => {
    if (!passRef.current) return;
    const canvas = await html2canvas(passRef.current, { backgroundColor: '#000000', scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `Pass_${customerName}.png`;
    link.click();
  };

  const handleClaimWin = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'tickets', ticketId), { won: true });
      const snap = await getDoc(doc(db, 'prs_registry', prRef));
      const phone = snap.exists() ? snap.data().phone : '';
      if (phone) {
        const msg = `Ciao! Sono ${customerName}, ho vinto un drink per ${selectedEvent.title}. Ticket: ${ticketId}`;
        window.open(`https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      setWinClaimed(true);
      alert('Vincita registrata!');
    } catch { alert('Errore riscatto'); } finally { setLoading(false); }
  };

  const handleAction = async () => {
    if (!customerName.trim()) return alert('Inserisci Nome e Cognome');
    if (!customerPhone.trim()) return alert('Inserisci il numero WhatsApp');
    setLoading(true);

    // Privé con tipo configurato → N ticket (uno per ospite)
    if (bookingMode === 'prive' && selectedPriveType) {
      const groupId = 'GRP' + Math.random().toString(36).substr(2, 7).toUpperCase();
      const pricePerPerson = selectedPriveType.price / priveGuests;
      const ids = [];
      try {
        for (let i = 0; i < priveGuests; i++) {
          const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
          await setDoc(doc(db, 'tickets', newId), {
            id: newId, eventId: selectedEvent.id, prId: prRef,
            customerName, customerPhone, used: false, won: false, timestamp: new Date(),
            type: 'prive', priveGroupId: groupId,
            priveTypeName: selectedPriveType.name, priveTypeId: selectedPriveType.id,
            priveInclusions: selectedPriveType.inclusions || '',
            totalGuests: priveGuests, guestIndex: i + 1,
            priceTotal: selectedPriveType.price, pricePerPerson, companions: groupNames,
          });
          ids.push(newId);
        }
        setPriveTickets(ids);
        setTicketId(groupId);
      } catch { alert('Errore generazione ticket'); }
      setLoading(false);
      return;
    }

    // Singolo ticket (lista, pr list, privé legacy)
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const data = {
      id: newId, eventId: selectedEvent.id, prId: prRef,
      customerName, customerPhone, used: false, won: false, timestamp: new Date(),
      type: bookingMode === 'single' ? 'singolo' : (bookingMode === 'prive' ? 'prive' : 'pr_list'),
      guestCount: bookingMode === 'prive' ? priveGuests : guestCount,
      companions: groupNames,
    };
    if (bookingMode === 'prive') data.advancePaid = priveGuests * PRIVE_ADVANCE_FEE;
    try {
      await setDoc(doc(db, 'tickets', newId), data);
      setTicketId(newId);
    } catch { alert('Errore generazione'); } finally { setLoading(false); }
  };

  const resetView = () => {
    setSelectedEvent(null); setBookingMode(null); setTicketId(null);
    setCustomerName(''); setCustomerPhone(''); setPriveGuests(1); setGuestCount(1);
    setGroupNames(''); setHasWon(false); setWinClaimed(false);
    setSelectedPriveType(null); setPriveTickets([]);
  };

  const availablePriveTypes = selectedEvent?.priveTypes?.filter(t => t.available !== false) || [];

  // ── OVERLAY TRAILER ARENA ──
  if (arenaTrailerKey) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <button onClick={() => setArenaTrailerKey(null)}
          className="flex items-center gap-2 text-zinc-500 uppercase text-[10px] tracking-widest font-black p-6 self-start">
          <ChevronLeft size={16} /> CHIUDI
        </button>
        <div className="flex-1 flex items-center justify-center px-4">
          <iframe
            src={`https://www.youtube.com/embed/${arenaTrailerKey}?rel=0&autoplay=1`}
            className="w-full aspect-video rounded-2xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // ── VISTA FILM CINEMA ──
  if (selectedFilm) {
    return <FilmDetail film={selectedFilm} onClose={() => setSelectedFilm(null)} />;
  }

  // ── VISTA EVENTO SELEZIONATO ──
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-black text-white p-6 animate-in slide-in-from-right duration-500 overflow-x-hidden">
        <button onClick={resetView} className="mb-6 flex items-center gap-2 text-zinc-500 uppercase text-[10px] tracking-widest font-black">
          <ChevronLeft size={16} /> CHIUDI
        </button>

        {/* ─────────────────────────────────────────────────────────
            TERNARIO PRINCIPALE — l'ordine determina cosa si vede
            1. Nessun booking mode  → dettaglio evento
            2. Privé + nessun tipo selezionato (se tipi disponibili) → selezione tipo
            3. Nessun ticket ancora  → form prenotazione
            4. Privé con N ticket generati  → multi-pass
            5. Altrimenti  → pass singolo
        ───────────────────────────────────────────────────────── */}

        {!bookingMode ? (
          /* ── 1. DETTAGLIO EVENTO ── */
          <div className="animate-in fade-in duration-700">
            <div className="w-full bg-black rounded-[2rem] overflow-hidden mb-8 border border-white/10 shadow-2xl text-center relative">
              <img src={selectedEvent.imageUrl} alt="Event" className="max-w-full object-contain max-h-[60vh] mx-auto" />
              {selectedEvent.isCancelled && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <p className="text-red-500 font-black text-3xl italic uppercase rotate-[-12deg] border-4 border-red-600 px-6 py-3 shadow-2xl">EVENTO ANNULLATO</p>
                </div>
              )}
              {selectedEvent.isPriveSoldOut && !selectedEvent.isCancelled && (
                <div className="absolute bottom-3 right-3 bg-black/80 text-amber-400 font-black text-[8px] px-3 py-1.5 rounded-full border border-amber-400/40 uppercase tracking-widest">
                  Sold out Privé
                </div>
              )}
            </div>

            <h2 className="text-4xl font-black italic uppercase leading-none mb-4 tracking-tighter text-center">{selectedEvent.title}</h2>

            {selectedEvent.description && (
              <div className="mb-8 p-4 bg-zinc-900/50 border-l-4 border-[#D4AF37] rounded-r-2xl text-left">
                <span className="text-[10px] font-black uppercase tracking-widest italic text-[#D4AF37]">Info & Listino</span>
                <p className="text-sm font-bold text-zinc-300 whitespace-pre-wrap italic leading-relaxed mt-2">{selectedEvent.description}</p>
              </div>
            )}

            <div className="space-y-4">
              {selectedEvent.isPassDisabled !== true && (
                <button onClick={() => setBookingMode('single')} className="w-full bg-white text-black p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between active:scale-95 transition-transform">
                  <span>OTTIENI PASS LISTA</span> <ArrowRight size={18} />
                </button>
              )}
              {selectedEvent.isPriveDisabled !== true && (
                <button onClick={() => setBookingMode('prive')} className="w-full border-2 border-[#D4AF37] text-[#D4AF37] p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between active:scale-95 transition-transform">
                  <div className="flex items-center gap-2"><Crown size={18} /><span>PRENOTA TAVOLO PRIVÉ</span></div> <ArrowRight size={18} />
                </button>
              )}
              {selectedEvent.isPrListDisabled !== true && (
                <button onClick={() => setBookingMode('pr')} className="w-full border-2 border-zinc-700 text-zinc-400 p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between active:scale-95 transition-transform hover:border-zinc-500 hover:text-zinc-300">
                  <div className="flex items-center gap-2"><Star size={18} /><span>Aggiungimi nella Lista del PR</span></div> <ArrowRight size={18} />
                </button>
              )}
              {selectedEvent.isPassDisabled === true && selectedEvent.isPriveDisabled === true && selectedEvent.isPrListDisabled === true && (
                <div className={`text-center py-6 px-4 rounded-3xl border ${selectedEvent.isCancelled ? 'bg-red-950/30 border-red-900/30' : 'bg-zinc-900/30 border-white/5'}`}>
                  <p className={`font-black italic uppercase text-[10px] tracking-widest ${selectedEvent.isCancelled ? 'text-red-500' : 'text-zinc-500'}`}>
                    {selectedEvent.isCancelled ? 'Questo evento è stato annullato.' : 'Le prenotazioni online sono attualmente chiuse.'}
                  </p>
                </div>
              )}
            </div>
          </div>

        ) : bookingMode === 'prive' && !selectedPriveType && availablePriveTypes.length > 0 ? (
          /* ── 2. SELEZIONE TIPO PRIVÉ ── */
          <div className="animate-in fade-in duration-500">
            <button onClick={() => setBookingMode(null)} className="mb-6 flex items-center gap-2 text-zinc-600 uppercase text-[10px] tracking-widest font-black">
              <ChevronLeft size={14} /> Indietro
            </button>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-center mb-2">Scegli il Privé</h3>
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest text-center mb-8">Seleziona la tipologia di tavolo</p>
            <div className="space-y-4 max-w-sm mx-auto">
              {availablePriveTypes.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => setSelectedPriveType(pt)}
                  className="w-full bg-zinc-900/80 border-2 border-white/10 p-8 rounded-[2.5rem] flex flex-col items-start gap-3 active:scale-[0.98] transition-all hover:border-[#D4AF37]/40 text-left"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xl font-black italic uppercase">{pt.name}</span>
                    <ArrowRight size={20} className="text-[#D4AF37]" />
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-[#D4AF37]">€{pt.price}</span>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Totale Tavolo</span>
                  </div>
                  {pt.inclusions && <span className="text-[10px] text-zinc-400 italic normal-case">{pt.inclusions}</span>}
                </button>
              ))}
            </div>
          </div>

        ) : !ticketId ? (
          /* ── 3. FORM PRENOTAZIONE ── */
          <div className="bg-zinc-900/80 p-8 rounded-[2.5rem] border border-white/5 space-y-8 backdrop-blur-xl animate-in slide-in-from-bottom-10">

            {/* Intestazione con tipo privé selezionato */}
            {bookingMode === 'prive' && selectedPriveType && (
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <button onClick={() => setSelectedPriveType(null)} className="text-zinc-600 hover:text-white"><ChevronLeft size={20} /></button>
                <div>
                  <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-widest">Privé selezionato</p>
                  <p className="text-lg font-black italic uppercase">{selectedPriveType.name}</p>
                </div>
                <span className="ml-auto text-2xl font-black text-[#D4AF37]">€{selectedPriveType.price}</span>
              </div>
            )}

            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-center">
              {bookingMode === 'prive' ? 'RISERVA PRIVÉ' : (bookingMode === 'pr' ? `LISTA ${prName.toUpperCase()}` : 'ACCESSO LISTA')}
            </h3>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic">Intestatario</label>
                <input type="text" placeholder="NOME E COGNOME" className="w-full p-5 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] text-center" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic">Numero WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input type="tel" placeholder="333 1234567" className="w-full p-5 pl-12 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] text-center" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>
              </div>

              {/* Numero persone (non privé) */}
              {bookingMode !== 'prive' && (
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic block text-center">Numero Persone</label>
                  <div className="flex items-center justify-center gap-10 bg-black/40 p-4 rounded-2xl border border-white/5">
                    <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Minus size={16} /></button>
                    <span className="text-4xl font-black italic">{guestCount}</span>
                    <button onClick={() => setGuestCount(guestCount + 1)} className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Plus size={16} /></button>
                  </div>
                </div>
              )}

              {/* Nominativi opzionali */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic">Nominativi (Opzionale)</label>
                <div className="relative">
                  <Edit3 className="absolute left-4 top-5 text-zinc-600" size={18} />
                  <textarea placeholder="ES. MARIO ROSSI, LUCA VERDI..." className="w-full p-5 pl-12 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] h-24 resize-none text-xs" value={groupNames} onChange={e => setGroupNames(e.target.value)} />
                </div>
              </div>

              {/* Privé con tipo selezionato → ospiti + riepilogo costi */}
              {bookingMode === 'prive' && selectedPriveType && (
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic block text-center">Numero Ospiti (max 10)</label>
                  <div className="flex items-center justify-center gap-10 bg-black/40 p-4 rounded-2xl border border-white/5">
                    <button onClick={() => setPriveGuests(Math.max(1, priveGuests - 1))} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Minus /></button>
                    <span className="text-5xl font-black italic">{priveGuests}</span>
                    <button onClick={() => setPriveGuests(Math.min(10, priveGuests + 1))} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Plus /></button>
                  </div>
                  <div className="bg-black/50 rounded-[2rem] p-6 border border-[#D4AF37]/20 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Totale tavolo</span>
                      <span className="text-xl font-black text-[#D4AF37]">€{selectedPriveType.price}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ospiti</span>
                      <span className="text-xl font-black">{priveGuests}</span>
                    </div>
                    {selectedPriveType.inclusions && (
                      <div className="border-t border-white/5 pt-2">
                        <span className="text-[9px] text-zinc-400 italic normal-case">{selectedPriveType.inclusions}</span>
                      </div>
                    )}
                    <div className="border-t border-[#D4AF37]/20 pt-3 flex justify-between items-center">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Quota per ospite</span>
                      <span className="text-2xl font-black">€{(selectedPriveType.price / priveGuests).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Privé legacy (nessun tipo configurato) */}
              {bookingMode === 'prive' && !selectedPriveType && (
                <div className="text-center space-y-6">
                  <div className="flex items-center justify-center gap-12 bg-black/40 p-6 rounded-3xl border border-white/5">
                    <button onClick={() => setPriveGuests(Math.max(1, priveGuests - 1))} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Minus /></button>
                    <span className="text-5xl font-black italic">{priveGuests}</span>
                    <button onClick={() => setPriveGuests(priveGuests + 1)} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Plus /></button>
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <p className="text-3xl font-black text-[#D4AF37]">€{priveGuests * PRIVE_ADVANCE_FEE}</p>
                    <ShieldCheck className="text-zinc-800" size={40} />
                  </div>
                </div>
              )}

              <button onClick={handleAction} disabled={loading} className="w-full bg-[#D4AF37] text-black p-6 rounded-full font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 text-sm disabled:opacity-50">
                {loading ? 'ELABORAZIONE...' : 'CONFERMA E GENERA'}
              </button>
            </div>
          </div>

        ) : bookingMode === 'prive' && priveTickets.length > 0 ? (
          /* ── 4. MULTI-PASS PRIVÉ ── */
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 pb-16 text-center">
            <Crown size={40} className="text-[#D4AF37] mb-4" />
            <h3 className="text-[#D4AF37] font-black text-xs tracking-[0.4em] uppercase mb-2">
              {priveTickets.length} PASS PRIVÉ GENERATI
            </h3>
            <p className="text-zinc-600 font-bold text-[10px] mb-10 italic normal-case">
              Scarica o invia via WhatsApp il pass di ogni ospite
            </p>
            <div className="w-full space-y-10 max-w-sm">
              {priveTickets.map((tid, idx) => (
                <PrivePassCard
                  key={tid}
                  ticketId={tid}
                  guestIndex={idx + 1}
                  totalGuests={priveTickets.length}
                  customerName={customerName}
                  priveName={selectedPriveType?.name || 'PRIVÉ'}
                  priveInclusions={selectedPriveType?.inclusions || ''}
                  pricePerPerson={(selectedPriveType?.price || 0) / priveTickets.length}
                  eventTitle={selectedEvent.title}
                />
              ))}
            </div>
            <button onClick={resetView} className="mt-12 text-zinc-600 font-black uppercase text-[10px] border-b border-zinc-900 pb-2">
              Torna agli eventi
            </button>
          </div>

        ) : (
          /* ── 5. PASS SINGOLO (lista / pr list / privé legacy) ── */
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 pb-10 text-center">
            <div ref={passRef} className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-10 flex flex-col items-center border border-white/10 shadow-2xl overflow-hidden mb-6">
              <div className="absolute top-8 right-8 opacity-10"><Crown size={120} /></div>
              <h3 className="text-[#D4AF37] font-black text-xs tracking-[0.4em] uppercase mb-10 text-center">DIGITAL MEMBER PASS</h3>
              <div className="bg-white p-5 rounded-[2rem] mb-10"><QRCodeCanvas value={ticketId} size={200} /></div>
              <div className="text-center mb-10">
                <p className="text-4xl font-black italic uppercase leading-none tracking-tighter mb-1">{customerName}</p>
                <p className="text-zinc-500 font-bold text-[10px] uppercase">
                  {bookingMode === 'prive' ? `VIP TABLE x ${priveGuests}` : (bookingMode === 'pr' ? `LISTA ${prName.toUpperCase()} x ${guestCount}` : `GUESTLIST ENTRANCE x ${guestCount}`)}
                </p>
              </div>
              <div className="w-full flex justify-between items-end border-t border-white/10 pt-8 text-left">
                <div><p className="text-[8px] text-zinc-600 font-black uppercase mb-1">TICKET ID</p><p className="font-mono text-xs font-bold">{ticketId}</p></div>
                <div className="text-right"><p className="text-[8px] text-zinc-600 font-black uppercase mb-1">AUTHORIZED BY</p><p className="text-[#D4AF37] font-black italic text-xl leading-none">{prName}</p></div>
              </div>
            </div>
            <button onClick={handleDownloadPass} className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl mb-12 active:scale-95">
              <Download size={18} /> SALVA NELLA GALLERIA
            </button>
            <div className="text-center">
              <p className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase mb-6 italic">Luxury Reward</p>
              <ScratchCard onWin={() => setHasWon(true)} />
              {hasWon && !winClaimed && (
                <button onClick={handleClaimWin} className="mt-6 flex items-center justify-center gap-2 w-full bg-[#D4AF37] text-black p-5 rounded-2xl font-black uppercase text-sm animate-bounce shadow-2xl"><Send size={20} /> RISCATTA PREMIO E NOTIFICA PR</button>
              )}
              {winClaimed && <p className="mt-4 text-green-500 font-black uppercase italic text-xs tracking-widest animate-pulse">Vincita notificata! ✅</p>}
            </div>
            <button onClick={resetView} className="mt-12 text-zinc-600 font-black uppercase text-[10px] border-b border-zinc-900 pb-2">Torna agli eventi</button>
          </div>
        )}
      </div>
    );
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const handleExit = () => {
    // Chiude tutti gli overlay e resetta lo stato
    setSelectedEvent(null);
    setSelectedFilm(null);
    setShowAdminLogin(false);
    setShowSuperAdminLogin(false);
    setShowPrAccess(false);
    setShowPrPasswordModal(false);
    setShowPopup(false);
    setBookingMode(null);
    setTicketId(null);
    setStep(1);
    setActiveCategory(null);
    // Tenta chiusura finestra PWA
    setTimeout(() => {
      try { window.close(); } catch (e) {}
      try { window.open('', '_self', '').close(); } catch (e) {}
      setTimeout(() => { try { window.location.replace('about:blank'); } catch (e) {} }, 150);
    }, 80);
  };

  // ── HOME / LISTA EVENTI ──
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden select-none pb-24">
      {isStandalone && (
        <button
          onClick={handleExit}
          className="fixed top-5 left-5 z-50 w-8 h-8 rounded-full bg-zinc-900/70 border border-zinc-800 flex items-center justify-center text-zinc-700 active:text-red-500 active:border-red-500/40 transition-all backdrop-blur-sm"
          title="Esci dall'app"
        >
          <Power size={13} />
        </button>
      )}
      {showPrAccess && (
        <button onClick={handleOpenPrDashboard} className="fixed top-6 right-6 z-[60] bg-[#D4AF37] text-black p-4 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.5)] animate-bounce border-2 border-white">
          <Crown size={28} />
        </button>
      )}

      {showPrPasswordModal && (
        <div className="fixed inset-0 bg-black/98 z-[100] flex items-center justify-center p-10 animate-in fade-in zoom-in text-center">
          <div className="w-full max-w-sm space-y-10">
            <Lock className="mx-auto text-[#D4AF37]" size={56} />
            <h2 className="text-white font-black italic uppercase">{isFirstPrAccess ? 'Imposta Password PR' : 'Inserisci Password PR'}</h2>
            <input type="password" placeholder="PASSWORD" className="w-full p-6 bg-zinc-900 border border-white/10 rounded-2xl text-white text-center font-black tracking-[0.4em] outline-none focus:border-[#D4AF37]" value={prPasswordInput} onChange={e => setPrPasswordInput(e.target.value)} />
            <button onClick={handleVerifyPrPassword} className="w-full bg-[#D4AF37] text-black p-6 rounded-full font-black uppercase shadow-2xl active:scale-95 transition-all">{isFirstPrAccess ? 'CONFIGURA E ACCEDI' : 'VERIFICA E ACCEDI'}</button>
            <button onClick={() => setShowPrPasswordModal(false)} className="text-zinc-500 text-[10px] font-black uppercase underline">Annulla</button>
          </div>
        </div>
      )}

      <div className="h-[20vh] flex flex-col items-center justify-center relative p-4">
        <video src="/logo.mp4" autoPlay muted playsInline
          onClick={() => { const n = clickCount + 1; if (n >= 7) { setShowAdminLogin(true); setClickCount(0); } else setClickCount(n); }}
          className="w-64 h-auto relative z-10 drop-shadow-[0_0_30px_rgba(212,175,55,0.2)]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
      </div>

      {step === 1 && (
        <div className="px-6 space-y-6 animate-in fade-in max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4 text-center">
            <div className="h-[1px] w-8 bg-[#D4AF37]/50" />
            <h1 className="text-zinc-300 font-black uppercase text-xs tracking-[0.4em] italic">Select Experience</h1>
            <div className="h-[1px] w-8 bg-[#D4AF37]/50" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setStep(2); trackCategoryView(cat.id); }} className="group relative flex flex-col items-center justify-center p-8 rounded-[2rem] border bg-zinc-900/40 border-white/5 text-zinc-400 active:scale-95 transition-all">
                <cat.icon size={30} className="mb-3" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">{cat.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/proponi-evento')} className="w-full flex items-center justify-between gap-4 mt-2 px-8 py-5 rounded-[2rem] border border-[#D4AF37]/20 bg-zinc-900/30 text-zinc-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
              <PlusCircle size={22} className="text-[#D4AF37]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Inserisci il Tuo Evento</span>
            </div>
            <ArrowRight size={16} className="text-[#D4AF37]" />
          </button>
          <button
            onClick={async () => {
              const url = window.location.origin + '/?ref=MASTER';
              trackShare(prRef);
              if (navigator.share) {
                await navigator.share({ title: 'Eventi a Catania', text: 'Scopri tutti gli eventi a Catania e provincia!', url });
              } else {
                await navigator.clipboard.writeText(url);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }
            }}
            className="w-full flex items-center justify-between gap-4 mt-2 px-8 py-5 rounded-[2rem] border border-white/5 bg-zinc-900/30 text-zinc-500 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
              <Share2 size={22} className="text-zinc-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {shareCopied ? 'Link Copiato!' : 'Condividi App'}
              </span>
            </div>
            <ArrowRight size={16} className="text-zinc-600" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in slide-in-from-bottom-20 duration-700">
          <button onClick={() => { setStep(1); setActiveCategory(null); }} className="px-8 py-2 text-zinc-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-3 active:scale-95 transition-all">
            <ChevronLeft size={18} strokeWidth={3} /> Indietro
          </button>
          <div className="mt-0 text-center mb-0">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-1 italic">MOOD SCELTO</p>
            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white">{categories.find(c => c.id === activeCategory)?.label}</h2>
          </div>
          {EXTERNAL_CATS.includes(activeCategory) ? (
            <div className="px-4 pb-24 mt-4">
              {loadingExternal ? (
                <div className="text-center py-24 flex flex-col items-center gap-4 opacity-40">
                  <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest italic">Caricamento...</p>
                </div>
              ) : externalEvents.length === 0 ? (
                <div className="text-center py-24 flex flex-col items-center gap-4 opacity-30">
                  {activeCategory === 'CINEMA' ? <Film size={48} /> : activeCategory === 'CONCERTI' ? <Mic2 size={48} /> : activeCategory === 'SAGRE' ? <Church size={48} /> : <Theater size={48} />}
                  <p className="text-[10px] font-black uppercase tracking-widest italic">Prossimamente disponibile</p>
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">In configurazione</p>
                </div>
              ) : activeCategory === 'SAGRE' ? (() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const curYM = todayStr.slice(0, 7);
                const IT_MONTHS_LABEL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
                const PROV_NAMES = {AG:'Agrigento',CL:'Caltanissetta',CT:'Catania',EN:'Enna',ME:'Messina',PA:'Palermo',RG:'Ragusa',SR:'Siracusa',TP:'Trapani'};
                const availMonths = [...new Set(
                  externalEvents.filter(e => e.date && e.date.slice(0,7) >= curYM).map(e => e.date.slice(0,7))
                )].sort();
                const selMonth = sagreMonth && availMonths.includes(sagreMonth) ? sagreMonth : (availMonths[0] || curYM);
                const monthEvents = externalEvents.filter(e => e.date && e.date.slice(0,7) === selMonth);
                const availProvs = ['TUTTI', ...[...new Set(monthEvents.map(e => e.province).filter(Boolean))].sort()];
                const provEvents = sagreProvince === 'TUTTI' ? monthEvents : monthEvents.filter(e => e.province === sagreProvince);
                const availCities = sagreProvince !== 'TUTTI'
                  ? ['TUTTI', ...[...new Set(provEvents.map(e => e.city).filter(Boolean))].sort()]
                  : [];
                const filtered = (sagreProvince === 'TUTTI' || sagreCity === 'TUTTI')
                  ? provEvents
                  : provEvents.filter(e => e.city === sagreCity);
                return (
                  <>
                    {/* ── Filtri SAGRE ── */}
                    <div className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <select value={selMonth}
                          onChange={e => { setSagreMonth(e.target.value); setSagreProvince('TUTTI'); setSagreCity('TUTTI'); }}
                          className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-2xl pl-4 pr-8 py-3 text-xs font-black uppercase text-white cursor-pointer focus:outline-none focus:border-[#D4AF37]/60">
                          {availMonths.map(ym => {
                            const [y, mo] = ym.split('-');
                            return <option key={ym} value={ym}>{IT_MONTHS_LABEL[parseInt(mo) - 1]} {y}</option>;
                          })}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                      <div className="relative flex-1">
                        <select value={sagreProvince}
                          onChange={e => { setSagreProvince(e.target.value); setSagreCity('TUTTI'); }}
                          className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-2xl pl-4 pr-8 py-3 text-xs font-black uppercase text-white cursor-pointer focus:outline-none focus:border-white/40">
                          {availProvs.map(p => (
                            <option key={p} value={p}>{p === 'TUTTI' ? 'Tutta la Sicilia' : `${p} — ${PROV_NAMES[p] || p}`}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                    {sagreProvince !== 'TUTTI' && availCities.length > 2 && (
                      <div className="relative mb-4">
                        <select value={sagreCity} onChange={e => setSagreCity(e.target.value)}
                          className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-2xl pl-4 pr-8 py-3 text-xs font-black uppercase text-white cursor-pointer focus:outline-none focus:border-white/40">
                          {availCities.map(c => (
                            <option key={c} value={c}>{c === 'TUTTI' ? `Tutte le città` : c}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                    )}
                    {filtered.length === 0 ? (
                      <div className="text-center py-24 opacity-30"><Church size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest italic">Nessuna sagra disponibile</p></div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {filtered.map(ev => (
                          <a key={ev.id} href={ev.externalUrl} target="_blank" rel="noopener noreferrer"
                            className="group rounded-[1.5rem] overflow-hidden bg-zinc-900 border border-white/5 active:scale-95 transition-all">
                            {ev.imageUrl
                              ? <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto object-contain bg-zinc-800" />
                              : <div className="w-full aspect-[4/3] bg-zinc-800 flex items-center justify-center"><Church size={48} className="text-zinc-600" /></div>
                            }
                            <div className="p-4">
                              <p className="text-sm font-black uppercase leading-tight text-white">{ev.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                {ev.date && (
                                  <p className="text-[#D4AF37] text-xs font-black">
                                    {new Date(ev.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}
                                  </p>
                                )}
                                {ev.city && <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">{ev.city}{ev.province ? ` (${ev.province})` : ''}</p>}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                );
              })() : activeCategory === 'CINEMA' ? (
                <div className="grid grid-cols-2 gap-4">
                  {externalEvents.map(ev => (
                    <div key={ev.id} onClick={() => { setSelectedFilm(ev); trackFilmView(ev.title); }}
                      className="group rounded-[1.5rem] overflow-hidden bg-zinc-900 border border-white/5 active:scale-95 transition-all cursor-pointer">
                      {ev.imageUrl
                        ? <img src={ev.imageUrl} alt={ev.title} className="w-full aspect-[2/3] object-cover" />
                        : <div className="w-full aspect-[2/3] bg-zinc-800 flex items-center justify-center"><Film size={32} className="text-zinc-600" /></div>
                      }
                      <div className="p-3">
                        <p className="text-xs font-black uppercase leading-tight text-white line-clamp-2">{ev.title}</p>
                        {ev.rating && <p className="text-[#D4AF37] text-[11px] font-black mt-1">★ {ev.rating}</p>}
                        <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-2">→ Orari & Sale</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                const normT = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const deduped = [];
                const seenTitle = new Set();
                for (const ev of externalEvents) {
                  const key = normT(ev.title);
                  if (!seenTitle.has(key)) { seenTitle.add(key); deduped.push(ev); }
                }

                const todayStr = new Date().toISOString().split('T')[0];
                const months = [...new Set(deduped.filter(e => e.date).map(e => e.date.slice(0,7)))].sort();

                const areaFiltered = extendSicilia ? deduped : deduped.filter(e => !e.area || e.area === 'catania');
                let filtered = areaFiltered;
                if (concertiFilter === 'OGGI') filtered = areaFiltered.filter(e => e.date === todayStr);
                else if (concertiFilter === 'DATA') filtered = areaFiltered.filter(e => e.date === selectedConcertiDate.toISOString().split('T')[0]);

                return (
                  <>
                    {(activeCategory === 'CONCERTI' || activeCategory === 'TEATRO') && (
                      <div className="mb-5">
                        {/* 3 modalità */}
                        <div className="flex gap-2 mb-3">
                          {['TUTTI','OGGI','DATA'].map(f => (
                            <button key={f} onClick={() => setConcertiFilter(f)}
                              className={`flex-1 py-2.5 rounded-2xl font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 ${concertiFilter === f ? 'bg-[#D4AF37] text-black' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
                              {f}
                            </button>
                          ))}
                        </div>
                        {/* toggle area geografica */}
                        <button
                          onClick={() => setExtendSicilia(v => !v)}
                          className={`w-full py-2 rounded-2xl font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 border ${extendSicilia ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
                          {extendSicilia ? '📍 Tutta la Sicilia' : '📍 Catania e provincia — estendi alla Sicilia'}
                        </button>

                        {/* Selettore giornaliero identico a discoteche */}
                        {concertiFilter === 'DATA' && (
                          <div className="relative h-36 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-x-6 h-[70px] border-2 border-[#D4AF37] pointer-events-none z-20 rounded-2xl" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none z-10" />
                            <div className="h-full w-full overflow-y-scroll no-scrollbar snap-y snap-mandatory px-20 text-center"
                              onScroll={e => {
                                const idx = Math.round(e.target.scrollTop / 50);
                                const d = dates[idx];
                                if (d && selectedConcertiDate.toDateString() !== d.toDateString()) setSelectedConcertiDate(d);
                              }}>
                              <div className="h-[45px]" />
                              {dates.map((d, i) => {
                                const isSel = selectedConcertiDate.toDateString() === d.toDateString();
                                return (
                                  <div key={i} className="h-[50px] flex flex-col items-center justify-center snap-center transition-all duration-300">
                                    <span className={`uppercase font-black tracking-[0.2em] text-[8px] mb-0.5 ${isSel ? 'text-[#D4AF37]' : 'text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                                    <span className={`transition-all duration-500 uppercase font-black tracking-tighter italic leading-none ${isSel ? 'text-4xl text-white scale-110' : 'text-xl text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
                                  </div>
                                );
                              })}
                              <div className="h-[45px]" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-5">
                      {filtered.map(ev => (
                        <a key={ev.id} href={ev.externalUrl} target="_blank" rel="noopener noreferrer"
                          className="group rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5 active:scale-[0.98] transition-all">
                          {ev.imageUrl
                            ? <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto object-contain bg-zinc-800" />
                            : <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
                                {activeCategory === 'CONCERTI' ? <Mic2 size={48} className="text-zinc-600" /> : <Theater size={48} className="text-zinc-600" />}
                              </div>
                          }
                          <div className="p-5">
                            <p className="text-base font-black uppercase leading-tight text-white line-clamp-2">{ev.title}</p>
                            {ev.date && (
                              <p className="text-[#D4AF37] text-sm font-black mt-2">
                                {new Date(ev.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                {ev.time ? ` · ${ev.time.slice(0,5)}` : ''}
                              </p>
                            )}
                            {(ev.city || ev.venue) && <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mt-1 line-clamp-1">{ev.city || ev.venue}</p>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              <div className="relative h-36 mt-2 mb-2 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-x-6 h-[70px] border-2 border-[#D4AF37] bg-transparent pointer-events-none z-20 rounded-2xl" />
                <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none z-10" />
                <div onScroll={handleDateChange} className="h-full w-full overflow-y-scroll no-scrollbar snap-y snap-mandatory px-20 text-center">
                  <div className="h-[45px]" />
                  {dates.map((d, i) => {
                    const isSel = selectedDate.toDateString() === d.toDateString();
                    return (
                      <div key={i} className="h-[50px] flex flex-col items-center justify-center snap-center transition-all duration-300">
                        <span className={`uppercase font-black tracking-[0.2em] text-[8px] mb-0.5 ${isSel ? 'text-[#D4AF37]' : 'text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                        <span className={`transition-all duration-500 uppercase font-black tracking-tighter italic leading-none ${isSel ? 'text-4xl text-white scale-110' : 'text-xl text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
                      </div>
                    );
                  })}
                  <div className="h-[45px]" />
                </div>
              </div>
              {activeCategory === 'ARENE ESTIVE' && (() => {
                const ARENE = [
                  { id: 'adua',      label: 'Arena Adua',      sub: 'Via San Niccolò al Borgo' },
                  { id: 'argentina', label: 'Arena Argentina',  sub: 'Via Vanasco' },
                  { id: 'corsaro',   label: 'Arena Corsaro',    sub: 'Catania' },
                  { id: 'bellini',   label: 'Villa Bellini',    sub: 'Piazzale delle Carrozze' },
                  { id: 'moderno',   label: 'Arena Moderno',    sub: 'Mascalucia' },
                  { id: 'giardino',  label: 'Arena Giardino',   sub: 'Giarre' },
                ];
                return (
                  <div className="px-6 mb-4">
                    <div className="relative">
                      <select value={selectedArena} onChange={e => setSelectedArena(e.target.value)}
                        className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-2xl pl-4 pr-8 py-3 text-xs font-black uppercase text-white cursor-pointer focus:outline-none focus:border-[#D4AF37]/60">
                        <option value="TUTTE">Tutte le Arene</option>
                        {ARENE.map(a => (
                          <option key={a.id} value={a.id}>{a.label} — {a.sub}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                );
              })()}
              {activeCategory === 'ARENE ESTIVE' ? (() => {
                const ARENE_LABELS = { adua: 'Arena Adua', argentina: 'Arena Argentina', corsaro: 'Arena Corsaro', moderno: 'Arena Moderno' };
                const visibleArenas = selectedArena === 'TUTTE'
                  ? ARENA_CINEMA_IDS.filter(id => arenaFilms[id]?.length)
                  : (arenaFilms[selectedArena]?.length ? [selectedArena] : []);
                const todayArena = new Date().toISOString().split('T')[0];
                const dateChips = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() + i);
                  return d.toISOString().split('T')[0];
                });
                return (
                  <>
                    {/* selettore giorno */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1 px-6">
                      {dateChips.map(d => {
                        const date = new Date(d + 'T12:00:00');
                        const isSel = d === arenaDate;
                        const isToday = d === todayArena;
                        return (
                          <button key={d} onClick={() => setArenaDate(d)}
                            className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-2xl font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 ${isSel ? 'bg-[#D4AF37] text-black' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
                            <span>{isToday ? 'OGGI' : date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase().replace('.', '')}</span>
                            <span className="text-[10px] font-black">{date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* film per arena */}
                    <div className="px-6 flex flex-col gap-6 max-w-2xl mx-auto">
                      {loadingArena ? (
                        <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" /></div>
                      ) : visibleArenas.length === 0 ? (
                        <div className="text-center py-24 flex flex-col items-center gap-6 opacity-30"><Film size={48} /><p className="italic font-black uppercase text-[10px]">Nessuna programmazione disponibile</p></div>
                      ) : visibleArenas.map(arenaId => (
                        <div key={arenaId}>
                          {selectedArena === 'TUTTE' && (
                            <p className="text-[#D4AF37] font-black uppercase tracking-widest text-[10px] mb-3 px-1">{ARENE_LABELS[arenaId]}</p>
                          )}
                          {arenaFilms[arenaId].map((film, i) => {
                            const arenaCinema = CATANIA_CINEMAS.find(c => c.id === arenaId);
                            return (
                            <div key={i} className="group relative w-full rounded-[3rem] overflow-hidden shadow-2xl bg-[#080808] border border-white/5 mb-6">
                              <div className="relative overflow-hidden">
                                {film.backdropUrl || film.posterUrl
                                  ? <img src={film.backdropUrl || film.posterUrl} alt={film.title} className="w-full aspect-video object-cover transition-transform duration-[3s] group-hover:scale-105" />
                                  : <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center"><Film size={48} className="text-zinc-700" /></div>
                                }
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
                                {film.trailerKey && (
                                  <button onClick={() => setArenaTrailerKey(film.trailerKey)}
                                    className="absolute inset-0 flex items-center justify-center active:bg-black/20 transition-all">
                                    <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                                      <div className="w-0 h-0 border-t-[9px] border-t-transparent border-l-[16px] border-l-black border-b-[9px] border-b-transparent ml-1" />
                                    </div>
                                  </button>
                                )}
                              </div>
                              <div className="p-6">
                                <h3 className="text-2xl font-black italic uppercase leading-none text-white tracking-tighter mb-3">{film.title}</h3>
                                {/* orari */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {film.times.map(t => (
                                    <span key={t} className="bg-zinc-900 border border-white/10 text-[#D4AF37] font-black text-xs px-3 py-1.5 rounded-full">{t}</span>
                                  ))}
                                </div>
                                {/* trama + stelle sulla stessa riga */}
                                {film.description && (() => {
                                  const key = `${arenaId}-${i}`;
                                  const open = expandedArenaDescs.has(key);
                                  const starsEl = film.rating ? (() => {
                                    const stars = film.rating / 2;
                                    const full = Math.floor(stars);
                                    const half = (stars - full) >= 0.5;
                                    const empty = 5 - full - (half ? 1 : 0);
                                    return (
                                      <div className="flex items-center gap-0.5 ml-auto">
                                        {Array.from({ length: full }).map((_, k) => <span key={`f${k}`} className="text-[#D4AF37] text-xs">★</span>)}
                                        {half && <span className="text-[#D4AF37] text-xs">½</span>}
                                        {Array.from({ length: empty }).map((_, k) => <span key={`e${k}`} className="text-zinc-700 text-xs">★</span>)}
                                        <span className="text-zinc-500 text-[10px] font-black ml-1">{stars.toFixed(1)}/5</span>
                                      </div>
                                    );
                                  })() : null;
                                  return (
                                    <div className="mb-4">
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => setExpandedArenaDescs(prev => {
                                          const s = new Set(prev);
                                          open ? s.delete(key) : s.add(key);
                                          return s;
                                        })} className="flex items-center gap-1 text-zinc-400 font-black uppercase text-[10px] tracking-widest active:opacity-60">
                                          <span>{open ? '▲' : '▼'}</span> TRAMA
                                        </button>
                                        {starsEl}
                                      </div>
                                      {open && <p className="text-zinc-300 text-xs leading-relaxed mt-2">{film.description}</p>}
                                    </div>
                                  );
                                })()}
                                {/* biglietto — sempre visibile */}
                                {arenaCinema?.ticketUrl ? (
                                  <a href={arenaCinema.ticketUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#D4AF37] text-black font-black uppercase text-xs tracking-widest active:scale-95 transition-transform">
                                    🎟 Acquista biglietto
                                  </a>
                                ) : (
                                  <div className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-zinc-800 text-zinc-500 font-black uppercase text-xs tracking-widest border border-white/5 cursor-not-allowed">
                                    🎟 Biglietteria — prossimamente
                                  </div>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })() : (
              <div className="px-6 flex flex-col gap-6 max-w-2xl mx-auto">
                {(() => {
                  const base = getFilteredEvents();
                  return base.length === 0 ? (
                    <div className="text-center py-24 flex flex-col items-center gap-6 opacity-30"><Calendar size={48} /><p className="italic font-black uppercase text-[10px]">Nessun evento disponibile</p></div>
                  ) : base.map(ev => (
                  <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="group relative w-full rounded-[3rem] overflow-hidden active:scale-[0.98] transition-all duration-500 shadow-2xl bg-[#080808] border border-white/5 cursor-pointer">
                    <div className="h-auto min-h-[300px] bg-black flex items-center justify-center p-2 relative overflow-hidden text-center">
                      <img src={ev.imageUrl} alt="Event" className="max-w-full max-h-full object-contain transition-transform duration-[3s] group-hover:scale-105 mx-auto" />
                      {ev.isCancelled && (
                        <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-20">
                          <p className="text-red-500 font-black text-2xl italic uppercase rotate-[-12deg] border-4 border-red-600 px-5 py-2 shadow-2xl">EVENTO ANNULLATO</p>
                        </div>
                      )}
                      {ev.isPriveSoldOut && !ev.isCancelled && (
                        <div className="absolute bottom-3 right-3 bg-black/80 text-amber-400 font-black text-[8px] px-3 py-1.5 rounded-full border border-amber-400/40 uppercase tracking-widest z-20">Sold out Privé</div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-full p-10">
                      <h3 className="text-3xl font-black italic uppercase leading-none text-white tracking-tighter mb-4">{ev.title}</h3>
                      <div className="flex justify-between items-center text-left">
                        <div className="flex items-center gap-2 text-zinc-500 font-black text-[10px] uppercase tracking-widest">
                          <Calendar size={14} className="text-[#D4AF37]" /> {new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl"><ArrowRight size={22} strokeWidth={3} /></div>
                      </div>
                    </div>
                  </div>
                  ));
                })()}
              </div>
              )}
            </>
          )}
        </div>
      )}

      {(showAdminLogin || showSuperAdminLogin) && (
        <div className="fixed inset-0 bg-black/98 z-[100] flex items-center justify-center p-10 animate-in fade-in zoom-in text-center">
          <div className="w-full max-w-sm space-y-10">
            <div onClick={() => { if (showAdminLogin) { const n = lockClickCount + 1; if (n >= 7) { setShowAdminLogin(false); setShowSuperAdminLogin(true); setLockClickCount(0); } else setLockClickCount(n); } }} className="cursor-pointer active:scale-90 transition-transform">
              {showSuperAdminLogin ? <ShieldCheck className="mx-auto text-red-600 mb-4" size={56} /> : <Lock className="mx-auto text-[#D4AF37] mb-4" size={56} />}
            </div>
            {showSuperAdminLogin ? (
              <>
                <h2 className="text-white font-black italic uppercase">SuperAdmin Access</h2>
                <input type="password" placeholder="SUPER CODE" className="w-full p-6 bg-zinc-900 border border-red-900/30 rounded-2xl text-white text-center font-black tracking-[0.6em] outline-none focus:border-red-600" value={superAdminPassword} onChange={e => setSuperAdminPassword(e.target.value)} />
                <button onClick={handleVerifySuperAdminPassword} className="w-full bg-red-600 text-white p-6 rounded-full font-black uppercase shadow-2xl active:scale-95">ENTRA MASTER</button>
                <button onClick={() => { setShowSuperAdminLogin(false); setShowAdminLogin(true); }} className="text-zinc-500 text-[10px] font-black uppercase underline">Torna Admin</button>
              </>
            ) : (
              <>
                <button onClick={() => { window.location.href = '/admin-segreto-stefano'; }} className="w-full bg-white text-black p-6 rounded-full font-black uppercase shadow-2xl active:scale-95">ACCESSO STAFF</button>
                <button onClick={() => { setShowAdminLogin(false); setLockClickCount(0); }} className="text-zinc-500 text-[10px] font-black uppercase underline">Chiudi</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* POPUP PUBBLICITARIO APERTURA */}
      {showPopup && popupData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-sm my-auto">

            {/* Card catturabile per "Salva in Galleria" */}
            {(() => {
              const pos = popupData.extraImagePosition || 'bottom';
              const overlayClass = {
                'top-left':     'absolute top-2 left-2',
                'top-center':   'absolute top-2 left-1/2 -translate-x-1/2',
                'top-right':    'absolute top-2 right-2',
                'bottom-left':  'absolute bottom-2 left-2',
                'bottom-right': 'absolute bottom-2 right-2',
              }[pos];
              const isOverlay = pos !== 'bottom';
              return (
                <div ref={popupRef} className="bg-black rounded-3xl overflow-hidden shadow-2xl">

                  {/* Media + overlay immagine extra */}
                  <div className="relative">
                    {popupData.mediaType === 'video' && popupData.videoUrl ? (() => {
                      const url = popupData.videoUrl;
                      const ytM = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/\s]+)/);
                      const isFb = /facebook\.com|fb\.watch|fb\.com/.test(url);
                      if (ytM) return (
                        <iframe
                          src={`https://www.youtube.com/embed/${ytM[1]}?autoplay=1&rel=0&playsinline=1`}
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                      if (isFb) return (
                        <iframe
                          src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=500&show_text=false&autoplay=1`}
                          className="w-full aspect-video"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      );
                      return <video src={url} className="w-full object-contain" autoPlay playsInline loop />;
                    })() : popupData.imageUrl ? (
                      <img src={popupData.imageUrl} alt="Promo" className="w-full object-contain" />
                    ) : null}

                    {popupData.extraImageUrl && isOverlay && (
                      <div className={overlayClass}>
                        <img src={popupData.extraImageUrl} alt="Extra" className="w-16 h-16 object-contain rounded-xl bg-white/10 p-1 shadow-lg" />
                      </div>
                    )}
                  </div>

                  {/* Info testo + immagine extra "sotto" */}
                  {(popupData.slogan || popupData.address || popupData.expiry || (popupData.extraImageUrl && !isOverlay)) && (
                    <div className="px-5 pt-4 pb-5 flex flex-col gap-3">

                      {popupData.slogan && (
                        <p className="text-white font-black text-base text-center leading-snug">{popupData.slogan}</p>
                      )}

                      {(savingGallery ? formatExpiryExact(popupData.expiry) : formatExpiry(popupData.expiry)) && (
                        <div className="bg-red-600 rounded-xl px-4 py-2 text-center">
                          <p className="text-white font-black text-sm uppercase tracking-wide">
                            ⏳ {savingGallery ? formatExpiryExact(popupData.expiry) : formatExpiry(popupData.expiry)}
                          </p>
                        </div>
                      )}

                      {popupData.address && (
                        <p className="text-zinc-400 text-xs text-center font-bold">📍 {popupData.address}</p>
                      )}

                      {popupData.extraImageUrl && !isOverlay && (
                        <div className="flex justify-center pt-1">
                          <img src={popupData.extraImageUrl} alt="Extra" className="max-h-24 object-contain rounded-xl" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Pulsante Salva in Galleria */}
            {popupData.showSaveButton && (
              <button
                onClick={handleSavePromoGallery}
                className="w-full mt-3 bg-white text-black font-black uppercase text-xs py-3 rounded-full tracking-widest shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Download size={14} /> Salva Promo in Galleria
              </button>
            )}

            {/* Pulsante chiudi */}
            <button
              onClick={handleClosePopup}
              disabled={popupCountdown > 0}
              className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center font-black text-base shadow-lg transition-all border-2
                ${popupCountdown > 0
                  ? 'bg-black/60 text-white border-white/30 cursor-not-allowed'
                  : 'bg-red-600 text-white border-white active:scale-90'}`}
            >
              {popupCountdown > 0 ? popupCountdown : '✕'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-2xl border-t border-white/5 p-4 flex justify-center items-center gap-10 z-40">
        <button onClick={() => handleStarClick('L')} className="p-4 hover:scale-110 transition-transform"><Star size={24} className="text-[#D4AF37] animate-pulse" /></button>
        <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500 italic text-center">Product 2026 Stefano Di Bella</span>
        <button onClick={() => handleStarClick('R')} className="p-4 hover:scale-110 transition-transform"><Star size={24} className="text-[#D4AF37] animate-pulse" /></button>
      </div>
    </div>
  );
};

export default Home;
