import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, Power } from 'lucide-react';

// --- COMPONENTE GRATITA E VINCI ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const [won] = useState(Math.random() < 0.15);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFEE00'; 
    ctx.fillRect(0, 0, 300, 150);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText('GRATTA QUI', 150, 85);

    const scratch = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    };

    canvas.addEventListener('mousemove', scratch);
    canvas.addEventListener('touchmove', scratch);
    return () => {
      canvas.removeEventListener('mousemove', scratch);
      canvas.removeEventListener('touchmove', scratch);
    };
  }, []);

  return (
    <div className="relative w-[300px] h-[150px] bg-white flex items-center justify-center border-4 border-black overflow-hidden shadow-[8px_8px_0px_#FFEE00]">
      <span className="text-xl font-black text-black text-center px-4 uppercase italic leading-tight">
        {won ? "🍹 HAI VINTO UN DRINK!" : "❌ NON HAI VINTO"}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none" width="300" height="150" />
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
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center pt-10 font-sans uppercase">
      <div className="w-full max-w-sm">
        <div className="bg-[#FFEE00] text-black p-2 mb-8 inline-block font-black text-xl italic shadow-[4px_4px_0px_#FFF]">
          PASS INGRESSO
        </div>
        
        {!ticketId ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-5xl font-black leading-none italic tracking-tighter">PRENDI IL QR</h2>
            <button 
              onClick={generateTicket} 
              className="w-full bg-white text-black py-10 font-black text-4xl shadow-[10px_10px_0px_#FFEE00] active:translate-y-1 transition-all"
            >
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
              <p className="text-black font-black text-xs mb-3 underline decoration-[#FFEE00] decoration-4">GRATTA PER UN DRINK:</p>
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
  const [uiProcessing, setUiProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Riferimenti per evitare il problema della memoria di React
  const isProcessingRef = useRef(false);
  const html5QrCode = useRef(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      if (html5QrCode.current) {
        await html5QrCode.current.stop();
        html5QrCode.current = null;
      }
      setCameraActive(false);
      setStatus("SPENTO");
    } else {
      setCameraActive(true);
      setStatus("PRONTO");
    }
  };

  useEffect(() => {
    if (cameraActive && !html5QrCode.current) {
      const scanner = new Html5Qrcode("reader");
      html5QrCode.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Se NON stiamo processando, allora procedi
          if (!isProcessingRef.current) {
            handleScan(decodedText);
          }
        }
      ).catch(() => setCameraActive(false));
    }
    return () => { if (html5QrCode.current) html5QrCode.current.stop().catch(() => {}); };
  }, [cameraActive]);

  const handleScan = async (code) => {
    isProcessingRef.current = true; // Blocco immediato (no-stop safety)
    setUiProcessing(true);
    playBeep();
    setStatus("VERIFICA...");

    try {
      const ticketRef = doc(db, "tickets", code);
      const snap = await getDoc(ticketRef);

      if (snap.exists() && snap.data().used === false) {
        await updateDoc(ticketRef, { used: true });
        const prRef = doc(db, "prs", snap.data().prId);
        await setDoc(prRef, { count: increment(1) }, { merge: true });
        setStatus("✅ OK");
      } else {
        setStatus("❌ USATO");
      }
    } catch (e) { setStatus("❌ ERRORE"); }

    // COOLDOWN DI 2 SECONDI
    setTimeout(() => {
      setStatus("PRONTO");
      setUiProcessing(false);
      isProcessingRef.current = false; // Torna vigile
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center uppercase">
      <div className="w-full max-w-sm flex justify-between items-center mb-6 bg-zinc-900 p-4 border-b-4 border-[#FFEE00]">
        <span className="font-black italic text-xl tracking-tighter">Scanner Porta</span>
        <button 
          onClick={toggleCamera} 
          className={`p-2 transition-all ${cameraActive ? 'bg-red-600' : 'bg-[#FFEE00] text-black'}`}
        >
          <Power size={24} />
        </button>
      </div>

      <div className="w-full max-w-sm relative aspect-square border-8 border-white bg-zinc-900 overflow-hidden">
        <div id="reader" className="w-full h-full"></div>
        
        {/* OVERLAY SEMAFORO */}
        {uiProcessing && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-[100]
            ${status.includes('OK') ? 'bg-green-600' : 'bg-red-600'}`}>
            <div className="text-9xl mb-4">{status.includes('OK') ? '✅' : '❌'}</div>
            <div className="font-black text-4xl italic tracking-tighter">{status}</div>
          </div>
        )}
        
        {!cameraActive && !uiProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
            <Camera size={48} className="text-zinc-700 mb-4" />
            <p className="text-zinc-700 font-black text-xs">Camera Spenta</p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-sm p-6 bg-zinc-900 border-2 border-zinc-800 text-center">
        <p className="text-zinc-500 font-bold text-[10px] mb-1 tracking-widest">Stato</p>
        <p className={`text-3xl font-black italic ${uiProcessing ? 'text-[#FFEE00]' : 'text-white'}`}>
          {status}
        </p>
      </div>
    </div>
  );
};

// --- PR DASHBOARD ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const snap = await getDoc(doc(db, "prs", prId));
      if (snap.exists()) setCount(snap.data().count);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [prId]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center uppercase">
      <div className="bg-white text-black p-10 w-full max-w-sm shadow-[20px_20px_0px_#FFEE00] border-8 border-black">
        <h1 className="text-xl font-black italic border-b-4 border-black pb-2 mb-8">PR: {prId}</h1>
        <div className="text-[12rem] font-black leading-none tracking-tighter mb-4">{count}</div>
        <p className="text-2xl font-black italic opacity-30">Ingressi</p>
      </div>
    </div>
  );
};

// --- ROUTER ---
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/pr/:prId" element={<PRDashboard />} />
      </Routes>
    </Router>
  );
}