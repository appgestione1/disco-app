import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas'; 
import { 
  ChevronLeft, Star, Minus, Plus, Calendar, Crown, Lock, ArrowRight, ShieldCheck,
  Music, Theater, Film, Mic2, Sun, Utensils, Sparkles, LayoutGrid, Download, Send, Phone
} from 'lucide-react';

// --- COMPONENTE GRATTA E VINCI (LOGICA ORIGINALE) ---
const ScratchCard = ({ onWin }) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [won] = useState(Math.random() < 0.15); 
  const [winTriggered, setWinTriggered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const initCanvas = () => {
      const width = 300;
      const height = 150;
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
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();

      if (won && !winTriggered) {
        setWinTriggered(true);
        if (onWin) onWin();
      }
    };

    const handleStart = (e) => { isDrawingRef.current = true; scratch(e); };
    const handleMove = (e) => { if (isDrawingRef.current || e.type === 'touchmove') scratch(e); };
    const handleEnd = () => { isDrawingRef.current = false; };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
    };
  }, [won, winTriggered, onWin]);

  return (
    <div className="relative w-[300px] h-[150px] bg-zinc-900 flex items-center justify-center border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-2xl">
      <span className="text-xl font-black text-white text-center px-4 uppercase italic select-none">
        {won ? "🍹 VIP DRINK VINTO!" : "❌ RITENTA"}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none z-10" width="300" height="150" />
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
  
  // MODIFICATO: Aggiunto stato per il telefono
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(''); 
  
  const [priveGuests, setPriveGuests] = useState(1);
  const [ticketId, setTicketId] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [winClaimed, setWinClaimed] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const passRef = useRef(null); 
  const PRIVE_ADVANCE_FEE = 50;

  const categories = [
    { id: 'TUTTI', label: 'TUTTI GLI EVENTI', icon: LayoutGrid },
    { id: 'DISCOTECA', label: 'DISCOTECA', icon: Music },
    { id: 'TEATRO', label: 'TEATRO', icon: Theater },
    { id: 'CINEMA', label: 'CINEMA', icon: Film },
    { id: 'CONCERTI', label: 'CONCERTI', icon: Mic2 },
    { id: 'ARENE ESTIVE', label: 'ARENE ESTIVE', icon: Sun },
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
    const index = Math.round(scrollPos / 80);
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

  const handleDownloadPass = async () => {
    if (passRef.current) {
      const canvas = await html2canvas(passRef.current, { backgroundColor: '#000000', scale: 2 });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `Pass_${customerName}.png`;
      link.click();
    }
  };

  // MODIFICATO: Notifica vincita al PR tramite WhatsApp
  const handleClaimWin = async () => {
    try {
      setLoading(true);
      // Aggiorna database
      await updateDoc(doc(db, "tickets", ticketId), { won: true });
      
      // Recupera numero PR
      const prSnap = await getDoc(doc(db, "prs_registry", prRef));
      const prPhone = prSnap.exists() ? prSnap.data().phone : "";

      if (prPhone) {
        const message = `Ciao! Sono ${customerName}, ho appena vinto un drink per la serata ${selectedEvent.title} con il codice ticket: ${ticketId}!`;
        const whatsappUrl = `https://wa.me/${prPhone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      setWinClaimed(true);
      alert(`Vincita registrata! Abbiamo aperto WhatsApp per informare il tuo PR di riferimento.`);
    } catch (e) { alert("Errore riscatto"); } finally { setLoading(false); }
  };

  const handleAction = async () => {
    if (!customerName.trim()) return alert("Inserisci Nome e Cognome");
    if (!customerPhone.trim()) return alert("Inserisci il numero WhatsApp");
    
    setLoading(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const data = {
      id: newId, eventId: selectedEvent.id, prId: prRef,
      customerName, customerPhone, used: false, won: false, timestamp: new Date(),
      type: bookingMode === 'single' ? 'singolo' : 'prive'
    };
    if (bookingMode === 'prive') { data.guests = priveGuests; data.advancePaid = priveGuests * PRIVE_ADVANCE_FEE; }
    try { await setDoc(doc(db, "tickets", newId), data); setTicketId(newId); } 
    catch (e) { alert("Errore generazione"); } finally { setLoading(false); }
  };

  const resetView = () => { 
    setSelectedEvent(null); setBookingMode(null); setTicketId(null); 
    setCustomerName(''); setCustomerPhone(''); setPriveGuests(1); setHasWon(false); setWinClaimed(false);
  };

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
            <div className="space-y-4">
              <button onClick={() => setBookingMode('single')} className="w-full bg-white text-black p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between active:scale-95 transition-transform">
                <span>OTTIENI PASS LISTA</span> <ArrowRight size={18} />
              </button>
              <button onClick={() => setBookingMode('prive')} className="w-full border-2 border-[#D4AF37] text-[#D4AF37] p-6 rounded-full font-black uppercase text-xs tracking-widest flex items-center justify-between active:scale-95 transition-transform">
                <div className="flex items-center gap-2"><Crown size={18}/><span>PRENOTA TAVOLO PRIVÉ</span></div> <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : !ticketId ? (
          <div className="bg-zinc-900/80 p-8 rounded-[2.5rem] border border-white/5 space-y-8 backdrop-blur-xl animate-in slide-in-from-bottom-10">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-center">
              {bookingMode === 'prive' ? 'RISERVA PRIVÉ' : 'ACCESSO LISTA'}
            </h3>
            <div className="space-y-6">
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic">Intestatario</label>
                 <input type="text" placeholder="NOME E COGNOME" className="w-full p-5 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] text-center" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>

               {/* NUOVO: CAMPO TELEFONO */}
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-zinc-500 ml-2 tracking-widest italic">Numero WhatsApp</label>
                 <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                   <input type="tel" placeholder="333 1234567" className="w-full p-5 pl-12 bg-black border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] text-center" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                 </div>
               </div>

               {bookingMode === 'prive' && (
                 <div className="text-center space-y-6">
                    <div className="flex items-center justify-center gap-12 bg-black/40 p-6 rounded-3xl border border-white/5">
                      <button onClick={() => setPriveGuests(Math.max(1, priveGuests - 1))} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Minus/></button>
                      <span className="text-5xl font-black italic">{priveGuests}</span>
                      <button onClick={() => setPriveGuests(priveGuests + 1)} className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-[#D4AF37]"><Plus/></button>
                    </div>
                    <div className="flex justify-between items-center px-4"><p className="text-3xl font-black text-[#D4AF37]">€{priveGuests * PRIVE_ADVANCE_FEE}</p><ShieldCheck className="text-zinc-800" size={40} /></div>
                 </div>
               )}
               <button onClick={handleAction} disabled={loading} className="w-full bg-[#D4AF37] text-black p-6 rounded-full font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 text-sm">{loading ? 'ELABORAZIONE...' : 'CONFERMA E GENERA'}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 pb-10 text-center">
            <div ref={passRef} className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-10 flex flex-col items-center border border-white/10 shadow-2xl overflow-hidden mb-6">
               <div className="absolute top-8 right-8 opacity-10"><Crown size={120} /></div>
               <h3 className="text-[#D4AF37] font-black text-xs tracking-[0.4em] uppercase mb-10 text-center">DIGITAL MEMBER PASS</h3>
               <div className="bg-white p-5 rounded-[2rem] mb-10">
                  <QRCodeCanvas value={ticketId} size={200} />
               </div>
               <div className="text-center mb-10">
                 <p className="text-4xl font-black italic uppercase leading-none tracking-tighter mb-1">{customerName}</p>
                 <p className="text-zinc-500 font-bold text-[10px] uppercase">{bookingMode === 'prive' ? `VIP TABLE x ${priveGuests}` : 'GUESTLIST ENTRANCE'}</p>
               </div>
               <div className="w-full flex justify-between items-end border-t border-white/10 pt-8 text-left">
                  <div><p className="text-[8px] text-zinc-600 font-black uppercase mb-1">TICKET ID</p><p className="font-mono text-xs font-bold">{ticketId}</p></div>
                  <div className="text-right"><p className="text-[8px] text-zinc-600 font-black uppercase mb-1">AUTHORIZED BY</p><p className="text-[#D4AF37] font-black italic text-xl leading-none">{prRef}</p></div>
               </div>
            </div>

            <button onClick={handleDownloadPass} className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl mb-12 active:scale-95">
              <Download size={18} /> SALVA NELLA GALLERIA
            </button>

            <div className="text-center">
              <p className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase mb-6 italic text-center">Luxury Reward</p>
              <ScratchCard onWin={() => setHasWon(true)} />
              {hasWon && !winClaimed && (
                <button onClick={handleClaimWin} className="mt-6 flex items-center justify-center gap-2 w-full bg-[#D4AF37] text-black p-5 rounded-2xl font-black uppercase text-sm animate-bounce shadow-2xl">
                  <Send size={20} /> RISCATTA PREMIO E NOTIFICA PR
                </button>
              )}
              {winClaimed && <p className="mt-4 text-green-500 font-black uppercase italic text-xs tracking-widest animate-pulse">Vincita notificata correttamente! ✅</p>}
            </div>

            <button onClick={resetView} className="mt-12 text-zinc-600 font-black uppercase text-[10px] border-b border-zinc-900 pb-2">Torna agli eventi</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden select-none pb-24">
      <div className="h-[30vh] flex flex-col items-center justify-center relative p-8">
        <video src="/logo.mp4" autoPlay muted playsInline onClick={() => setClickCount(c => c+1 >= 7 ? (setShowAdminLogin(true), 0) : c+1)} className="w-72 h-auto relative z-10 drop-shadow-[0_0_30px_rgba(212,175,55,0.2)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
      </div>

      {step === 1 && (
        <div className="px-6 space-y-6 animate-in fade-in max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4 text-center">
             <div className="h-[1px] w-8 bg-[#D4AF37]/50"></div>
             <h1 className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] italic">Select Experience</h1>
             <div className="h-[1px] w-8 bg-[#D4AF37]/50"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setStep(2); }} className="group relative flex flex-col items-center justify-center p-8 rounded-[2rem] border bg-zinc-900/40 border-white/5 text-zinc-600 active:scale-95 transition-all">
                <cat.icon size={28} className="mb-3" />
                <span className="text-[9px] font-black uppercase tracking-widest text-center">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in slide-in-from-bottom-20 duration-700">
          <button onClick={() => { setStep(1); setActiveCategory(null); }} className="px-8 py-4 text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] flex items-center gap-3"><ChevronLeft size={18} strokeWidth={3} /> Indietro</button>
          
          <div className="mt-0 text-center mb-0">
             <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-1 italic">MOOD SCELTO</p>
             <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {categories.find(c => c.id === activeCategory)?.label}
             </h2>
          </div>

          <div className="relative h-52 mt-0 mb-2 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-x-6 h-[80px] border-2 border-[#D4AF37] bg-transparent pointer-events-none z-20 rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.1)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none z-10" />
            <div onScroll={handleDateChange} className="h-full w-full overflow-y-scroll no-scrollbar snap-y snap-mandatory px-20 text-center">
              <div className="h-[75px]" /> 
              {dates.map((d, i) => {
                const isSel = selectedDate === d.toISOString().split('T')[0];
                return (
                  <div key={i} className="h-[80px] flex flex-col items-center justify-center snap-center transition-all duration-300">
                    <span className={`uppercase font-black tracking-[0.2em] text-[8px] mb-1 ${isSel ? 'text-[#D4AF37]' : 'text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                    <span className={`transition-all duration-500 uppercase font-black tracking-tighter italic leading-none ${isSel ? 'text-4xl text-white scale-110' : 'text-xl text-zinc-800'}`}>{d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
                  </div>
                );
              })}
              <div className="h-[75px]" /> 
            </div>
          </div>

          <div className="px-6 flex flex-col gap-6 max-w-2xl mx-auto">
            {getFilteredEvents().length === 0 ? (
              <div className="text-center py-24 flex flex-col items-center gap-6 opacity-30"><Calendar size={48} /><p className="italic font-black uppercase text-[10px]">Nessun evento disponibile</p></div>
            ) : (
              getFilteredEvents().map(ev => (
                <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="group relative w-full rounded-[3rem] overflow-hidden active:scale-[0.98] transition-all duration-500 shadow-2xl bg-[#080808] border border-white/5 cursor-pointer">
                  <div className="h-auto min-h-[300px] bg-black flex items-center justify-center p-2 relative overflow-hidden text-center">
                    <img src={ev.imageUrl} alt="Event" className="max-w-full max-h-full object-contain transition-transform duration-[3s] group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-full p-10">
                    <h3 className="text-3xl font-black italic uppercase leading-none text-white tracking-tighter mb-4">{ev.title}</h3>
                    <div className="flex justify-between items-center text-left">
                       <div className="flex items-center gap-4 text-zinc-500 font-black text-[10px] uppercase tracking-widest">
                         <div className="flex items-center gap-2"><Calendar size={14} className="text-[#D4AF37]"/> {new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</div>
                         <span>h. 23:30</span>
                       </div>
                       <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl"><ArrowRight size={22} strokeWidth={3} /></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/98 z-[100] flex items-center justify-center p-10 animate-in fade-in zoom-in text-center">
          <div className="w-full max-w-sm space-y-10">
            <Lock className="mx-auto text-[#D4AF37] mb-4" size={56} />
            <input type="password" placeholder="STAFF CODE" className="w-full p-6 bg-zinc-900 border border-white/10 rounded-2xl text-white text-center font-black tracking-[0.6em] outline-none focus:border-[#D4AF37]" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            <button onClick={handleVerifyPassword} className="w-full bg-white text-black p-6 rounded-full font-black uppercase shadow-2xl active:scale-95 transition-all">ACCESSO STAFF</button>
            <button onClick={() => setShowAdminLogin(false)} className="text-zinc-500 text-[10px] font-black uppercase underline">Chiudi</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-2xl border-t border-white/5 p-5 flex justify-center items-center gap-4 z-40">
        <Star size={10} className="text-[#D4AF37] animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.5em] text-zinc-600 italic text-center">Product Stefano Di Bella 2026</span>
        <Star size={10} className="text-[#D4AF37] animate-pulse" />
      </div>
    </div>
  );
};

export default Home;