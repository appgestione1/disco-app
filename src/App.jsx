import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Ticket, Users, Scan, Star, Camera } from 'lucide-react';

// --- COMPONENTE GRATITA E VINCI ---
const ScratchCard = () => {
  const canvasRef = useRef(null);
  const [won] = useState(Math.random() < 0.2); // 20% di probabilità di vincita

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#444'; 
    ctx.fillRect(0, 0, 300, 150);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText('GRATTA QUI PER IL DRINK', 30, 85);

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
    <div className="relative w-[300px] h-[150px] bg-zinc-800 flex items-center justify-center rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-xl">
      <span className="text-xl font-black text-center text-white px-4">
        {won ? "🍹 HAI VINTO UN DRINK! MOSTRA AL BAR" : "😢 QUASI! RIPROVA DOMANI"}
      </span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair touch-none" width="300" height="150" />
    </div>
  );
};

// --- HOME / LOCANDINA ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('ref') || 'Generico';
  const [ticketId, setTicketId] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateTicket = async () => {
    setLoading(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    try {
      await setDoc(doc(db, "tickets", newId), {
        id: newId, prId, used: false, timestamp: new Date()
      });
      setTicketId(newId);
    } catch (e) { alert("Errore connessione: " + e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-md border-2 border-zinc-800 rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl">
        <img src="https://images.unsplash.com/photo-1514525253361-bee8a19740c1?w=800" className="w-full h-72 object-cover grayscale-[0.5]" alt="Event" />
        <div className="p-8 text-center">
          <h1 className="text-5xl font-black italic tracking-tighter mb-2">GALAXY NIGHT</h1>
          <p className="text-yellow-400 font-bold tracking-widest uppercase text-sm mb-6">Sabato 12 Aprile • Special Edition</p>
          
          {!ticketId ? (
            <button 
              onClick={generateTicket} 
              disabled={loading}
              className="w-full bg-white text-black py-5 rounded-2xl font-black text-xl hover:bg-yellow-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              {loading ? "CARICAMENTO..." : "OTTIENI QR INGRESSO"}
            </button>
          ) : (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
              <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <QRCodeCanvas value={ticketId} size={220} bgColor="#FFFFFF" fgColor="#000000" level="H" />
              </div>
              <p className="mt-4 font-mono text-zinc-400 text-lg tracking-[0.3em]">ID: {ticketId}</p>
              <div className="mt-8">
                <p className="text-sm font-bold text-yellow-400 mb-4 uppercase">Grattando puoi vincere un drink:</p>
                <ScratchCard />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-8 text-zinc-600 text-xs font-bold uppercase tracking-widest">PR Ref: {prId}</p>
    </div>
  );
};

// --- SCANNER ---
const Scanner = () => {
  const [status, setStatus] = useState("In attesa...");
  const [scannerActive, setScannerActive] = useState(false);

  const startScanner = () => {
    setScannerActive(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 15, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      });
      scanner.render(async (decodedText) => {
        setStatus("Verifica in corso...");
        try {
          const ticketRef = doc(db, "tickets", decodedText);
          const snap = await getDoc(ticketRef);
          if (snap.exists() && !snap.data().used) {
            await updateDoc(ticketRef, { used: true });
            const prRef = doc(db, "prs", snap.data().prId);
            await setDoc(prRef, { count: increment(1) }, { merge: true });
            setStatus("✅ OK! INGRESSO VALIDO");
            alert("INGRESSO CONFERMATO!");
          } else {
            setStatus("❌ ERRORE: GIÀ USATO O NON VALIDO");
          }
        } catch (e) { setStatus("Errore database"); }
      }, (err) => {});
    }, 100);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-black mb-8 italic">SCANNER PORTA</h1>
      
      {!scannerActive ? (
        <button 
          onClick={startScanner}
          className="bg-zinc-800 border-2 border-white p-10 rounded-3xl flex flex-col items-center gap-4 active:scale-95"
        >
          <Camera size={48} />
          <span className="font-bold">ATTIVA FOTOCAMERA</span>
        </button>
      ) : (
        <div className="w-full max-w-sm rounded-3xl overflow-hidden border-4 border-zinc-800 shadow-2xl bg-zinc-900">
          <div id="reader"></div>
        </div>
      )}
      
      <div className={`mt-10 p-6 rounded-2xl w-full max-w-sm text-center font-black text-xl border-2 ${status.includes('✅') ? 'bg-green-600 border-green-400' : 'bg-zinc-900 border-zinc-700'}`}>
        {status}
      </div>
    </div>
  );
};

// --- PR DASHBOARD ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, "prs", prId));
      if (snap.exists()) setCount(snap.data().count);
    };
    fetch();
    const interval = setInterval(fetch, 5000); // Aggiorna ogni 5 secondi
    return () => clearInterval(interval);
  }, [prId]);

  return (
    <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-center">
      <div className="border-4 border-white p-12 rounded-[3rem] text-center shadow-[0_0_50px_rgba(255,255,255,0.1)]">
        <Users size={48} className="mx-auto mb-6 text-zinc-500" />
        <h1 className="text-2xl font-bold uppercase tracking-tighter text-zinc-400">PR: {prId}</h1>
        <div className="text-[10rem] font-black leading-none my-4 tracking-tighter">{count}</div>
        <p className="text-xl font-bold text-yellow-400 uppercase tracking-[0.2em]">Ingressi Verificati</p>
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