import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, setDoc, collection } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Ticket, Users, Scan, Gift, Star } from 'lucide-react';

// --- COMPONENTE GRATITA E VINCI (Custom Canvas) ---
const ScratchCard = ({ onComplete }) => {
  const canvasRef = React.useRef(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#888'; // Colore grigio da grattare
    ctx.fillRect(0, 0, 300, 150);
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('GRATTA QUI', 90, 85);

    const scratch = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      const y = (e.clientY || e.touches[0].clientY) - rect.top;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
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
    <div className="relative w-[300px] h-[150px] bg-yellow-500 flex items-center justify-center rounded-lg overflow-hidden border-4 border-yellow-200">
      <span className="text-2xl font-bold text-black text-center">HAI VINTO UN DRINK! 🍹</span>
      <canvas ref={canvasRef} className="absolute top-0 left-0 cursor-crosshair" width="300" height="150" />
    </div>
  );
};

// --- PAGINA HOME (Utente / Locandina) ---
const Home = () => {
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('ref') || 'generico';
  const [ticketGenerated, setTicketGenerated] = useState(null);

  const generateTicket = async () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const ticketData = { id: newId, prId: prId, used: false, timestamp: new Date() };
    await setDoc(doc(db, "tickets", newId), ticketData);
    setTicketGenerated(newId);
  };

  return (
    <div className="p-6 flex flex-col items-center min-h-screen">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
        <img src="https://images.unsplash.com/photo-1514525253361-bee8a19740c1?w=500" alt="Locandina" className="w-full h-64 object-cover" />
        <div className="p-6 text-center">
          <h1 className="text-3xl font-bold mb-2">GALAXY NIGHT</h1>
          <p className="text-zinc-400 mb-6">Sabato 12 Aprile - Special Guest DJ</p>
          
          {!ticketGenerated ? (
            <button onClick={generateTicket} className="w-full bg-purple-600 hover:bg-purple-700 p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition">
              <Ticket /> GENERA IL TUO QR
            </button>
          ) : (
            <div className="bg-white p-4 rounded-xl inline-block mb-4">
              <QRCodeCanvas value={ticketGenerated} size={200} />
              <p className="text-black text-xs mt-2 font-mono">{ticketGenerated}</p>
            </div>
          )}
        </div>
      </div>
      {ticketGenerated && (
        <div className="mt-8 text-center">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Star className="text-yellow-400"/> Prova la fortuna!</h2>
          <ScratchCard />
        </div>
      )}
    </div>
  );
};

// --- SCANNER (Staff all'ingresso) ---
const Scanner = () => {
  const [message, setMessage] = useState("Inquadra il QR");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    scanner.render(async (decodedText) => {
      const ticketRef = doc(db, "tickets", decodedText);
      const snap = await getDoc(ticketRef);

      if (snap.exists() && !snap.data().used) {
        await updateDoc(ticketRef, { used: true });
        const prRef = doc(db, "prs", snap.data().prId);
        await setDoc(prRef, { count: increment(1) }, { merge: true });
        setMessage("✅ INGRESSO VALIDO! Benvenuto.");
        scanner.clear();
      } else {
        setMessage("❌ QR NON VALIDO O GIÀ USATO");
      }
    });
  }, []);

  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6">SCANNER INGRESSO</h1>
      <div id="reader" className="w-full max-w-sm bg-white rounded-lg"></div>
      <p className="mt-6 text-xl font-bold">{message}</p>
    </div>
  );
};

// --- DASHBOARD PR ---
const PRDashboard = () => {
  const { prId } = useParams();
  const [stats, setStats] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const prRef = doc(db, "prs", prId);
      const snap = await getDoc(prRef);
      if (snap.exists()) setStats(snap.data().count);
    };
    fetchStats();
  }, [prId]);

  return (
    <div className="p-10 text-center">
      <Users size={64} className="mx-auto mb-4 text-blue-400" />
      <h1 className="text-4xl font-bold mb-2">Ciao, {prId}!</h1>
      <p className="text-zinc-400 mb-8">Ecco i tuoi risultati di stasera:</p>
      <div className="text-8xl font-black text-white">{stats}</div>
      <p className="text-xl mt-4 uppercase tracking-widest text-blue-500">Ingressi Totali</p>
      <div className="mt-10 p-4 bg-zinc-900 rounded-lg text-left">
        <p className="text-sm text-zinc-500 mb-2">Il tuo link da condividere:</p>
        <code className="text-xs break-all text-purple-400">
          {window.location.origin}/?ref={prId}
        </code>
      </div>
    </div>
  );
};

// --- APP WRAPPER ---
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