import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Power, Trash2 } from 'lucide-react';
import Admin from './Admin'; // Assicurati che Admin.jsx esista con la 'A' maiuscola

// --- COMPONENTE GRATITA E VINCI (Versione Blindata per Online) ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false); // Stato per il disegno (mouse o touch)
  const [won] = useState(Math.random() < 0.15); // 15% probabilità di vincita

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Dimensioni fisse del canvas
    const width = 300;
    const height = 150;

    // Disegna lo strato grattabile giallo fluo
    ctx.fillStyle = '#FFEE00'; 
    ctx.fillRect(0, 0, width, height);
    
    // Aggiungi il testo "GRATTA QUI"
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GRATTA QUI', width / 2, height / 2);

    // Funzione per ottenere la posizione corretta (mouse o touch)
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    // Funzione principale che cancella il giallo (gratta)
    const scratch = (e) => {
      if (!isDrawingRef.current && e.type !== 'mousemove') return; // Gratta solo se premuto (o mousemove per desktop)
      
      // BLOCCA LO SCROLL DEL TELEFONO MENTRE GRATTI
      if (e.type === 'touchmove') {
        if (e.cancelable) e.preventDefault();
      }
      
      const { x, y } = getPos(e);
      ctx.globalCompositeOperation = 'destination-out'; // Modalità cancellazione
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2); // Cerchio di cancellazione
      ctx.fill();
    };

    // --- Gestione Eventi MOUSE (Desktop) ---
    const handleMouseDown = (e) => { isDrawingRef.current = true; scratch(e); };
    const handleMouseMove = (e) => { if (isDrawingRef.current) scratch(e); };
    const handleMouseUp = () => { isDrawingRef.current = false; };

    // --- Gestione Eventi TOUCH (Mobile) ---
    const handleTouchStart = (e) => { isDrawingRef.current = true; scratch(e); };
    const handleTouchMove = (e) => { scratch(e); }; // scratch gestisce già preventDefault
    const handleTouchEnd = () => { isDrawingRef.current = false; };

    // Aggiungiamo i listener al canvas
    // Desktop
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp); // Mouseup sulla finestra per sicurezza

    // Mobile (passive: false è fondamentale per bloccare lo scroll)
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // Pulizia dei listener quando il componente viene rimosso
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    // touch-none impedisce al browser di gestire i tocchi (scroll, zoom) su questo div
    <div className="relative w-[300px] h-[150px] bg-white flex items-center justify-center border-4 border-black overflow-hidden shadow-[8px_8px_0px_#FFEE00] touch-none">
      {/* Testo sotto il gratta e vinci (risultato) */}
      <span className="text-2xl font-black text-black text-center px-4 uppercase italic leading-none z-0">
        {won ? "🍹 VINTO DRINK!" : "❌ NON VINTO"}
      </span>
      {/* Il Canvas giallo sopra */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 cursor-crosshair z-10 touch-none" 
        width="300" 
        height="150" 
      />
    </div>
  );
};

// --- HOME (LATO CLIENTE) ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('ref') || 'Generico';
  const [ticketId, setTicketId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTicket = async () => {
    if (isGenerating || ticketId) return;
    setIsGenerating(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    try {
      await setDoc(doc(db, "tickets", newId), {
        id: newId, prId, used: false, timestamp: new Date()
      });
      setTicketId(newId);
    } catch (e) { alert("Errore database."); }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center pt-10 uppercase font-sans">
      <div className="w-full max-w-sm">
        <div className="bg-[#FFEE00] text-black p-2 mb-8 inline-block font-black text-xl italic shadow-[4px_4px_0px_#FFF]">
          PASS INGRESSO
        </div>
        
        {!ticketId ? (
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-5xl font-black leading-none italic tracking-tighter text-left">OTTIENI IL TUO QR</h2>
            <button onClick={generateTicket} className="w-full bg-white text-black py-10 font-black text-4xl shadow-[10px_10px_0px_#FFEE00] active:scale-95 transition-transform">
              {isGenerating ? "..." : "GENERA"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center bg-white p-6 shadow-[15px_15px_0px_#FFEE00]">
            <QRCodeCanvas value={ticketId} size={250} />
            <div className="mt-6 bg-black text-white px-6 py-2 font-black text-2xl tracking-[0.2em]">
              {ticketId}
            </div>
            <p className="mt-2 text-black font-bold text-[10px] opacity-40 italic">PR: {prId}</p>
            <div className="mt-10 flex flex-col items-center">
              <p className="text-black font-black text-xs mb-3 underline decoration-[#FFEE00] decoration-4">TENTA LA FORTUNA:</p>
              {/* --- CHIAMATA CORRETTA (S Maiuscola) --- */}
              <ScratchCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SCANNER (LATO STAFF - NO STOP) ---
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
        await updateDoc(ticketRef, { used: true });
        const prRef = doc(db, "prs", snap.data().prId);
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
        <span className="font-black italic text-xl">Scanner Porta</span>
        <button onClick={toggleCamera} className={`p-2 border-2 border-white ${cameraActive ? 'bg-red-600' : 'bg-[#FFEE00] text-black'}`}>
          <Power size={24} />
        </button>
      </div>

      <div className="w-full max-w-sm relative aspect-square border-8 border-white bg-zinc-900 overflow-hidden">
        <div id="reader" className="w-full h-full"></div>
        {overlayColor && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-[100] ${overlayColor} animate-in fade-in`}>
            <div className="text-9xl mb-4 drop-shadow-lg">{status.includes('OK') ? '✅' : '❌'}</div>
            <div className="font-black text-6xl italic drop-shadow-md">{status}</div>
          </div>
        )}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
            <Camera size={48} className="text-zinc-700 mb-4 opacity-30" />
            <p className="text-zinc-700 font-black text-xs opacity-30 tracking-widest">Camera Spenta</p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-sm p-6 bg-zinc-900 border-2 border-zinc-800 text-center shadow-[6px_6px_0px_#111]">
        <p className="text-zinc-500 font-bold text-[10px] mb-1 tracking-widest uppercase">Stato Sensore</p>
        <p className={`text-3xl font-black italic ${overlayColor ? 'text-white' : 'text-[#FFEE00]'}`}>{status}</p>
      </div>
    </div>
  );
};

// --- PR DASHBOARD ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [count, setCount] = useState(0);

  const fetchStats = async () => {
    const snap = await getDoc(doc(db, "prs", prId));
    if (snap.exists()) setCount(snap.data().count);
    else setCount(0);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [prId]);

  const handleReset = async () => {
    if (window.confirm("Vuoi azzerare gli ingressi di stasera?")) {
      await setDoc(doc(db, "prs", prId), { count: 0 }, { merge: true });
      setCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center uppercase font-sans">
      <div className="bg-white text-black p-10 w-full max-w-sm shadow-[20px_20px_0px_#FFEE00] border-8 border-black">
        <h1 className="text-xl font-black italic border-b-4 border-black pb-2 mb-8 uppercase">PR: {prId}</h1>
        <div className="text-[12rem] font-black leading-none tracking-tighter mb-4">{count}</div>
        <p className="text-2xl font-black italic opacity-30 tracking-widest">Ingressi</p>
      </div>
      <button onClick={handleReset} className="mt-12 bg-red-600 text-white px-8 py-4 font-black flex items-center gap-3 shadow-[8px_8px_0px_#FFF] active:scale-95">
        <Trash2 size={24} /> AZZERA CONTEGGIO
      </button>
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
      </Routes>
    </Router>
  );
}