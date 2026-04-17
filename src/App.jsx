import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { 
  doc, getDoc, updateDoc, increment, setDoc, 
  collection, getDocs, onSnapshot, query, where 
} from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Power, Trash2, ChevronLeft, Calendar, BarChart3, Users, List, Crown, Calculator } from 'lucide-react';
import Admin from './Admin'; 
import Home from './Home'; 
import SuperAdmin from './SuperAdmin';

// --- SCANNER (LATO STAFF) ---
const Scanner = () => {
  const [status, setStatus] = useState("PRONTO");
  const [overlayColor, setOverlayColor] = useState(""); 
  const [cameraActive, setCameraActive] = useState(false);
  
  const isProcessingRef = useRef(false);
  const html5QrCodeRef = useRef(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      setCameraActive(false);
      setStatus("SPENTO");
    } else {
      setCameraActive(true);
      setStatus("PRONTO");
    }
  };

  useEffect(() => {
    if (cameraActive && !html5QrCodeRef.current) {
      const scanner = new Html5Qrcode("reader");
      html5QrCodeRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 250, height: 250 } },
        (decodedText) => { if (!isProcessingRef.current) handleScan(decodedText); }
      ).catch(() => setCameraActive(false));
    }
    return () => { if (html5QrCodeRef.current) html5QrCodeRef.current.stop().catch(() => {}); };
  }, [cameraActive]);

  const handleScan = async (code) => {
    isProcessingRef.current = true;
    playBeep();
    setStatus("VERIFICA...");

    try {
      const ticketRef = doc(db, "tickets", code);
      const snap = await getDoc(ticketRef);

      if (snap.exists() && snap.data().used === false) {
        const ticketData = snap.data();
        await updateDoc(ticketRef, { used: true });
        
        const prRef = doc(db, "prs", ticketData.prId);
        await setDoc(prRef, { count: increment(1) }, { merge: true });
        
        setOverlayColor("bg-green-600");
        setStatus("✅ OK");
      } else {
        setOverlayColor("bg-red-600");
        setStatus("❌ USATO");
      }
    } catch (e) { setStatus("❌ ERRORE"); }

    setTimeout(() => {
      setOverlayColor("");
      setStatus("PRONTO");
      isProcessingRef.current = false;
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center uppercase font-sans">
      <div className="w-full max-w-sm flex justify-between items-center mb-6 bg-zinc-900 p-4 border-b-4 border-[#FFEE00]">
        <span className="font-black italic text-xl text-white">Scanner Porta</span>
        <button onClick={toggleCamera} className={`p-2 border-2 border-white ${cameraActive ? 'bg-red-600' : 'bg-[#FFEE00] text-black'}`}>
          <Power size={24} />
        </button>
      </div>

      <div className="w-full max-w-sm relative aspect-square border-8 border-white bg-zinc-900 overflow-hidden">
        <div id="reader" className="w-full h-full"></div>
        {overlayColor && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-[100] ${overlayColor} animate-in fade-in`}>
            <div className="text-9xl mb-4 drop-shadow-lg">{status.includes('OK') ? '✅' : '❌'}</div>
            <div className="font-black text-6xl italic drop-shadow-md text-white">{status}</div>
          </div>
        )}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
            <Camera size={48} className="text-zinc-700 mb-4 opacity-30" />
            <p className="text-zinc-700 font-black text-xs opacity-30 tracking-widest">Camera Spenta</p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-sm p-6 bg-zinc-900 border-2 border-zinc-800 text-center shadow-[6px_6px_0_#111]">
        <p className="text-zinc-500 font-bold text-[10px] mb-1 tracking-widest uppercase">Stato Sensore</p>
        <p className={`text-3xl font-black italic ${overlayColor ? 'text-white' : 'text-[#FFEE00]'}`}>{status}</p>
      </div>
    </div>
  );
};

// --- PR DASHBOARD ---
const PRDashboard = () => {
  const { prId } = useParams();
  const navigate = useNavigate();
  const [prName, setPrName] = useState("");
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Stati per gestire l'apertura delle varie sezioni
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    const fetchPrAndEvents = async () => {
      try {
        const prSnap = await getDoc(doc(db, "prs_registry", prId));
        let validEventIds = [];
        
        if (prSnap.exists()) {
          const prData = prSnap.data();
          setPrName(prData.name || prId);
          validEventIds = (prData.eventIds || []).filter(id => id !== "");
        } else {
          setPrName(prId);
        }

        const evSnap = await getDocs(collection(db, "events"));
        const allEvents = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = allEvents.filter(ev => validEventIds.includes(ev.id));
        setAssignedEvents(filtered);
        
        if (filtered.length > 0) {
          setSelectedEventId(filtered[0].id);
        }
      } catch (e) {
        console.error("Errore fetch:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrAndEvents();
  }, [prId]);

  useEffect(() => {
    if (!selectedEventId) return;
    const q = query(
      collection(db, "tickets"),
      where("prId", "==", prId),
      where("eventId", "==", selectedEventId),
      where("used", "==", true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLiveCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [prId, selectedEventId]);

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-black text-[#D4AF37] uppercase tracking-widest">
      Sincronizzazione Dashboard...
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans uppercase font-black">
      {/* HEADER */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-950/50 sticky top-0 z-50 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-white">
          <ChevronLeft size={24}/>
        </button>
        <div className="text-center">
          <p className="text-[10px] text-[#D4AF37] tracking-[0.3em] font-bold">LA PAGINA DI</p>
          <h1 className="text-2xl italic tracking-tighter text-white font-extrabold mt-1">
            {prName}
          </h1>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="p-6 max-w-md mx-auto space-y-4">
        
        {/* PULSANTE INGRESSI (Uniformato agli altri) */}
        <button 
          onClick={() => toggleSection('ingressi')}
          className={`w-full p-6 border-2 rounded-[2rem] flex items-center justify-between px-10 transition-all active:scale-95 group ${
            activeSection === 'ingressi' 
            ? 'bg-[#D4AF37] border-black text-black' 
            : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800 shadow-2xl'
          }`}
        >
          <div className="flex items-center gap-6">
            <BarChart3 size={32} className={`${activeSection === 'ingressi' ? 'text-black' : 'text-[#D4AF37]'} group-hover:scale-110 transition-transform`} />
            <span className="text-xl italic tracking-tighter">INGRESSI</span>
          </div>
          <div className={`w-3 h-3 rounded-full animate-pulse ${activeSection === 'ingressi' ? 'bg-black' : 'bg-[#D4AF37]'}`}></div>
        </button>

        {/* AREA INGRESSI (CONTENUTO) */}
        {activeSection === 'ingressi' && (
          <div className="animate-in slide-in-from-top-10 duration-500 space-y-6 pb-4 pt-2">
            {assignedEvents.length > 0 ? (
              <>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] text-zinc-500 tracking-widest ml-2">SELEZIONA SERATA</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4AF37]" size={18} />
                    <select 
                      className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black outline-none appearance-none focus:border-[#D4AF37]"
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                    >
                      {assignedEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-white text-black p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(212,175,55,0.3)] text-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Users size={120}/></div>
                   <p className="text-xs tracking-[0.5em] text-zinc-400 mb-4 font-bold">INGRESSI LIVE</p>
                   <div className="text-[10rem] leading-none font-black italic tracking-tighter mb-2 animate-in zoom-in duration-300" key={liveCount}>
                     {liveCount}
                   </div>
                </div>
              </>
            ) : (
              <div className="bg-zinc-900/50 p-10 rounded-[2rem] border border-white/5 text-center italic text-zinc-500">
                Nessuna serata assegnata.
              </div>
            )}
          </div>
        )}

        {/* PULSANTE CONTEGGI */}
        <button 
          onClick={() => toggleSection('conteggi')}
          className={`w-full p-6 border-2 rounded-[2rem] flex items-center justify-between px-10 transition-all active:scale-95 group ${
            activeSection === 'conteggi' 
            ? 'bg-[#D4AF37] border-black text-black' 
            : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800 shadow-2xl'
          }`}
        >
          <div className="flex items-center gap-6">
            <Calculator size={32} className={`${activeSection === 'conteggi' ? 'text-black' : 'text-[#D4AF37]'} group-hover:scale-110 transition-transform`} />
            <span className="text-xl italic tracking-tighter">CONTEGGI</span>
          </div>
          <div className={`w-3 h-3 rounded-full animate-pulse ${activeSection === 'conteggi' ? 'bg-black' : 'bg-[#D4AF37]'}`}></div>
        </button>

        {/* PULSANTE ELENCO LISTA */}
        <button 
          onClick={() => toggleSection('elenco')}
          className={`w-full p-6 border-2 rounded-[2rem] flex items-center justify-between px-10 transition-all active:scale-95 group ${
            activeSection === 'elenco' 
            ? 'bg-[#D4AF37] border-black text-black' 
            : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800 shadow-2xl'
          }`}
        >
          <div className="flex items-center gap-6">
            <List size={32} className={`${activeSection === 'elenco' ? 'text-black' : 'text-[#D4AF37]'} group-hover:scale-110 transition-transform`} />
            <span className="text-xl italic tracking-tighter">ELENCO LISTA</span>
          </div>
          <div className={`w-3 h-3 rounded-full animate-pulse ${activeSection === 'elenco' ? 'bg-black' : 'bg-[#D4AF37]'}`}></div>
        </button>

        {/* PULSANTE PRIVE' */}
        <button 
          onClick={() => toggleSection('prive')}
          className={`w-full p-6 border-2 rounded-[2rem] flex items-center justify-between px-10 transition-all active:scale-95 group ${
            activeSection === 'prive' 
            ? 'bg-[#D4AF37] border-black text-black' 
            : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800 shadow-2xl'
          }`}
        >
          <div className="flex items-center gap-6">
            <Crown size={32} className={`${activeSection === 'prive' ? 'text-black' : 'text-[#D4AF37]'} group-hover:scale-110 transition-transform`} />
            <span className="text-xl italic tracking-tighter">PRIVE'</span>
          </div>
          <div className={`w-3 h-3 rounded-full animate-pulse ${activeSection === 'prive' ? 'bg-black' : 'bg-[#D4AF37]'}`}></div>
        </button>

      </div>

      <div className="fixed bottom-10 left-0 w-full text-center opacity-20 pointer-events-none">
         <p className="text-[8px] tracking-[0.8em]">SYSTEM CONTROL V2.3</p>
      </div>
    </div>
  );
};

// --- ROUTER GENERALE ---
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/pr/:prId" element={<PRDashboard />} />
        <Route path="/admin-segreto-stefano" element={<Admin />} />
        <Route path="/super-control-room" element={<SuperAdmin />} />
      </Routes>
    </Router>
  );
}