import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  ChevronLeft, Ticket, Star, Minus, Plus, Calendar, Crown, Lock
} from 'lucide-react';

// --- COMPONENTE GRATTA E VINCI ORIGINALE ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [won] = useState(Math.random() < 0.15); // 15% probabilità

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const initCanvas = () => {
      const width = 300;
      const height = 150;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FFEE00'; 
      ctx.fillRect(0, 0, width, height);
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GRATTA QUI', width / 2, height / 2);
    };

    const animId = requestAnimationFrame(initCanvas);

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
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
    };
  }, []);

  return (
    <div className="relative w-[300px] h-[150px] bg-white flex items-center justify-center border-4 border-black overflow-hidden shadow-[8px_8px_0px_#FFEE00] touch-none">
      <span className="text-2xl font-black text-black text-center px-4 uppercase italic leading-none select-none">
        {won ? "🍹 VINTO DRINK!" : "❌ NON VINTO"}
      </span>
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 cursor-crosshair touch-none z-10" 
        width="300" 
        height="150" 
      />
    </div>
  );
};

// --- HOME (LATO CLIENTE - SELEZIONE EVENTI E PASSAGGIO SEGRETO) ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prRef = searchParams.get('ref') || 'NESSUN PR';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TUTTI');
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [bookingMode, setBookingMode] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [priveGuests, setPriveGuests] = useState(1);
  const [ticketId, setTicketId] = useState(null);

  // Stati per il Passaggio Segreto
  const [clickCount, setClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const PRIVE_ADVANCE_FEE = 50;

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const evSnap = await getDocs(collection(db, "events"));
      const evData = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      evData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(evData);
    } catch (e) {
      console.error("Errore fetch eventi:", e);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter(ev => {
      const evDate = new Date(ev.date);
      const diffTime = evDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (activeTab === 'OGGI') return diffDays === 0;
      if (activeTab === 'SETTIMANA') return diffDays >= 0 && diffDays <= 7;
      if (activeTab === 'MESE') return diffDays >= 0 && diffDays <= 30;
      return true;
    });
  };

  const handleGeneratePass = async () => {
    if (!customerName.trim()) return alert("Inserisci il tuo Nome e Cognome!");
    setLoading(true);
    
    // Genera un VERO ID univoco compatibile con lo Scanner
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    
    try {
      await setDoc(doc(db, "tickets", newId), {
        id: newId,
        eventId: selectedEvent.id,
        prId: prRef,
        customerName: customerName,
        type: 'singolo',
        used: false,
        won: false,
        timestamp: new Date()
      });
      setTicketId(newId);
    } catch (e) {
      alert("Errore durante la generazione del pass.");
    } finally {
      setLoading(false);
    }
  };

  const handleBookPrive = async () => {
    if (!customerName.trim()) return alert("Inserisci il tuo Nome e Cognome!");
    setLoading(true);
    
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();

    try {
      await setDoc(doc(db, "tickets", newId), {
        id: newId,
        eventId: selectedEvent.id,
        prId: prRef,
        customerName: customerName,
        type: 'prive',
        guests: priveGuests,
        advancePaid: priveGuests * PRIVE_ADVANCE_FEE,
        used: false,
        won: false,
        timestamp: new Date()
      });
      setTicketId(newId);
    } catch (e) {
      alert("Errore durante la prenotazione.");
    } finally {
      setLoading(false);
    }
  };

  const resetView = () => {
    setSelectedEvent(null);
    setBookingMode(null);
    setTicketId(null);
    setCustomerName('');
    setPriveGuests(1);
  };

  // Funzione Easter Egg: 7 Click sul LOGO
  const handleSecretClick = () => {
    setClickCount(prev => {
      if (prev + 1 >= 7) {
        setShowAdminLogin(true);
        return 0;
      }
      return prev + 1;
    });
  };

  // Funzione Verifica Password per l'Admin
  const handleVerifyPassword = async () => {
    try {
      const docRef = doc(db, "settings", "admin");
      const docSnap = await getDoc(docRef);
      let actualPassword = "admin"; // Default se non impostata

      if (docSnap.exists() && docSnap.data().password) {
        actualPassword = docSnap.data().password;
      }

      if (adminPassword === actualPassword) {
        window.location.href = '/admin-segreto-stefano'; 
      } else {
        alert("Accesso Negato: Password Errata");
        setAdminPassword('');
      }
    } catch (error) {
      alert("Errore di connessione.");
    }
  };

  // --- VISTA DETTAGLIO EVENTO ---
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-black text-white font-sans animate-in fade-in pb-20">
        
        <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between">
          <button onClick={resetView} className="text-[#FFEE00] flex items-center gap-1 font-black uppercase text-sm z-10">
            <ChevronLeft size={20} /> Indietro
          </button>
          
          {/* Logo ingrandito nell'header dei dettagli */}
          <img 
            src="/logo.png" 
            alt="Event Catania" 
            className="h-12 object-contain absolute left-1/2 -translate-x-1/2" 
          />
        </div>

        <div className="relative">
          {selectedEvent.imageUrl ? (
            <div className="w-full h-80 bg-zinc-950 border-b-2 border-zinc-800 flex justify-center items-center">
               <img src={selectedEvent.imageUrl} alt="Locandina" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-full h-72 bg-zinc-900 flex items-center justify-center font-black text-zinc-700 text-2xl border-b-2 border-zinc-800">NESSUNA FOTO</div>
          )}
          
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-r from-purple-900 to-black p-3 border-y-2 border-[#FFEE00] flex items-center justify-center gap-2">
            <Star size={16} className="text-[#FFEE00]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white">
              Sponsorizzato da: <span className="text-[#FFEE00]">GREY GOOSE VODKA</span>
            </p>
            <Star size={16} className="text-[#FFEE00]" />
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-4xl font-black italic uppercase leading-none mb-2">{selectedEvent.title}</h2>
          <div className="flex items-center gap-2 text-[#FFEE00] mb-4 font-bold text-sm">
            <Calendar size={16} /> <span>{new Date(selectedEvent.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <p className="text-zinc-400 font-medium text-sm whitespace-pre-wrap leading-relaxed mb-8 bg-zinc-900 p-4 rounded-lg">
            {selectedEvent.description || "Unisciti a noi per la notte più esplosiva della città. Assicurati il tuo posto ora."}
          </p>

          {!bookingMode ? (
            <div className="flex flex-col gap-4">
              <button onClick={() => setBookingMode('single')} className="w-full bg-[#FFEE00] text-black font-black p-4 text-lg flex items-center justify-center gap-2 uppercase active:scale-95 transition-transform">
                <Ticket size={24} /> INGRESSO SINGOLO IN LISTA
              </button>
              <button onClick={() => setBookingMode('prive')} className="w-full bg-transparent border-2 border-[#FFEE00] text-[#FFEE00] font-black p-4 text-lg flex items-center justify-center gap-2 uppercase active:scale-95 transition-transform">
                <Crown size={24} /> PRENOTA TAVOLO PRIVÉ
              </button>
            </div>
          ) : !ticketId ? (
            <div className="bg-zinc-900 p-6 border-2 border-zinc-700 animate-in slide-in-from-bottom-4">
              <h3 className="font-black text-xl mb-4 text-[#FFEE00] uppercase">
                {bookingMode === 'single' ? 'Dati Ingresso Lista' : 'Configura Privé'}
              </h3>
              
              <input type="text" placeholder="Nome e Cognome della prenotazione" className="w-full p-4 bg-black border border-zinc-700 text-white font-bold uppercase mb-6 focus:border-[#FFEE00] outline-none" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

              {bookingMode === 'prive' && (
                <div className="mb-6">
                  <p className="text-xs font-black text-zinc-500 uppercase mb-2">Numero Persone al Tavolo</p>
                  <div className="flex items-center justify-between bg-black border border-zinc-700 p-2">
                    <button onClick={() => setPriveGuests(Math.max(1, priveGuests - 1))} className="p-3 bg-zinc-800 text-white active:bg-zinc-700"><Minus size={20}/></button>
                    <span className="font-black text-2xl">{priveGuests}</span>
                    <button onClick={() => setPriveGuests(priveGuests + 1)} className="p-3 bg-zinc-800 text-white active:bg-zinc-700"><Plus size={20}/></button>
                  </div>
                  
                  <div className="mt-4 p-4 bg-zinc-800 border-l-4 border-[#FFEE00]">
                    <p className="text-xs font-bold uppercase text-zinc-400">Totale Acconto Richiesto</p>
                    <p className="text-3xl font-black italic text-[#FFEE00]">€{priveGuests * PRIVE_ADVANCE_FEE}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase">Pagamento sicuro tramite Stripe/Apple Pay</p>
                  </div>
                </div>
              )}

              <button onClick={bookingMode === 'single' ? handleGeneratePass : handleBookPrive} disabled={loading} className="w-full bg-[#FFEE00] text-black font-black p-4 text-xl uppercase active:scale-95 transition-transform">
                {loading ? 'ELABORAZIONE...' : bookingMode === 'single' ? 'GENERA PASS ORA' : 'PAGA ACCONTO ORA'}
              </button>
            </div>
          ) : (
            <div className="bg-white text-black p-6 flex flex-col items-center text-center animate-in zoom-in-95 shadow-[15px_15px_0px_#FFEE00]">
              <h3 className="font-black text-3xl italic uppercase leading-tight mb-2">
                {bookingMode === 'single' ? 'PASS GENERATO!' : 'TAVOLO CONFERMATO!'}
              </h3>
              <p className="font-bold text-sm mb-6 uppercase">
                {customerName} <br/>
                {bookingMode === 'prive' && `Tavolo per ${priveGuests} persone`}
              </p>
              
              <QRCodeCanvas value={ticketId} size={250} />
              
              <div className="mt-6 bg-black text-white px-6 py-2 font-black text-2xl tracking-[0.2em]">
                {ticketId}
              </div>
              <p className="mt-2 text-black font-bold text-[10px] opacity-40 italic">PR: {prRef}</p>

              <div className="mt-10 flex flex-col items-center">
                <p className="text-black font-black text-xs mb-3 underline decoration-[#FFEE00] decoration-4 text-center">TENTA LA FORTUNA:</p>
                <ScratchCard key={ticketId} />
              </div>

              <button onClick={resetView} className="mt-8 font-black uppercase text-sm border-b-2 border-black pb-1">
                TORNA ALLA HOME E EVENTI
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VISTA LISTA EVENTI ---
  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      
      {/* LOGO GIGANTE NON STICKY (Scompare scrollando verso il basso) */}
      <div className="bg-black pt-10 pb-6 flex justify-center items-center">
        {/* LOGO EASTER EGG (7 CLICK = ADMIN) */}
        <img 
          src="/logo.png" 
          alt="Event Catania" 
          onClick={handleSecretClick}
          className="w-64 md:w-80 h-auto object-contain cursor-pointer select-none drop-shadow-[0_0_20px_rgba(255,238,0,0.15)]" 
        />
      </div>

      {/* BARRA FILTRI STICKY (Resta in alto quando si scrolla) */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex overflow-x-auto no-scrollbar border-b-2 border-zinc-900">
          {['OGGI', 'SETTIMANA', 'MESE', 'TUTTI'].map(tab => (
            <button 
              key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[100px] p-4 text-xs font-black uppercase tracking-widest transition-colors ${
                activeTab === tab ? 'text-[#FFEE00] border-b-4 border-[#FFEE00] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {loading ? (
          <div className="text-center font-black text-[#FFEE00] mt-20 animate-pulse uppercase tracking-widest">Caricamento Eventi...</div>
        ) : getFilteredEvents().length === 0 ? (
          <div className="text-center font-black text-zinc-600 mt-20 uppercase tracking-widest">Nessun evento per questo periodo</div>
        ) : (
          getFilteredEvents().map(ev => (
            <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 active:scale-[0.98] transition-transform cursor-pointer relative">
              
              <div className="h-56 bg-zinc-950 relative flex justify-center items-center">
                {ev.imageUrl ? (
                    <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-contain p-2 opacity-80" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-black text-zinc-700">NO FOTO</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
              </div>

              <div className="p-5 absolute bottom-0 left-0 w-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#FFEE00] text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                    {activeTab === 'TUTTI' ? 'PROSSIMAMENTE' : activeTab}
                  </span>
                </div>
                <h3 className="text-2xl font-black italic uppercase leading-none mb-1 text-white drop-shadow-md">{ev.title}</h3>
                <p className="text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1 drop-shadow-md">
                  <Calendar size={12}/> {new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POPUP PASSAGGIO SEGRETO (ADMIN LOGIN) */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-in zoom-in">
          <div className="bg-zinc-900 border-2 border-[#FFEE00] p-6 w-full max-w-sm">
            <div className="flex justify-center mb-4 text-[#FFEE00]">
              <Lock size={40} />
            </div>
            <h2 className="text-center font-black text-xl italic uppercase tracking-widest text-white mb-6">Accesso Staff</h2>
            <input 
              type="password" 
              placeholder="Inserisci Password" 
              className="w-full p-4 bg-black border border-zinc-700 text-white font-bold mb-4 focus:border-[#FFEE00] text-center tracking-widest outline-none"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
            <button onClick={handleVerifyPassword} className="w-full bg-[#FFEE00] text-black font-black p-4 uppercase transition-transform active:scale-95 shadow-[4px_4px_0px_#FFF] mb-4">
              ENTRA NEL PANNELLO
            </button>
            <button onClick={() => {setShowAdminLogin(false); setAdminPassword('');}} className="w-full text-zinc-500 font-bold text-xs uppercase underline">
              ANNULLA
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;