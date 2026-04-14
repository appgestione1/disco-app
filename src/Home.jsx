import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  ChevronLeft, Star, Minus, Plus, Calendar, Crown, Lock, ArrowRight, ShieldCheck,
  Music, Theater, Film, Mic2, Sun, Utensils, Sparkles, LayoutGrid
} from 'lucide-react';

// --- COMPONENTE GRATTA E VINCI (STILE IMMAGINE F) ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [won] = useState(Math.random() < 0.15);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const initCanvas = () => {
      const width = 300; const height = 150;
      // Gradiente Oro Metallizzato come Immagine F
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#D4AF37'); gradient.addColorStop(0.5, '#F9E498'); gradient.addColorStop(1, '#B8860B');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      ctx.font = '900 18px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.textAlign = 'center';
      ctx.fillText('SCRATCH TO REVEAL', width / 2, height / 2 + 7);
    };
    initCanvas();
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const scratch = (e) => {
      if (!isDrawingRef.current && e.type !== 'mousemove') return;
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
      const { x, y } = getPos(e);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    };
    canvas.addEventListener('mousedown', () => isDrawingRef.current = true);
    canvas.addEventListener('mousemove', scratch);
    window.addEventListener('mouseup', () => isDrawingRef.current = false);
    canvas.addEventListener('touchstart', (e) => { isDrawingRef.current = true; scratch(e); });
    canvas.addEventListener('touchmove', scratch, { passive: false });
    return () => { canvas.removeEventListener('mousemove', scratch); };
  }, []);

  return (
    <div className="relative w-[300px] h-[150px] bg-zinc-950 flex items-center justify-center border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-2xl">
      <div className="text-center px-4">
        {won ? <span className="text-[#D4AF37] font-black italic uppercase text-xl">🍹 Vip Drink Vinto!</span> : <span className="text-zinc-700 font-black uppercase text-sm">Ritenta la prossima serata</span>}
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair touch-none z-10" width="300" height="150" />
    </div>
  );
};

