import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import {
  ShieldCheck, Power, LayoutGrid, Crown, Calendar, ChevronDown,
  List, Star, Inbox, Check, X, Settings, Euro, ChevronLeft, Phone, User, MapPin, Trash2
} from 'lucide-react';

const SuperAdmin = () => {
  const [events, setEvents] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState(null); // null | 'events' | 'proposals' | 'settings'
  const [selectedProposal, setSelectedProposal] = useState(null);

  const [submissionSettings, setSubmissionSettings] = useState({ price: 10, isFree: true });
  const [priceInput, setPriceInput] = useState('10');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [evSnap, propSnap, settSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'event_proposals')),
        getDoc(doc(db, 'settings', 'eventSubmission'))
      ]);
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setProposals(propSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
      if (settSnap.exists()) {
        const s = settSnap.data();
        setSubmissionSettings(s);
        setPriceInput(String(s.price ?? 10));
      }
    } catch (e) {
      console.error('Errore fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventSetting = async (eventId, field, currentValue) => {
    try {
      const newValue = currentValue === true ? false : true;
      setEvents(events.map(ev => ev.id === eventId ? { ...ev, [field]: newValue } : ev));
      await updateDoc(doc(db, 'events', eventId), { [field]: newValue });
    } catch {
      alert("Errore durante l'aggiornamento");
    }
  };

  const handleAcceptProposal = async (proposal) => {
    const conferma = window.confirm(`Pubblicare "${proposal.title}" come evento ufficiale?`);
    if (!conferma) return;
    try {
      await setDoc(doc(collection(db, 'events')), {
        title: proposal.title,
        date: proposal.date,
        category: proposal.category,
        location: proposal.location,
        description: proposal.description,
        imageUrl: proposal.imageUrl || '',
        active: true,
        timestamp: new Date(),
        submittedBy: `${proposal.nome} ${proposal.cognome}`,
        submitterPhone: proposal.phone
      });
      await updateDoc(doc(db, 'event_proposals', proposal.id), { status: 'accepted' });
      setProposals(proposals.map(p => p.id === proposal.id ? { ...p, status: 'accepted' } : p));
      setSelectedProposal(null);
      alert('Evento pubblicato con successo!');
    } catch {
      alert('Errore durante la pubblicazione.');
    }
  };

  const handleRejectProposal = async (proposal) => {
    const conferma = window.confirm(`Rifiutare la proposta di "${proposal.nome} ${proposal.cognome}"?`);
    if (!conferma) return;
    try {
      await updateDoc(doc(db, 'event_proposals', proposal.id), { status: 'rejected' });
      setProposals(proposals.map(p => p.id === proposal.id ? { ...p, status: 'rejected' } : p));
      setSelectedProposal(null);
    } catch {
      alert('Errore durante il rifiuto.');
    }
  };

  const handleDeleteProposal = async (proposal) => {
    const conferma = window.confirm('Eliminare definitivamente questa proposta?');
    if (!conferma) return;
    try {
      await deleteDoc(doc(db, 'event_proposals', proposal.id));
      setProposals(proposals.filter(p => p.id !== proposal.id));
      setSelectedProposal(null);
    } catch {
      alert("Errore durante l'eliminazione.");
    }
  };

  const handleSaveSettings = async () => {
    const price = Number(priceInput);
    if (isNaN(price) || price < 0) return alert('Inserisci un prezzo valido');
    try {
      const newSettings = { price, isFree: submissionSettings.isFree };
      await setDoc(doc(db, 'settings', 'eventSubmission'), newSettings, { merge: true });
      setSubmissionSettings(newSettings);
      alert('Impostazioni salvate!');
    } catch {
      alert('Errore durante il salvataggio.');
    }
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  const statusBadge = (status) => {
    if (status === 'accepted') return <span className="text-[8px] font-black uppercase text-green-500 bg-green-500/10 px-2 py-1 rounded-full">Accettata</span>;
    if (status === 'rejected') return <span className="text-[8px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-1 rounded-full">Rifiutata</span>;
    return <span className="text-[8px] font-black uppercase text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded-full animate-pulse">In Attesa</span>;
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

        {/* MENU PRINCIPALE */}
        {activeView === null && (
          <div className="flex flex-col items-center justify-center py-10 gap-5 animate-in fade-in zoom-in duration-500">

            {/* CONTROLLO EVENTI */}
            <button
              onClick={() => setActiveView('events')}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-red-600 text-white px-10 py-7 rounded-[2.5rem] shadow-[0_20px_50px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 border-b-8 border-red-800"
            >
              <List size={36} className="group-hover:rotate-12 transition-transform" />
              <span className="text-2xl italic tracking-tighter">Controllo Eventi</span>
              <ChevronDown size={22} className="opacity-50 ml-auto" />
            </button>

            {/* PROPOSTE */}
            <button
              onClick={() => setActiveView('proposals')}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-zinc-900 border-2 border-[#D4AF37]/30 text-white px-10 py-7 rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all duration-300 hover:border-[#D4AF37]"
            >
              <Inbox size={36} className="text-[#D4AF37] group-hover:rotate-12 transition-transform" />
              <span className="text-2xl italic tracking-tighter">Proposte Evento</span>
              {pendingCount > 0 && (
                <span className="ml-auto bg-[#D4AF37] text-black text-sm font-black w-8 h-8 rounded-full flex items-center justify-center animate-bounce">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* IMPOSTAZIONI INSERIMENTO */}
            <button
              onClick={() => setActiveView('settings')}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-zinc-900 border-2 border-zinc-700 text-zinc-400 px-10 py-7 rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all duration-300 hover:border-zinc-500 hover:text-white"
            >
              <Settings size={36} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-2xl italic tracking-tighter">Impostazioni</span>
            </button>
          </div>
        )}

        {/* SEZIONE CONTROLLO EVENTI */}
        {activeView === 'events' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center justify-between mb-6 px-4">
              <h2 className="text-zinc-500 text-xs tracking-widest italic">Gestione Singoli Eventi</h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1">
                <ChevronLeft size={14} /> Indietro
              </button>
            </div>
            {events.map(ev => (
              <div key={ev.id} className="bg-zinc-900 border-2 border-zinc-800 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
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
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">Lista QR</span>
                    <button
                      onClick={() => toggleEventSetting(ev.id, 'isPassDisabled', ev.isPassDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPassDisabled ? 'bg-green-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPassDisabled ? <LayoutGrid size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPassDisabled ? 'text-green-500' : 'text-red-600'}`}>
                      {!ev.isPassDisabled ? 'Attivo' : 'Spento'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">Tavoli</span>
                    <button
                      onClick={() => toggleEventSetting(ev.id, 'isPriveDisabled', ev.isPriveDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPriveDisabled ? 'bg-amber-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPriveDisabled ? <Crown size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPriveDisabled ? 'text-amber-500' : 'text-red-600'}`}>
                      {!ev.isPriveDisabled ? 'Attivo' : 'Spento'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] text-zinc-600 tracking-tighter">Lista PR</span>
                    <button
                      onClick={() => toggleEventSetting(ev.id, 'isPrListDisabled', ev.isPrListDisabled)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${!ev.isPrListDisabled ? 'bg-blue-500 border-black text-black scale-105' : 'bg-zinc-800 border-red-600/50 text-red-600'}`}
                    >
                      {!ev.isPrListDisabled ? <Star size={24} /> : <Power size={24} />}
                    </button>
                    <span className={`text-[8px] font-black ${!ev.isPrListDisabled ? 'text-blue-500' : 'text-red-600'}`}>
                      {!ev.isPrListDisabled ? 'Attivo' : 'Spento'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEZIONE PROPOSTE */}
        {activeView === 'proposals' && (
          <div className="animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center justify-between mb-6 px-4">
              <h2 className="text-zinc-500 text-xs tracking-widest italic">Proposte Ricevute</h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1">
                <ChevronLeft size={14} /> Indietro
              </button>
            </div>

            {proposals.length === 0 ? (
              <div className="text-center py-24 opacity-20">
                <Inbox size={48} className="mx-auto mb-4" />
                <p className="text-xs italic tracking-widest">Nessuna proposta ricevuta</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProposal(p)}
                    className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 flex items-center justify-between gap-4 cursor-pointer hover:border-[#D4AF37]/30 transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shrink-0 border border-zinc-800">
                        <Calendar size={22} className="text-[#D4AF37]" />
                      </div>
                      <div className="overflow-hidden text-left">
                        <p className="text-white font-black italic truncate">{p.title}</p>
                        <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{p.nome} {p.cognome} • {p.date}</p>
                      </div>
                    </div>
                    {statusBadge(p.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEZIONE IMPOSTAZIONI */}
        {activeView === 'settings' && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-8 px-4">
              <h2 className="text-zinc-500 text-xs tracking-widest italic">Inserimento Evento Esterno</h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1">
                <ChevronLeft size={14} /> Indietro
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8">
              {/* Toggle gratuito/a pagamento */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">Modalità Inserimento</p>
                  <p className="text-[9px] text-zinc-500 mt-1 normal-case">
                    {submissionSettings.isFree ? 'Gratuito (prezzo barrato)' : 'A pagamento'}
                  </p>
                </div>
                <button
                  onClick={() => setSubmissionSettings(s => ({ ...s, isFree: !s.isFree }))}
                  className={`relative w-16 h-8 rounded-full transition-colors border-2 ${submissionSettings.isFree ? 'bg-[#D4AF37] border-[#D4AF37]' : 'bg-zinc-700 border-zinc-600'}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${submissionSettings.isFree ? 'left-8' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Prezzo */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Prezzo (€)</p>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input
                    type="number" min="0" step="0.50"
                    className="w-full p-5 pl-12 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-[#D4AF37]"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                  />
                </div>
                <p className="text-[9px] text-zinc-600 mt-2 normal-case italic">
                  {submissionSettings.isFree ? `Mostrato barrato come €${priceInput || 0}` : `Richiesto al momento dell'invio`}
                </p>
              </div>

              {/* Preview */}
              <div className="bg-black/50 rounded-2xl p-4 flex items-center gap-3 border border-zinc-800">
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Anteprima:</p>
                {submissionSettings.isFree ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-zinc-600 line-through">€{priceInput || 0}</span>
                    <span className="bg-[#D4AF37] text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Gratuito</span>
                  </div>
                ) : (
                  <span className="text-lg font-black text-[#D4AF37]">€{priceInput || 0}</span>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                className="w-full bg-[#D4AF37] text-black p-5 rounded-full font-black uppercase tracking-widest text-sm active:scale-95 transition-transform"
              >
                Salva Impostazioni
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODALE DETTAGLIO PROPOSTA */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-end md:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] text-[#D4AF37] tracking-widest mb-1">Proposta Evento</p>
                <h2 className="text-2xl font-black italic leading-tight">{selectedProposal.title}</h2>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-zinc-600 hover:text-white p-2">
                <X size={22} />
              </button>
            </div>

            {selectedProposal.imageUrl && (
              <img src={selectedProposal.imageUrl} alt="Locandina" className="w-full rounded-2xl object-contain max-h-48 bg-black" />
            )}

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Richiedente</p>
                <p className="text-sm font-black">{selectedProposal.nome} {selectedProposal.cognome}</p>
              </div>
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Telefono</p>
                <p className="text-sm font-black">{selectedProposal.phone}</p>
              </div>
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Data</p>
                <p className="text-sm font-black">{selectedProposal.date}</p>
              </div>
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Categoria</p>
                <p className="text-sm font-black">{selectedProposal.category}</p>
              </div>
              <div className="bg-black/50 rounded-2xl p-4 col-span-2">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Location</p>
                <p className="text-sm font-black">{selectedProposal.location}</p>
              </div>
              {selectedProposal.description && (
                <div className="bg-black/50 rounded-2xl p-4 col-span-2">
                  <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Descrizione</p>
                  <p className="text-xs font-bold text-zinc-300 normal-case leading-relaxed whitespace-pre-wrap">{selectedProposal.description}</p>
                </div>
              )}
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Stato</p>
                {statusBadge(selectedProposal.status)}
              </div>
              <div className="bg-black/50 rounded-2xl p-4">
                <p className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Costo</p>
                <p className="text-sm font-black text-[#D4AF37]">
                  {selectedProposal.isFree ? 'Gratuito' : `€${selectedProposal.price}`}
                </p>
              </div>
            </div>

            {selectedProposal.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAcceptProposal(selectedProposal)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white p-5 rounded-full font-black uppercase text-sm active:scale-95 transition-transform"
                >
                  <Check size={20} /> Pubblica
                </button>
                <button
                  onClick={() => handleRejectProposal(selectedProposal)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white p-5 rounded-full font-black uppercase text-sm active:scale-95 transition-transform"
                >
                  <X size={20} /> Rifiuta
                </button>
              </div>
            )}

            {selectedProposal.status !== 'pending' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="flex-1 bg-zinc-800 text-white p-5 rounded-full font-black uppercase text-sm active:scale-95 transition-transform"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => handleDeleteProposal(selectedProposal)}
                  className="flex items-center justify-center gap-2 bg-red-600/20 border border-red-600/50 text-red-500 px-6 p-5 rounded-full font-black uppercase text-sm active:scale-95 transition-transform hover:bg-red-600 hover:text-white"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
