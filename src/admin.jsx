import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, getDocs, updateDoc, 
  deleteDoc, doc, setDoc, query, orderBy 
} from 'firebase/firestore';
import { 
  Calendar, Users, Gift, Plus, Trash2, 
  Edit3, CheckCircle, XCircle, Share2, Save
} from 'lucide-react';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [prs, setPrs] = useState([]);
  const [sponsors, setSponsors] = useState([]);

  // Form States
  const [eventForm, setEventForm] = useState({ title: '', date: '', imageUrl: '', active: true });
  const [prForm, setPrForm] = useState({ prCode: '', name: '', phone: '' });
  const [sponsorForm, setSponsorForm] = useState({ name: '', logoUrl: '', prize: 'Drink Omaggio', winChance: 0.15 });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    const evSnap = await getDocs(query(collection(db, "events"), orderBy("date", "desc")));
    setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const prSnap = await getDocs(collection(db, "prs_registry"));
    setPrs(prSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const spSnap = await getDocs(collection(db, "sponsors"));
    setSponsors(spSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // --- AZIONI EVENTI ---
  const handleAddEvent = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "events"), eventForm);
    setEventForm({ title: '', date: '', imageUrl: '', active: true });
    fetchData();
  };

  const toggleEventStatus = async (id, currentStatus) => {
    await updateDoc(doc(db, "events", id), { active: !currentStatus });
    fetchData();
  };

  // --- AZIONI PR ---
  const handleAddPr = async (e) => {
    e.preventDefault();
    // Usiamo il codice PR come ID del documento per facilitare la sostituzione
    await setDoc(doc(db, "prs_registry", prForm.prCode), {
      name: prForm.name,
      phone: prForm.phone,
      active: true
    });
    setPrForm({ prCode: '', name: '', phone: '' });
    fetchData();
  };

  // --- AZIONI SPONSOR ---
  const handleAddSponsor = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "sponsors"), sponsorForm);
    setSponsorForm({ name: '', logoUrl: '', prize: 'Drink Omaggio', winChance: 0.15 });
    fetchData();
  };

  const deleteItem = async (coll, id) => {
    if(window.confirm("Sei sicuro di voler eliminare?")) {
      await deleteDoc(doc(db, coll, id));
      fetchData();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans uppercase">
      {/* SIDEBAR MOBILE / HEADER */}
      <div className="bg-black border-b-4 border-[#FFEE00] p-4 flex justify-around sticky top-0 z-50">
        <button onClick={() => setActiveTab('events')} className={`flex flex-col items-center p-2 ${activeTab === 'events' ? 'text-[#FFEE00]' : 'text-zinc-500'}`}>
          <Calendar size={24} /> <span className="text-[10px] font-black mt-1">Eventi</span>
        </button>
        <button onClick={() => setActiveTab('prs')} className={`flex flex-col items-center p-2 ${activeTab === 'prs' ? 'text-[#FFEE00]' : 'text-zinc-500'}`}>
          <Users size={24} /> <span className="text-[10px] font-black mt-1">PR Registry</span>
        </button>
        <button onClick={() => setActiveTab('sponsors')} className={`flex flex-col items-center p-2 ${activeTab === 'sponsors' ? 'text-[#FFEE00]' : 'text-zinc-500'}`}>
          <Gift size={24} /> <span className="text-[10px] font-black mt-1">Sponsor</span>
        </button>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        
        {/* --- SEZIONE EVENTI --- */}
        {activeTab === 'events' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-black italic mb-6 border-l-8 border-[#FFEE00] pl-4">Gestione Serate</h2>
            
            <form onSubmit={handleAddEvent} className="bg-zinc-900 p-6 mb-10 shadow-[10px_10px_0px_#222] border-2 border-zinc-800">
              <div className="grid grid-cols-1 gap-4">
                <input type="text" placeholder="Titolo Serata" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} required />
                <input type="date" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none text-white" 
                  value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} required />
                <input type="text" placeholder="URL Immagine Locandina" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={eventForm.imageUrl} onChange={e => setEventForm({...eventForm, imageUrl: e.target.value})} required />
                <button className="bg-[#FFEE00] text-black font-black py-4 flex items-center justify-center gap-2">
                  <Plus size={20} /> CREA EVENTO
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {events.map(ev => (
                <div key={ev.id} className="bg-zinc-900 border-2 border-zinc-800 p-4 flex justify-between items-center">
                  <div>
                    <p className="font-black text-xl italic">{ev.title}</p>
                    <p className="text-zinc-500 text-xs font-bold">{ev.date} • {ev.active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleEventStatus(ev.id, ev.active)} className="p-2 bg-zinc-800 hover:text-[#FFEE00]">
                      <Power size={20} />
                    </button>
                    <button onClick={() => deleteItem('events', ev.id)} className="p-2 bg-zinc-800 text-red-500">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- SEZIONE PR (Registry) --- */}
        {activeTab === 'prs' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-black italic mb-6 border-l-8 border-[#FFEE00] pl-4">Registro Collaboratori</h2>
            
            <form onSubmit={handleAddPr} className="bg-zinc-900 p-6 mb-10 shadow-[10px_10px_0px_#222] border-2 border-zinc-800">
              <p className="text-[10px] text-zinc-500 mb-4 font-bold tracking-widest">Aggiungi o Sostituisci un PR mantenendo lo stesso codice referral</p>
              <div className="grid grid-cols-1 gap-4">
                <input type="text" placeholder="CODICE REFERRAL (es. PR01)" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={prForm.prCode} onChange={e => setPrForm({...prForm, prCode: e.target.value.toUpperCase()})} required />
                <input type="text" placeholder="Nome PR" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={prForm.name} onChange={e => setPrForm({...prForm, name: e.target.value})} required />
                <input type="text" placeholder="Cellulare" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={prForm.phone} onChange={e => setPrForm({...prForm, phone: e.target.value})} />
                <button className="bg-white text-black font-black py-4 flex items-center justify-center gap-2">
                  <Save size={20} /> SALVA NEL REGISTRO
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prs.map(pr => (
                <div key={pr.id} className="bg-zinc-900 border-2 border-zinc-800 p-6 relative">
                  <p className="text-[#FFEE00] font-black text-xs mb-1">COD: {pr.id}</p>
                  <p className="text-2xl font-black uppercase italic">{pr.name}</p>
                  <p className="text-zinc-500 text-xs mb-4">{pr.phone}</p>
                  <div className="flex gap-4">
                    <button onClick={() => deleteItem('prs_registry', pr.id)} className="text-red-500 text-[10px] font-black flex items-center gap-1">
                      <Trash2 size={14} /> ELIMINA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- SEZIONE SPONSOR --- */}
        {activeTab === 'sponsors' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-black italic mb-6 border-l-8 border-[#FFEE00] pl-4">Partner & Sponsor</h2>
            
            <form onSubmit={handleAddSponsor} className="bg-zinc-900 p-6 mb-10 shadow-[10px_10px_0px_#222] border-2 border-zinc-800">
              <div className="grid grid-cols-1 gap-4">
                <input type="text" placeholder="Nome Brand Sponsor" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={sponsorForm.name} onChange={e => setSponsorForm({...sponsorForm, name: e.target.value})} required />
                <input type="text" placeholder="URL Logo Sponsor" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={sponsorForm.logoUrl} onChange={e => setSponsorForm({...sponsorForm, logoUrl: e.target.value})} required />
                <input type="text" placeholder="Premio (es. Drink Omaggio)" className="bg-black p-4 border-2 border-zinc-800 focus:border-[#FFEE00] outline-none" 
                  value={sponsorForm.prize} onChange={e => setSponsorForm({...sponsorForm, prize: e.target.value})} />
                <div className="flex items-center gap-4 bg-black p-4 border-2 border-zinc-800">
                  <span className="text-[10px] font-black">Probabilità Vincita:</span>
                  <input type="range" min="0" max="1" step="0.05" className="flex-1 accent-[#FFEE00]" 
                    value={sponsorForm.winChance} onChange={e => setSponsorForm({...sponsorForm, winChance: parseFloat(e.target.value)})} />
                  <span className="font-black">{(sponsorForm.winChance * 100).toFixed(0)}%</span>
                </div>
                <button className="bg-[#FFEE00] text-black font-black py-4 flex items-center justify-center gap-2">
                  <Plus size={20} /> AGGIUNGI SPONSOR
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 gap-4">
              {sponsors.map(sp => (
                <div key={sp.id} className="bg-zinc-900 border-2 border-zinc-800 p-4 flex items-center gap-6">
                  <img src={sp.logoUrl} className="w-16 h-16 object-contain bg-white p-1" alt="Sponsor" />
                  <div className="flex-1">
                    <p className="font-black text-xl italic">{sp.name}</p>
                    <p className="text-zinc-500 text-xs font-bold">{sp.prize} • Chance: {sp.winChance * 100}%</p>
                  </div>
                  <button onClick={() => deleteItem('sponsors', sp.id)} className="p-2 text-red-500">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Admin;