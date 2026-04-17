import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ShieldCheck, Power, LayoutGrid, Crown, Calendar, ChevronDown, List, Star } from 'lucide-react';

const SuperAdmin = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const evSnap = await getDocs(collection(db, "events"));
      const evData = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(evData.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (e) {
      console.error("Errore fetch:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventSetting = async (eventId, field, currentValue) => {
    try {
      const eventRef = doc(db, "events", eventId);
      // Forza il valore booleano per evitare problemi con campi inesistenti
      const newValue = currentValue === true ? false : true; 
      
      setEvents(events.map(ev => ev.id === eventId ? { ...ev, [field]: newValue } : ev));
      await updateDoc(eventRef, { [field]: newValue });
    } catch (e) {
      alert("Errore durante l'aggiornamento");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#D4AF37] font-black animate-pulse uppercase">
      Inizializzazione Sistema...
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 font-sans uppercase font-black">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-2xl font-black italic flex items-center gap-2 text-red-600">
            <ShieldCheck size={28} /> SUPERADMIN
          </h1>
          <button 
            onClick={() => window.location.href = '/'} 
            className="text-[10px] bg-zinc-900 px-6 py-3 rounded-full border border-zinc-800 hover:bg-red-600 hover:text-white transition-all shadow-lg"
          >
            Esci dal Pannello
          </button>
        </div>

        {!showList ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
            <button 
              onClick={() => setShowList(true)}
              className="group relative flex items-center gap-6 bg-red-600 text-white px-12 py-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 border-b-8 border-red-800"
            >
              <List size={40} className="group-hover:rotate-12 transition-transform" />
              <span className="text-3xl italic tracking-tighter">CONTROLLO EVENTI</span>
              <ChevronDown size={24} className="opacity-50" />
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center justify-between mb-6 px-4">
              <h2 className="text-zinc-500 text-xs tracking-widest italic">GESTIONE SINGOLI EVENTI</h2>
              <button onClick={() => setShowList(false)} className="text-red-500 text-[10px] underline">Chiudi Lista</button>
            </div>

            {events.map(ev => (
              <div key={ev.id} className="bg-zinc-900 border-2 border-zinc-800 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl transition-colors">
                <div className="flex items-center gap-5 flex-1 w-full">
                  <div className="w-14 h-14 bg-black rounded-3xl flex items-center justify-center text-[#D4AF37] border border-zinc-800 shrink-0">
                    <Calendar size={28} />
                  </div>
                  <div className="overflow-hidden text-left">
                    <h3 className="text-xl leading-tight text-white truncate italic">{ev.title}</h3>
                    <p className="text-[10px] text-zinc-500 italic mt-1 tracking-widest">{ev.date}</p>
                  </div>
                </div>

                <div className="flex gap-4 md:gap-8 shrink-0 bg-black/40 p-4 rounded-[2rem] border border-white/5">
                  {/* LISTA QR */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">LISTA QR</span>
                    <button 
                      onClick={() => toggleEventSetting(ev.id, 'isPassDisabled', ev.isPassDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPassDisabled ? 'bg-green-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPassDisabled ? <LayoutGrid size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPassDisabled ? 'text-green-500' : 'text-red-600'}`}>
                      {!ev.isPassDisabled ? 'ATTIVO' : 'SPENTO'}
                    </span>
                  </div>

                  {/* TAVOLI */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">TAVOLI</span>
                    <button 
                      onClick={() => toggleEventSetting(ev.id, 'isPriveDisabled', ev.isPriveDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPriveDisabled ? 'bg-amber-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPriveDisabled ? <Crown size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPriveDisabled ? 'text-amber-500' : 'text-red-600'}`}>
                      {!ev.isPriveDisabled ? 'ATTIVO' : 'SPENTO'}
                    </span>
                  </div>

                  {/* LISTA PR (QUELLO CHE NON SI SPEGNEVA) */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">LISTA PR</span>
                    <button 
                      onClick={() => toggleEventSetting(ev.id, 'isPrListDisabled', ev.isPrListDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPrListDisabled ? 'bg-blue-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPrListDisabled ? <Star size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPrListDisabled ? 'text-blue-500' : 'text-red-600'}`}>
                      {!ev.isPrListDisabled ? 'ATTIVO' : 'SPENTO'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;