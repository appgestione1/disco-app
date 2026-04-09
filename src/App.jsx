import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Users, Camera, RefreshCw } from 'lucide-react';

// --- COMPONENTE GRATITA E VINCI (High Contrast) ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const [won] = useState(Math.random() < 0.15); // 15% probabilità

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFEE00'; 
    ctx.fillRect(0, 0, 300, 150);
    ctx.font = 'bold 24px Arial';
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
    <div className="relative w-[300px] h-[150px] bg-white flex items-center justify-center rounded-none border-4 border-black overflow-hidden shadow-[10px_10px_0px_#FFEE00]">
      <span className="text-2xl font-black text-black text-center px-4 uppercase italic leading-none">
        {won ? "🍹 HAI VINTO UN DRINK!" : "❌ NON HAI VINTO"}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none" width="300" height="150" />
    </div>
  );
};

// --- HOME (CLIENTE / GENERAZIONE QR) ---
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
    } catch (e) { alert("Errore: controlla la connessione."); }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-start pt-10 font-sans">
      <div className="w-full max-w-sm">
        <div className="bg-[#FFEE00] text-black p-2 mb-8 inline-block font-black text-xl uppercase italic tracking-tighter shadow-[5px_5px_0px_#FFF]">
          INGRESSO SERATA
        </div>
        
        {!ticketId ? (
          <div className="flex flex-col gap-6">
            <div className="border-4 border-white p-4">
              <p className="text-4xl font-black uppercase italic leading-none">Mostra il QR all'ingresso</p>
            </div>
            <button 
              onClick={generateTicket} 
              disabled={isGenerating}
              className="w-full bg-white text-black py-10 font-black text-4xl uppercase shadow-[10px_10px_0px_#FFEE00] active:translate-y-2 active:shadow-none transition-all"
            >
              {isGenerating ? "..." : "PRENDI QR"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center bg-white p-6 shadow-[10px_10px_0px_#FFEE00] animate-in zoom-in duration-300">
            <QRCodeCanvas value={ticketId} size={250} />
            <div className="mt-6 bg-black text-white px-4 py-2 font-black text-2xl tracking-widest uppercase italic">
              ID: {ticketId}
            </div>
            <p className="mt-2 text-black font-bold uppercase text-xs opacity-40">PR: {prId}</p>
            <div className="mt-10 flex flex-col items-center">
              <p className="text-black font-black uppercase text-sm mb-4 tracking-tighter underline decoration-[#FFEE00] decoration-4">Tenta la fortuna per un drink:</p>
              <ScratchCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SCANNER (STAFF / VERIFICA) ---
const Scanner = () => {
  const [status, setStatus] = useState("PRONTO");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCode = useRef(null);

  const startScanner = async () => {
    setCameraActive(true);
  };

  useEffect(() => {
    if (cameraActive && !html5QrCode.current) {
      const scanner = new Html5Qrcode("reader");
      html5QrCode.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText)
      ).catch(err => {
        alert("Errore camera: controlla i permessi.");
        setCameraActive(false);
      });
    }

    return () => {
      if (html5QrCode.current) {
        html5QrCode.current.stop().catch(() => {});
      }
    };
  }, [cameraActive]);

  const handleScan = async (code) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatus("VERIFICA...");

    try {
      const ticketRef = doc(db, "tickets", code);
      const snap = await getDoc(ticketRef);

      if (snap.exists() && snap.data().used === false) {
        await updateDoc(ticketRef, { used: true });
        const prRef = doc(db, "prs", snap.data().prId);
        await setDoc(prRef, { count: increment(1) }, { merge: true });
        setStatus("✅ OK - ENTRA");
      } else {
        setStatus("❌ GIÀ USATO");
      }
    } catch (e) {
      setStatus("❌ ERRORE");
    }

    setTimeout(() => {
      setStatus("PRONTO");
      setIsProcessing(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
      <div className="bg-white text-black font-black px-6 py-2 text-2xl uppercase italic mb-10 shadow-[5px_5px_0px_#FFEE00]">
        Scanner Staff
      </div>

      {!cameraActive ? (
        <button 
          onClick={startScanner} 
          className="bg-[#FFEE00] text-black p-12 font-black text-2xl flex flex-col items-center gap-4 shadow-[10px_10px_0px_#FFF]"
        >
          <Camera size={64} /> ATTIVA CAMERA
        </button>
      ) : (
        <div className="w-full max-w-sm border-8 border-white bg-black relative">
          <div id="reader" style={{ width: '100%' }}></div>
          {isProcessing && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center font-black text-2xl">
              ATTENDI...
            </div>
          )}
        </div>
      )}

      <div className={`mt-10 p-10 w-full max-w-sm text-center font-black text-4xl shadow-[10px_10px_0px_#FFF] transition-all
        ${status.includes('OK') ? 'bg-green-600' : status.includes('❌') ? 'bg-red-600' : 'bg-zinc-900'}`}>
        {status}
      </div>

      <button onClick={() => window.location.reload()} className="mt-8 text-zinc-600 uppercase text-[10px] font-black tracking-widest flex items-center gap-2">
        <RefreshCw size={12}/> Reset Pagina
      </button>
    </div>
  );
};

// --- DASHBOARD PR ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const snap = await getDoc(doc(db, "prs", prId));
      if (snap.exists()) setCount(snap.data().count);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, [prId]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="bg-white text-black p-10 text-center w-full max-w-sm shadow-[20px_20px_0px_#FFEE00] border-4 border-black">
        <h1 className="text-xl font-black uppercase tracking-tighter border-b-8 border-black pb-2 mb-6 italic">PR: {prId}</h1>
        <div className="text-[12rem] font-black leading-none tracking-tighter">{count}</div>
        <p className="text-2xl font-black uppercase mt-4">Ingressi</p>
      </div>
    </div>
  );
};

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