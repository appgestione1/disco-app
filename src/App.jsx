import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Users, Camera, CheckCircle, XCircle } from 'lucide-react';

// --- COMPONENTE GRATITA E VINCI (Contrastato) ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const [won] = useState(Math.random() < 0.2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFEE00'; // Giallo acceso
    ctx.fillRect(0, 0, 300, 150);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText('GRATTA QUI', 95, 80);

    const scratch = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
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
    <div className="relative w-[300px] h-[150px] bg-white flex items-center justify-center rounded-lg border-4 border-white overflow-hidden shadow-xl">
      <span className="text-xl font-black text-black text-center px-4 uppercase italic">
        {won ? "🍹 VINTO DRINK!" : "❌ NON VINTO"}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none" width="300" height="150" />
    </div>
  );
};

// --- HOME (MASSIMO CONTRASTO) ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('ref') || 'Generico';
  const [ticketId, setTicketId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTicket = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    try {
      await setDoc(doc(db, "tickets", newId), {
        id: newId, prId, used: false, timestamp: new Date()
      });
      setTicketId(newId);
    } catch (e) { alert("Errore connessione."); }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-sm mt-10">
        {!ticketId ? (
          <div className="text-center">
            <div className="bg-white text-black p-4 mb-10 inline-block font-black text-2xl uppercase italic skew-x-[-10deg]">
              INGRESSO DISCO
            </div>
            <button 
              onClick={generateTicket} 
              className="w-full bg-[#FFEE00] text-black py-8 rounded-none font-black text-3xl uppercase shadow-[10px_10px_0px_#FFF]"
            >
              {isGenerating ? "ATTENDI..." : "PRENDI QR"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center bg-white p-6 rounded-none shadow-[10px_10px_0px_#FFEE00]">
            <QRCodeCanvas value={ticketId} size={250} />
            <p className="mt-4 font-black text-black text-2xl tracking-tighter">ID: {ticketId}</p>
            <p className="mt-2 text-black font-bold uppercase text-xs opacity-50">PR: {prId}</p>
            <div className="mt-8">
              <ScratchCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SCANNER (CAMERA POSTERIORE FORZATA + BLOCCO DOPPIO CLICK) ---
const Scanner = () => {
  const [status, setStatus] = useState("PRONTO");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const html5QrCode = useRef(null);

  const startCamera = async () => {
    setScannerStarted(true);
    html5QrCode.current = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
      await html5QrCode.current.start(
        { facingMode: "environment" }, // Forza camera posteriore
        config,
        async (decodedText) => {
          handleScan(decodedText);
        }
      );
    } catch (err) {
      alert("Errore fotocamera: assicurati di aver dato i permessi.");
    }
  };

  const handleScan = async (code) => {
    if (isProcessing) return; // Blocco se sta già lavorando
    setIsProcessing(true);
    setStatus("VERIFICA...");

    try {
      const ticketRef = doc(db, "tickets", code);
      const snap = await getDoc(ticketRef);

      if (snap.exists() && snap.data().used === false) {
        // Segna come usato SUBITO nel DB
        await updateDoc(ticketRef, { used: true });
        
        // Incrementa PR
        const prRef = doc(db, "prs", snap.data().prId);
        await setDoc(prRef, { count: increment(1) }, { merge: true });

        setStatus("✅ OK - ENTRA");
      } else {
        setStatus("❌ GIÀ USATO / INVALIDO");
      }
    } catch (e) {
      setStatus("❌ ERRORE");
    }

    // Reset automatico dopo 3 secondi
    setTimeout(() => {
      setStatus("PRONTO");
      setIsProcessing(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-2xl font-black mb-10 italic uppercase tracking-tighter bg-white text-black px-4 py-2">Scanner Porta</h1>
      
      {!scannerStarted ? (
        <button onClick={startCamera} className="bg-[#FFEE00] text-black p-10 font-black text-xl flex items-center gap-4">
          <Camera size={32} /> ATTIVA SCANNER
        </button>
      ) : (
        <div className="w-full max-w-sm border-8 border-white bg-white">
          <div id="reader" style={{ width: '100%' }}></div>
        </div>
      )}
      
      <div className={`mt-10 p-10 w-full max-w-sm text-center font-black text-4xl shadow-[10px_10px_0px_#FFF] 
        ${status.includes('OK') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} 
        ${status === 'PRONTO' ? 'bg-zinc-900 text-white' : ''}
        ${status === 'VERIFICA...' ? 'bg-white text-black animate-pulse' : ''}`}>
        {status}
      </div>
    </div>
  );
};

// --- DASHBOARD PR ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, "prs", prId));
      if (snap.exists()) setCount(snap.data().count);
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, [prId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="bg-white text-black p-10 text-center w-full max-w-sm shadow-[15px_15px_0px_#FFEE00]">
        <h1 className="text-xl font-black uppercase tracking-widest border-b-4 border-black pb-4 mb-6">PR: {prId}</h1>
        <div className="text-9xl font-black leading-none">{count}</div>
        <p className="text-xl font-bold uppercase mt-6 italic">Ingressi Verificati</p>
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