// --- HOME ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prRef = searchParams.get('ref') || 'MASTER';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); 
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [bookingMode, setBookingMode] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [priveGuests, setPriveGuests] = useState(1);
  const [ticketId, setTicketId] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const PRIVE_ADVANCE_FEE = 50;

  const categories = [
    { id: 'TUTTI', label: 'TUTTI GLI EVENTI', icon: LayoutGrid },
    { id: 'DISCOTECA', label: 'CLUBBING', icon: Music },
    { id: 'TEATRO', label: 'TEATRO', icon: Theater },
    { id: 'CINEMA', label: 'CINEMA', icon: Film },
    { id: 'CONCERTI', label: 'LIVE SHOW', icon: Mic2 },
    { id: 'ARENE', label: 'ARENE', icon: Sun },
    { id: 'PUB', label: 'LOUNGE/PUB', icon: Utensils },
  ];

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const evSnap = await getDocs(collection(db, "events"));
      const evData = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(evData.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const getFilteredEvents = () => {
    return events.filter(ev => {
      const matchesCategory = activeCategory === 'TUTTI' || ev.category === activeCategory;
      const evDate = new Date(ev.date).toISOString().split('T')[0];
      return matchesCategory && evDate === selectedDate;
    });
  };

  const handleDateChange = (e) => {
    const scrollPos = e.target.scrollTop;
    const index = Math.round(scrollPos / 90);
    if (dates[index]) {
      const formatted = dates[index].toISOString().split('T')[0];
      if (selectedDate !== formatted) setSelectedDate(formatted);
    }
  };

  const handleVerifyPassword = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "admin"));
      const actualPassword = docSnap.exists() ? docSnap.data().password : "admin";
      if (adminPassword === actualPassword) { window.location.href = '/admin-segreto-stefano'; } 
      else { alert("Password Errata"); setAdminPassword(''); }
    } catch (error) { alert("Errore"); }
  };

  const handleAction = async () => {
    if (!customerName.trim()) return alert("Inserisci Nome e Cognome");
    setLoading(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const data = {
      id: newId, eventId: selectedEvent.id, prId: prRef,
      customerName, used: false, won: false, timestamp: new Date(),
      type: bookingMode === 'single' ? 'singolo' : 'prive'
    };
    if (bookingMode === 'prive') { data.guests = priveGuests; data.advancePaid = priveGuests * PRIVE_ADVANCE_FEE; }
    try { await setDoc(doc(db, "tickets", newId), data); setTicketId(newId); } 
    catch (e) { alert("Errore"); } finally { setLoading(false); }
  };

  const resetView = () => { setSelectedEvent(null); setBookingMode(null); setTicketId(null); setCustomerName(''); setPriveGuests(1); };

  // --- VISTA DETTAGLIO ---
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-black text-white p-6 animate-in slide-in-from-right duration-500 overflow-x-hidden">
        <button onClick={resetView} className="mb-6 flex items-center gap-2 text-zinc-500 uppercase text-[10px] tracking-widest font-black">
          <ChevronLeft size={16} /> CHIUDI
        </button>

        {!bookingMode ? (
          <div className="animate-in fade-in duration-700">
            <div className="w-full bg-black rounded-[2rem] overflow-hidden mb-8 border border-white/10 shadow-2xl">
              <img src={selectedEvent.imageUrl} alt="Event" className="w-full object-contain max-h-[60vh]" />
            </div>
            <h2 className="text-4xl font-black italic uppercase leading-none mb-4 tracking-tighter">{selectedEvent.title}</h2>
            <p className="text-zinc-500 font-bold text-xs mb-10">{selectedEvent.description || "Un'esperienza esclusiva."}</p>
            
            {/* BOTTONI STILE IMMAGINE B */}
            <div className="space-y-4">
              <button onClick={() => setBookingMode('single')} className="w-full bg-white text-black p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between">
                <span>OTTIENI PASS LISTA</span> <ArrowRight size={18} />
              </button>
              <button onClick={() => setBookingMode('prive')} className="w-full border-2 border-[#D4AF37] text-[#D4AF37] p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between">
                <div className="flex items-center gap-2"><Crown size={18}/><span>PRENOTA TAVOLO PRIVÉ</span></div> <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : !ticketId ? (
          <div className="bg-zinc-900/80 p-8 rounded-[2.5rem] border border-white/5 space-y-8 backdrop-blur-xl animate-in slide-in-from-bottom-10">
            {/* INTESTAZIONE STILE IMMAGINE D/E */}
            <div className="flex items-center gap-3">
              {bookingMode === 'prive' ? <Crown className="text-[#D4AF37]" size={28}/> : <Star className="text-[#D4AF37]" size={28}/>}
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">
                {bookingMode === 'prive' ? 'RISERVA PRIVÉ' : 'ACCESSO LISTA'}
              </h3>
            </div>
            
            <div className="space-y-6">
               <div className="text-center">
                 <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-2 block">Intestatario</label>
                 <input type="text" placeholder="NOME E COGNOME" className="w-full p-6 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] transition-all text-center" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>

               {bookingMode === 'prive' && (
                 <div className="text-center">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 block">Numero Ospiti al Tavolo</label>
                    <div className="flex items-center justify-center gap-12 bg-black/40 p-6 rounded-3xl border border-white/5">
                      <button onClick={() => setPriveGuests(Math.max(1, priveGuests - 1))} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37] active:bg-[#D4AF37]/20"><Minus/></button>
                      <span className="text-5xl font-black italic">{priveGuests}</span>
                      <button onClick={() => setPriveGuests(priveGuests + 1)} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37] active:bg-[#D4AF37]/20"><Plus/></button>
                    </div>
                    <div className="mt-6 flex justify-between items-center px-4">
                       <div className="text-left"><p className="text-[10px] text-zinc-500 font-black uppercase">Acconto</p><p className="text-3xl font-black text-[#D4AF37]">€{priveGuests * PRIVE_ADVANCE_FEE}</p></div>
                       <ShieldCheck className="text-zinc-800" size={40} />
                    </div>
                 </div>
               )}

               <button onClick={handleAction} disabled={loading} className="w-full bg-[#D4AF37] text-black p-6 rounded-full font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 transition-all text-sm mt-4">
                 {loading ? 'ELABORAZIONE...' : 'CONFERMA E GENERA'}
               </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
            {/* PASS DIGITALE STILE IMMAGINE A/F */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-10 flex flex-col items-center border border-white/10 shadow-2xl overflow-hidden">
               <div className="absolute top-8 right-8 opacity-10"><Crown size={120} /></div>
               <h3 className="text-[#D4AF37] font-black text-xs tracking-[0.4em] uppercase mb-10">DIGITAL MEMBER PASS</h3>
               
               <div className="bg-white p-5 rounded-[2rem] mb-10">
                  <QRCodeCanvas value={ticketId} size={200} />
               </div>

               <div className="text-center mb-10">
                 <p className="text-4xl font-black italic uppercase leading-none tracking-tighter mb-1">{customerName}</p>
                 <p className="text-zinc-500 font-bold text-[10px] tracking-[0.2em] uppercase">
                   {bookingMode === 'prive' ? `VIP TABLE x ${priveGuests}` : 'GUESTLIST ENTRANCE'}
                 </p>
               </div>

               <div className="w-full h-[1px] bg-white/10 mb-8"></div>

               <div className="w-full flex justify-between items-end">
                  <div className="text-left">
                    <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mb-1">TICKET ID</p>
                    <p className="font-mono text-xs font-bold">{ticketId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mb-1">AUTHORIZED BY</p>
                    <p className="text-[#D4AF37] font-black italic text-xl leading-none">{prRef}</p>
                  </div>
               </div>
            </div>

            <div className="mt-14 text-center">
              <p className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase mb-6">LUXURY REWARD</p>
              <ScratchCard />
            </div>

            <button onClick={resetView} className="mt-12 text-zinc-600 font-black uppercase text-[10px] tracking-[0.4em] border-b border-zinc-900 pb-2">Torna agli eventi</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden select-none pb-24">
      {/* BRAND HEADER */}
      <div className="h-[30vh] flex flex-col items-center justify-center relative p-8">
        <video src="/logo.mp4" autoPlay muted playsInline onClick={() => setClickCount(c => c+1 >= 7 ? (setShowAdminLogin(true), 0) : c+1)} className="w-72 h-auto relative z-10 drop-shadow-[0_0_30px_rgba(212,175,55,0.2)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
      </div>

      {/* STEP 1: CATEGORY GRID */}
      {step === 1 && (
        <div className="px-6 space-y-6 animate-in fade-in duration-700 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
             <div className="h-[1px] w-8 bg-[#D4AF37]/50"></div>
             <h1 className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] italic">Select Experience</h1>
             <div className="h-[1px] w-8 bg-[#D4AF37]/50"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setStep(2); }} className="group relative flex flex-col items-center justify-center p-8 rounded-[2rem] transition-all duration-500 border bg-zinc-900/40 border-white/5 text-zinc-600 hover:border-white/20 active:scale-95">
                <cat.icon size={28} className="mb-3" />
                <span className="text-[9px] font-black uppercase tracking-widest text-center">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: DATE DRUM & LISTA */}
      {step === 2 && (
        <div className="animate-in slide-in-from-bottom-20 duration-700">
          <button onClick={() => { setStep(1); setActiveCategory(null); }} className="px-8 py-4 text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] flex items-center gap-3"><ChevronLeft size={18} strokeWidth={3} /> Indietro</button>
          
          <div className="mt-4 text-center mb-10">
             <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-2">MOOD SCELTO</p>
             <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">{categories.find(c => c.id === activeCategory)?.label}</h2>
          </div>

          {/* THE DATE DRUM */}
          <div className="relative h-64 my-12 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-x-6 h-[90px] border-2 border-[#D4AF37] bg-transparent pointer-events-none z-20 rounded-2xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none z-10" />
            <div onScroll={handleDateChange} className="h-full w-full overflow-y-scroll no-scrollbar snap-y snap-mandatory px-20 text-center">
              <div className="h-[85px]" /> 
              {dates.map((d, i) => {
                const isSel = selectedDate === d.toISOString().split('T')[0];
                return (
                  <div key={i} className="h-[90px] flex flex-col items-center justify-center snap-center transition-all duration-300">
                    <span className={`uppercase font-black tracking-[0.2em] text-[9px] mb-2 ${isSel ? 'text-[#D4AF37]' : 'text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                    <span className={`uppercase font-black tracking-tighter italic leading-none ${isSel ? 'text-5xl text-white scale-110' : 'text-2xl text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
                  </div>
                );
              })}
              <div className="h-[85px]" /> 
            </div>
          </div>

          <div className="px-6 flex flex-col gap-10 max-w-2xl mx-auto">
            {getFilteredEvents().length === 0 ? (
              <div className="text-center py-24 flex flex-col items-center gap-6 opacity-30"><Calendar size={48} /><p className="italic font-black uppercase text-[10px]">Nessun evento disponibile</p></div>
            ) : (
              getFilteredEvents().map(ev => (
                <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="group relative w-full rounded-[3rem] overflow-hidden active:scale-[0.98] transition-all duration-500 shadow-2xl bg-[#080808] border border-white/5">
                  <div className="h-[450px] bg-black flex items-center justify-center p-4 relative overflow-hidden">
                    <img src={ev.imageUrl} alt="Event" className="max-w-full max-h-full object-contain transition-transform duration-[3s] group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-full p-10">
                    <h3 className="text-3xl font-black italic uppercase leading-none text-white tracking-tighter mb-4">{ev.title}</h3>
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-4 text-zinc-500 font-black text-[10px] uppercase"><div className="flex items-center gap-2"><Calendar size={14} className="text-[#D4AF37]"/> {new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</div><span>h. 23:30</span></div>
                       <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center"><ArrowRight size={22} strokeWidth={3} /></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LOGIN STAFF */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/98 z-[100] flex items-center justify-center p-10 animate-in fade-in zoom-in">
          <div className="w-full max-w-sm space-y-10 text-center">
            <Lock className="mx-auto text-[#D4AF37] mb-4" size={56} />
            <input type="password" placeholder="STAFF CODE" className="w-full p-6 bg-zinc-900 border border-white/10 rounded-2xl text-white text-center font-black tracking-[0.6em] outline-none focus:border-[#D4AF37]" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            <button onClick={handleVerifyPassword} className="w-full bg-white text-black p-6 rounded-full font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">ACCESSO STAFF</button>
            <button onClick={() => setShowAdminLogin(false)} className="text-zinc-500 text-[10px] font-black uppercase underline">Chiudi</button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-2xl border-t border-white/5 p-5 flex justify-center items-center gap-4 z-40">
        <Star size={10} className="text-[#D4AF37] animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">VIP Concierge • Est. 2024</span>
        <Star size={10} className="text-[#D4AF37] animate-pulse" />
      </div>
    </div>
  );
};

export default Home;