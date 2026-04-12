import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Power, Trash2 } from 'lucide-react';
import Admin from './Admin'; 
import Home from './Home'; // <-- COLLEGAMENTO ALLA NUOVA HOME

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
        <h1 className="text-xl font-black italic border-b-4 border-black pb-2 mb-8 uppercase text-center">PR: {prId}</h1>
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