import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { 
  collection, getDocs, updateDoc, 
  deleteDoc, doc, setDoc, query, orderBy, getDoc, deleteField 
} from 'firebase/firestore';
import { 
  Users, Calendar, Ticket, Gift, Trash2,
  Plus, Save, RefreshCw, Phone, BarChart, DollarSign, Award, X, Lock, Wallet, Calculator, Tag, MapPin, KeyRound, Ban, Crown
} from 'lucide-react';

// --- COMPONENTE INLINE PER TARIFFE: STESSA ALTEZZA DEL SELECT E DECIMALI ---
const InlinePayInput = ({ initialValue, onSave, placeholder }) => {
  const [val, setVal] = useState(initialValue || '');
  useEffect(() => { setVal(initialValue || ''); }, [initialValue]);
  return (
    <div className="flex items-center border-2 border-black bg-white w-[72px] h-full">
      <span className="px-1.5 text-[10px] font-black text-zinc-500 bg-zinc-100 border-r-2 border-black h-full flex items-center justify-center">€</span>
      <input 
        type="number" min="0" step="0.01" placeholder={placeholder}
        className="w-full h-full p-0 font-black text-[10px] text-center focus:outline-none bg-transparent"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onSave(val)}
      />
    </div>
  );
};

const Admin = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  
  const [events, setEvents] = useState([]);
  const [prs, setPrs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [sponsors, setSponsors] = useState([]);

  const [selectedEventForModal, setSelectedEventForModal] = useState(null);
  const [replacePrData, setReplacePrData] = useState(null);
  const [replaceName, setReplaceName] = useState('');
  const [replacePhone, setReplacePhone] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState('');
  const [payPrData, setPayPrData] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [profitsModalOpen, setProfitsModalOpen] = useState(false);
  
  const [masterPayAmount, setMasterPayAmount] = useState('');
  const [orphanValues, setOrphanValues] = useState({});

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [priveManageEvent, setPriveManageEvent] = useState(null);
  const [priveForm, setPriveForm] = useState({ name: '', price: '', inclusions: '' });

  const [prForm, setPrForm] = useState({ name: '', phone: '', supervisorId: '' });
  const [autoPrCode, setAutoPrCode] = useState('PR001'); 
  
  const [eventForm, setEventForm] = useState({ title: '', date: '', description: '', category: 'DISCOTECA', location: '' }); 
  const [selectedFile, setSelectedFile] = useState(null);

  // CATEGORIE CONCORDATE
  const categories = [
    { id: 'DISCOTECA', label: 'DISCOTECA' },
    { id: 'TEATRO', label: 'TEATRO' },
    { id: 'CINEMA', label: 'CINEMA' },
    { id: 'CONCERTI', label: 'CONCERTI' },
    { id: 'ARENE ESTIVE', label: 'ARENE ESTIVE' },
    { id: 'PUB', label: 'LOUNGE/PUB' },
  ];

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (prs && prs.length > 0) {
      const prNumbers = prs
        .filter(p => p.id.startsWith('PR'))
        .map(p => parseInt(p.id.replace('PR', ''), 10))
        .filter(n => !isNaN(n));
      const maxNumber = prNumbers.length > 0 ? Math.max(...prNumbers) : 0;
      setAutoPrCode(`PR${String(maxNumber + 1).padStart(3, '0')}`);
    } else {
      setAutoPrCode('PR001');
    }
  }, [prs]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const evSnap = await getDocs(collection(db, "events"));
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const prRegistrySnap = await getDocs(collection(db, "prs_registry"));
      const livePrSnap = await getDocs(collection(db, "prs"));
      const liveCounts = {};
      livePrSnap.docs.forEach(d => liveCounts[d.id] = d.data().count || 0);

      let rawPrs = prRegistrySnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        count: liveCounts[d.id] || 0,
        aliases: [] 
      }));

      rawPrs.forEach(p => {
        if (p.mergedInto) {
          const target = rawPrs.find(t => t.id === p.mergedInto);
          if (target) {
            target.count += p.count;
            target.aliases.push(p.id);
          }
        }
      });

      setPrs(rawPrs);

      const tktSnap = await getDocs(collection(db, "tickets"));
      setTickets(tktSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const spSnap = await getDocs(collection(db, "sponsors"));
      setSponsors(spSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) { console.error("Errore fetch:", e); }
    setLoading(false);
  };

  const activePrs = prs.filter(p => !p.mergedInto);

  // FUNZIONE PER RESET PASSWORD PR
  const handleResetPrPassword = async (prId) => {
    const conferma = window.confirm("Vuoi davvero resettare la password di questo PR? Al prossimo accesso dovrà impostarne una nuova.");
    if (!conferma) return;
    try {
      await updateDoc(doc(db, "prs_registry", prId), { prPassword: deleteField() });
      alert("Password resettata con successo.");
      fetchData();
    } catch (e) { alert("Errore durante il reset."); }
  };

  const calculatePrFinancials = (pr) => {
    let directTotal = 0;
    let supervisorBonus = 0;

    const myTickets = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.used === true);
    myTickets.forEach(t => {
        const slotIndex = pr.eventIds?.indexOf(t.eventId);
        const rate = (slotIndex !== -1 && slotIndex !== undefined) ? (Number(pr.eventPays?.[slotIndex]) || 0) : 0;
        directTotal += rate;
    });

    const subPrs = activePrs.filter(sub => sub.supervisorId === pr.id || pr.aliases?.includes(sub.supervisorId));
    subPrs.forEach(sub => {
        const subTickets = tickets.filter(t => (t.prId === sub.id || sub.aliases?.includes(t.prId)) && t.used === true);
        const bonusRate = Number(sub.supervisorPay) || 0;
        supervisorBonus += (subTickets.length * bonusRate);
    });

    return { directTotal, supervisorBonus, guadagnoLordo: directTotal + supervisorBonus };
  };

  const calculatePrFinancialsForEvent = (pr, eventId) => {
    let directTotalEv = 0;
    let supervisorBonusEv = 0;

    const myEvTickets = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === eventId && t.used === true);
    const slotIndex = pr.eventIds?.indexOf(eventId);
    const rate = (slotIndex !== -1 && slotIndex !== undefined) ? (Number(pr.eventPays?.[slotIndex]) || 0) : 0;
    directTotalEv = myEvTickets.length * rate;

    const subPrs = activePrs.filter(sub => sub.supervisorId === pr.id || pr.aliases?.includes(sub.supervisorId));
    subPrs.forEach(sub => {
        const subEvTickets = tickets.filter(t => (t.prId === sub.id || sub.aliases?.includes(t.prId)) && t.eventId === eventId && t.used === true);
        const bonusRate = Number(sub.supervisorPay) || 0;
        supervisorBonusEv += (subEvTickets.length * bonusRate);
    });

    return { evIns: myEvTickets.length, directTotalEv, supervisorBonusEv, guadagnoTotaleEv: directTotalEv + supervisorBonusEv };
  };

  const handleAddPr = async (e) => {
    e.preventDefault();
    try {
      const code = autoPrCode; 
      await setDoc(doc(db, "prs_registry", code), {
        name: prForm.name,
        phone: prForm.phone,
        eventIds: ['', '', '', '', '', ''], 
        eventPays: [0, 0, 0, 0, 0, 0],
        supervisorId: prForm.supervisorId || '',
        supervisorPay: 0,
        active: true,
        mergedInto: null,
        acconto: 0 
      });
      await setDoc(doc(db, "prs", code), { count: 0 }, { merge: true });
      setPrForm({ name: '', phone: '', supervisorId: '' });
      fetchData();
    } catch (e) { alert("Errore nel salvataggio"); }
  };

  const handleUpdatePrEventSlot = async (prId, slotIndex, eventId, currentEventIds) => {
    setLoading(true);
    try {
      let newEventIds = [...(currentEventIds || [])];
      while (newEventIds.length < 6) newEventIds.push(''); 
      newEventIds[slotIndex] = eventId;
      await updateDoc(doc(db, "prs_registry", prId), { eventIds: newEventIds });
      await fetchData();
    } catch (error) { alert("Errore aggiornamento serata."); } finally { setLoading(false); }
  };

  const handleUpdateEventPay = async (prId, slotIndex, val, currentEventPays) => {
    try {
        const newPays = [...(currentEventPays || [0,0,0,0,0,0])];
        newPays[slotIndex] = Number(val);
        await updateDoc(doc(db, "prs_registry", prId), { eventPays: newPays });
        await fetchData();
    } catch (error) { console.error("Errore salvataggio provvigione."); }
  };

  const handleUpdateSupervisorPay = async (prId, val) => {
    try {
        await updateDoc(doc(db, "prs_registry", prId), { supervisorPay: Number(val) });
        await fetchData();
    } catch (error) { console.error("Errore salvataggio bonus."); }
  };

  const handleDeletePr = async (pr) => {
    if (pr.id === 'MASTER') return alert("Il Profilo MASTER non può essere eliminato!");
    const conferma = window.confirm(`ATTENZIONE!\nSei sicuro di voler eliminare ${pr.name}?\n\nI suoi dati verranno trasferiti al "PROFILO MASTER".`);
    if (!conferma) return;
    setLoading(true);
    try {
      const masterExists = prs.find(p => p.id === 'MASTER');
      if (!masterExists) {
        await setDoc(doc(db, "prs_registry", "MASTER"), {
          name: "PROFILO MASTER", phone: "", eventIds: [], supervisorId: "",
          active: true, mergedInto: null, acconto: 0, historicalOrphanCount: 0, historicalOrphanProfit: 0
        });
        await setDoc(doc(db, "prs", "MASTER"), { count: 0 }, { merge: true });
      }
      await updateDoc(doc(db, "prs_registry", pr.id), { mergedInto: "MASTER" });
      await fetchData();
      alert("Collaboratore rimosso. Dati passati al Profilo MASTER.");
    } catch (error) { alert("Errore eliminazione."); } finally { setLoading(false); }
  };

  const handleDeleteAlias = async (aliasId) => {
    const conferma = window.confirm(`ATTENZIONE!\nVuoi davvero eliminare in modo definitivo l'alias ${aliasId}?`);
    if (!conferma) return;
    setLoading(true);
    try {
        await deleteDoc(doc(db, "prs_registry", aliasId));
        await deleteDoc(doc(db, "prs", aliasId));
        await fetchData();
    } catch (error) { alert("Errore durante l'eliminazione dell'alias."); } finally { setLoading(false); }
  };

  const openReplaceModal = (pr) => {
    if (pr.id === 'MASTER') return alert("Il Profilo MASTER non può essere sostituito!");
    setReplacePrData(pr); setReplaceName(pr.name); setReplacePhone(pr.phone || ''); setReplaceTargetId('');
  };

  const eseguiSostituzioneNuovo = async (pr) => {
    if (!replaceName) return alert("Inserisci il nuovo nome!");
    setLoading(true);
    try {
      await updateDoc(doc(db, "prs_registry", pr.id), { name: replaceName, phone: replacePhone, mergedInto: null });
      await fetchData(); setReplacePrData(null);
    } catch (error) { alert("Errore sostituzione."); } finally { setLoading(false); }
  };

  const eseguiSostituzioneIngloba = async (pr) => {
    if (!replaceTargetId) return alert("Seleziona un PR Esistente!");
    if (replaceTargetId === pr.id) return alert("Impossibile inglobare in sé stesso!");
    setLoading(true);
    try {
      await updateDoc(doc(db, "prs_registry", pr.id), { mergedInto: replaceTargetId });
      await fetchData(); setReplacePrData(null);
    } catch (error) { alert("Errore inglobamento."); } finally { setLoading(false); }
  };

  const eseguiPagamento = async () => {
    const importo = Number(payAmount);
    if (!importo || importo <= 0) return alert("Inserisci un importo valido da pagare.");

    const fin = calculatePrFinancials(payPrData);
    const accontoAttuale = Number(payPrData.acconto) || 0;
    const daPagare = Math.max(0, fin.guadagnoLordo - accontoAttuale);

    if (importo > daPagare) return alert(`L'importo supera il totale da pagare (€${daPagare.toFixed(2)})!`);

    setLoading(true);
    try {
      await updateDoc(doc(db, "prs_registry", payPrData.id), { acconto: accontoAttuale + importo });
      await fetchData(); setPayPrData(null);
    } catch (error) { alert("Errore registrazione pagamento."); } finally { setLoading(false); }
  };

  const handleAzzeraContabilita = async (pr) => {
    const conferma = window.confirm(`ATTENZIONE!\nSei sicuro di voler azzerare la contabilità di ${pr.name}?`);
    if (!conferma) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "prs", pr.id), { count: 0 }, { merge: true });
      await updateDoc(doc(db, "prs_registry", pr.id), { acconto: 0 });
      if (pr.aliases && pr.aliases.length > 0) {
        for (const alias of pr.aliases) await setDoc(doc(db, "prs", alias), { count: 0 }, { merge: true });
      }
      await fetchData(); setPayPrData(null);
    } catch (error) { alert("Errore azzeramento."); } finally { setLoading(false); }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!selectedFile) return alert("Clicca sul riquadro per inserire la foto!");
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const scaleSize = 800 / img.width; canvas.width = 800; canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            await setDoc(doc(collection(db, "events")), {
              title: eventForm.title, 
              date: eventForm.date, 
              location: eventForm.location,
              description: eventForm.description,
              category: eventForm.category,
              imageUrl: canvas.toDataURL('image/jpeg', 0.7), 
              active: true, 
              timestamp: new Date()
            });
            setEventForm({ title: '', date: '', description: '', category: 'DISCOTECA', location: '' }); 
            setSelectedFile(null); await fetchData();
          } catch (dbError) { alert("Errore salvataggio database."); } finally { setLoading(false); }
        };
      };
      reader.readAsDataURL(selectedFile);
    } catch (e) { setLoading(false); }
  };

  const handleSavePriveType = async (ev) => {
    if (!priveForm.name.trim() || !priveForm.price) return alert('Inserisci nome e prezzo');
    const newType = {
      id: Math.random().toString(36).substr(2, 8).toUpperCase(),
      name: priveForm.name,
      price: Number(priveForm.price),
      inclusions: priveForm.inclusions || '',
      available: true
    };
    const updatedTypes = [...(ev.priveTypes || []), newType];
    try {
      await updateDoc(doc(db, 'events', ev.id), { priveTypes: updatedTypes });
      const updated = { ...ev, priveTypes: updatedTypes };
      setPriveManageEvent(updated);
      setEvents(events.map(e => e.id === ev.id ? updated : e));
      setPriveForm({ name: '', price: '', inclusions: '' });
    } catch { alert('Errore salvataggio'); }
  };

  const handleDeletePriveType = async (ev, typeId) => {
    if (!window.confirm('Eliminare questo tipo di privé?')) return;
    const updatedTypes = (ev.priveTypes || []).filter(t => t.id !== typeId);
    try {
      await updateDoc(doc(db, 'events', ev.id), { priveTypes: updatedTypes });
      const updated = { ...ev, priveTypes: updatedTypes };
      setPriveManageEvent(updated);
      setEvents(events.map(e => e.id === ev.id ? updated : e));
    } catch { alert('Errore eliminazione'); }
  };

  const handleTogglePriveAvailability = async (ev, typeId, currentAvailable) => {
    const updatedTypes = (ev.priveTypes || []).map(t =>
      t.id === typeId ? { ...t, available: currentAvailable === false ? true : false } : t
    );
    try {
      await updateDoc(doc(db, 'events', ev.id), { priveTypes: updatedTypes });
      const updated = { ...ev, priveTypes: updatedTypes };
      setPriveManageEvent(updated);
      setEvents(events.map(e => e.id === ev.id ? updated : e));
    } catch { alert('Errore aggiornamento'); }
  };

  const handleToggleCancelled = async (ev) => {
    const newValue = !ev.isCancelled;
    const msg = newValue
      ? `Segnare "${ev.title}" come ANNULLATO?\n\nTutte le prenotazioni verranno disabilitate.`
      : `Riattivare "${ev.title}"?`;
    if (!window.confirm(msg)) return;
    setLoading(true);
    try {
      const updates = { isCancelled: newValue };
      if (newValue) {
        updates.isPassDisabled = true;
        updates.isPriveDisabled = true;
        updates.isPrListDisabled = true;
      }
      await updateDoc(doc(db, "events", ev.id), updates);
      await fetchData();
    } catch { alert("Errore aggiornamento."); } finally { setLoading(false); }
  };

  const handleTogglePriveSoldOut = async (ev) => {
    const newValue = !ev.isPriveSoldOut;
    setLoading(true);
    try {
      const updates = { isPriveSoldOut: newValue };
      if (newValue) updates.isPriveDisabled = true;
      await updateDoc(doc(db, "events", ev.id), updates);
      await fetchData();
    } catch { alert("Errore aggiornamento."); } finally { setLoading(false); }
  };

  const handleConcludiSerata = async (eventId) => {
    const eventTitle = events.find(e => e.id === eventId)?.title || "questo evento";
    const conferma = window.confirm(`ATTENZIONE!\nSei sicuro di voler concludere ${eventTitle}?\n\nGli slot verranno svuotati.`);
    if (!conferma) return;
    setLoading(true);
    try {
      const prsToUpdate = prs.filter(p => p.eventIds && p.eventIds.includes(eventId));
      for (const pr of prsToUpdate) {
        const newEventIds = pr.eventIds.map(id => id === eventId ? '' : id); 
        await updateDoc(doc(db, "prs_registry", pr.id), { eventIds: newEventIds });
      }
      await deleteDoc(doc(db, "events", eventId));
      await fetchData();
    } catch (e) { alert("Errore chiusura serata."); } finally { setLoading(false); }
  };

  const masterPr = prs.find(p => p.id === 'MASTER');
  const masterFin = masterPr ? calculatePrFinancials(masterPr) : { directTotal: 0, supervisorBonus: 0 };
  const historicalOrphanProfit = Number(masterPr?.historicalOrphanProfit) || 0;
  const historicalOrphanCount = Number(masterPr?.historicalOrphanCount) || 0;
  const guadagnoLordoMaster = masterFin.directTotal + masterFin.supervisorBonus + historicalOrphanProfit;
  const accontoAttualeMaster = Number(masterPr?.acconto) || 0;
  const daPagareMaster = Math.max(0, guadagnoLordoMaster - accontoAttualeMaster);

  const eseguiPagamentoMaster = async () => {
    const importo = Number(masterPayAmount);
    if (!importo || importo <= 0) return alert("Inserisci un prelievo valido.");
    if (importo > daPagareMaster) return alert("Il prelievo supera la giacenza in cassa!");
    setLoading(true);
    try {
      await updateDoc(doc(db, "prs_registry", "MASTER"), { acconto: accontoAttualeMaster + importo });
      await fetchData(); setMasterPayAmount('');
    } catch (e) { alert("Errore registrazione prelievo."); } finally { setLoading(false); }
  };

  const handleAzzeraContabilitaMaster = async () => {
    const conferma = window.confirm("ATTENZIONE!\nVuoi chiudere definitivamente la contabilità stagionale del MASTER?");
    if (!conferma) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "prs", "MASTER"), { count: 0 }, { merge: true });
      await updateDoc(doc(db, "prs_registry", "MASTER"), { acconto: 0, historicalOrphanCount: 0, historicalOrphanProfit: 0 });
      await fetchData(); setProfitsModalOpen(false);
    } catch (e) { alert("Errore azzeramento Master."); } finally { setLoading(false); }
  };

  const handleSavePassword = async () => {
    if (!newAdminPassword) return alert("Inserisci una password valida.");
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "admin"), { password: newAdminPassword }, { merge: true });
      setNewAdminPassword(''); setPasswordModalOpen(false);
    } catch (error) { alert("Errore salvataggio password."); } finally { setLoading(false); }
  };

  const totalScanned = activePrs.reduce((acc, p) => acc + p.count, 0);
  const totalWon = tickets.filter(t => t.won === true).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-black font-sans pb-20 uppercase font-black">
      
      {/* HEADER DASHBOARD */}
      <div className="bg-black text-white py-1 px-5 sticky top-0 z-50 flex justify-between items-center border-b-4 border-[#FFEE00]">
        
        <div className="flex items-start flex-col">
          <img src="/logo.png" alt="Logo" className="h-24 mt-8 -mb-5 object-contain block" />
          <h1 className="font-black italic text-2xl leading-none">ADMIN PANEL</h1>
        </div>

        <div className="flex items-center gap-6">
          <p className="text-[10px] font-bold text-[#FFEE00] tracking-[0.3em] leading-none">
            Ver 5.1 
          </p>
          <div className="flex gap-4">
            <button onClick={() => setPasswordModalOpen(true)} className="bg-zinc-800 text-white p-2 rounded-full border-2 border-zinc-600 hover:bg-zinc-700">
              <Lock size={20} />
            </button>
            <button onClick={fetchData} className={`bg-[#FFEE00] text-black p-2 rounded-full ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGAZIONE TABS */}
      <div className="flex bg-white border-b-4 border-black sticky top-[76px] z-40 overflow-x-auto">
        <button onClick={() => setActiveTab('stats')} className={`flex-1 p-4 font-black flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-[#FFEE00]' : ''}`}><BarChart size={20}/> <span className="hidden md:inline">DATI LIVE</span></button>
        <button onClick={() => setActiveTab('prs')} className={`flex-1 p-4 font-black flex items-center justify-center gap-2 border-l-2 border-black ${activeTab === 'prs' ? 'bg-[#FFEE00]' : ''}`}><Users size={20}/> <span className="hidden md:inline">TEAM PR</span></button>
        <button onClick={() => setActiveTab('events')} className={`flex-1 p-4 font-black flex items-center justify-center gap-2 border-l-2 border-black ${activeTab === 'events' ? 'bg-[#FFEE00]' : ''}`}><Calendar size={20}/> <span className="hidden md:inline">SERATE</span></button>
        <button onClick={() => setActiveTab('sponsors')} className={`flex-1 p-4 font-black flex items-center justify-center gap-2 border-l-2 border-black ${activeTab === 'sponsors' ? 'bg-[#FFEE00]' : ''}`}><Gift size={20}/> <span className="hidden md:inline">SPONSOR</span></button>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        
        {/* TAB 1: DATI LIVE */}
        {activeTab === 'stats' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black italic mb-6 underline uppercase">Dati Live per Singola Serata</h2>
            <div className="flex flex-col gap-6">
               {events.map(ev => {
                 const evTickets = tickets.filter(t => t.eventId === ev.id);
                 const passGenerati = evTickets.length;
                 const drinkVinti = evTickets.filter(t => t.won === true).length;
                 const ingressiEffettivi = evTickets.filter(t => t.used === true).length;
                 const evPrs = prs.filter(p => !p.mergedInto && (p.id === 'MASTER' || p.eventIds?.includes(ev.id)));
                 let costoPR = 0;
                 evPrs.forEach(p => {
                    const finEv = calculatePrFinancialsForEvent(p, ev.id);
                    costoPR += finEv.guadagnoTotaleEv;
                 });
                 return (
                   <div key={ev.id} className="bg-white border-4 border-black p-4 flex flex-col md:flex-row gap-6 shadow-[8px_8px_0px_#000]">
                     <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                       {ev.imageUrl ? <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto object-contain border-2 border-black" /> : <div className="w-full h-40 bg-zinc-100 border-2 border-black flex items-center justify-center font-black opacity-30">NESSUNA FOTO</div>}
                     </div>
                     <div className="flex-1 flex flex-col justify-between">
                       <div>
                         <p className="text-3xl font-black italic uppercase leading-none mb-1">{ev.title}</p>
                         <p className="font-bold text-zinc-400 text-xs mb-6 uppercase">{ev.date} - <span className="bg-black text-[#FFEE00] px-1">{ev.category || 'DISCOTECA'}</span></p>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                           <div className="bg-zinc-100 border-2 border-black p-3"><p className="text-[10px] font-black uppercase text-zinc-500">Pass Generati</p><p className="text-3xl font-black italic">{passGenerati}</p></div>
                           <div className="bg-[#FFEE00] border-2 border-black p-3"><p className="text-[10px] font-black uppercase">Ingressi Effettivi</p><p className="text-3xl font-black italic">{ingressiEffettivi}</p></div>
                           <div className="bg-black text-white border-2 border-black p-3"><p className="text-[10px] font-black uppercase text-[#FFEE00]">Drink Vinti</p><p className="text-3xl font-black italic">{drinkVinti}</p></div>
                           <div className="bg-red-50 border-2 border-red-600 p-3"><p className="text-[10px] font-black uppercase text-red-600">Costo PR LORDO</p><p className="text-3xl font-black italic text-red-600">€{costoPR.toFixed(2)}</p></div>
                         </div>
                       </div>
                       <button onClick={() => setSelectedEventForModal(ev.id)} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase flex justify-center items-center gap-2 shadow-[4px_4px_0px_#FFEE00] active:translate-y-1 transition-all">
                         <BarChart size={20} /> VEDI DETTAGLIO FINANZIARIO PR
                       </button>
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}

        {/* TAB 2: TEAM PR */}
        {activeTab === 'prs' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={handleAddPr} className="bg-white border-4 border-black p-6 mb-10 shadow-[8px_8px_0px_#000]">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase"><Plus size={24}/> NUOVO COLLABORATORE</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Codice Automatico</label><input type="text" value={autoPrCode} className="p-3 border-2 border-black font-black bg-zinc-100 text-zinc-500 cursor-not-allowed outline-none" readOnly /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Nome Completo *</label><input type="text" placeholder="Es. Mario Rossi" className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00]" value={prForm.name} onChange={e => setPrForm({...prForm, name: e.target.value})} required /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Telefono</label><input type="tel" placeholder="Es. 3331234567" className="p-3 border-2 border-black font-bold outline-none focus:border-[#FFEE00]" value={prForm.phone} onChange={e => setPrForm({...prForm, phone: e.target.value})} /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Supervisore (Opzionale)</label>
                  <select className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00] bg-white" value={prForm.supervisorId} onChange={e => setPrForm({...prForm, supervisorId: e.target.value})}>
                    <option value="">-- NESSUN SUPERVISORE --</option>
                    {activePrs.filter(p => p.id !== 'MASTER').map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                  </select>
                </div>
              </div>
              <button className="w-full mt-6 bg-black text-white font-black py-4 uppercase hover:bg-[#FFEE00] hover:text-black transition-all shadow-[4px_4px_0px_#FFEE00] active:translate-y-1">SALVA NEL TEAM</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-4 border-black bg-white">
                <thead>
                  <tr className="bg-black text-white italic uppercase text-[11px]">
                    <th className="p-4 text-left border-r border-zinc-700 min-w-[200px]">PR INFO & LINK</th>
                    <th className="p-4 text-left border-r border-zinc-700 min-w-[150px]">SUPERVISORE</th>
                    <th className="p-4 text-left border-r border-zinc-700 min-w-[220px]">SERATE ASSEGNATE (SLOT)</th>
                    <th className="p-4 text-center border-r border-zinc-700 min-w-[80px]">IN</th>
                    <th className="p-4 text-right border-r border-zinc-700 min-w-[100px]">TOTALE</th>
                    <th className="p-4 text-center min-w-[150px]">AZIONI</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrs.map(pr => {
                    const isMaster = pr.id === 'MASTER';
                    let supNameText = 'NESSUNO';
                    if (pr.supervisorId && !isMaster) {
                      const supObj = prs.find(p => p.id === pr.supervisorId);
                      supNameText = supObj ? (supObj.mergedInto === 'MASTER' ? `MASTER (ex ${supObj.name})` : supObj.name) : pr.supervisorId;
                    }
                    const fin = isMaster ? masterFin : calculatePrFinancials(pr);
                    const guadagnoLordo = isMaster ? guadagnoLordoMaster : fin.guadagnoLordo;
                    const acconto = Number(pr.acconto) || 0;
                    const guadagnoTotale = Math.max(0, guadagnoLordo - acconto);

                    return (
                      <tr key={pr.id} className="border-b-2 border-black hover:bg-[#FFEE00]/10">
                        <td className="p-4 border-r-2 border-black align-top text-left">
                          <p className="font-black text-lg leading-none">{pr.name}</p>
                          {pr.phone && <p className="text-xs font-bold opacity-50 flex items-center gap-1 mt-1"><Phone size={10}/> {pr.phone}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black italic px-2 py-1 rounded ${isMaster ? 'bg-[#FFEE00] text-black' : 'bg-black text-[#FFEE00]'}`}>ID: {pr.id}</span>
                            {!isMaster && <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${pr.id}`); alert("Link copiato!"); }} className="text-[10px] font-black underline cursor-pointer text-blue-600 hover:text-blue-800 uppercase">Copia Link App</button>}
                          </div>
                        </td>
                        <td className="p-4 border-r-2 border-black text-xs font-bold uppercase align-top text-left">
                          {pr.supervisorId && !isMaster ? (
                            <>
                              <span className="block text-sm text-black">{supNameText}</span>
                              <div className="mt-2 flex items-center h-[26px]">
                                <span className="text-[9px] text-zinc-500 whitespace-nowrap mr-2">BONUS:</span>
                                <InlinePayInput initialValue={pr.supervisorPay} onSave={(val) => handleUpdateSupervisorPay(pr.id, val)} placeholder="0.00" />
                              </div>
                            </>
                          ) : 'NESSUNO'}
                        </td>
                        <td className="p-2 border-r-2 border-black align-top text-left">
                          {isMaster ? (
                            <div className="flex flex-col gap-1">
                              {events.map(ev => (<div key={ev.id} className="h-[26px] flex items-center"><span className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[160px]">{ev.title}</span></div>))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {[0, 1, 2, 3, 4, 5].map(i => {
                                const selectedEventId = pr.eventIds?.[i] || "";
                                const currentPay = pr.eventPays?.[i] || "";
                                return (
                                  <div key={i} className="h-[26px] flex items-stretch gap-1">
                                    <select className="w-28 bg-white border-2 border-black text-[10px] font-bold uppercase px-1 outline-none h-full" value={selectedEventId} onChange={(e) => handleUpdatePrEventSlot(pr.id, i, e.target.value, pr.eventIds)} disabled={loading}>
                                      <option value="">-- VUOTO --</option>
                                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                                    </select>
                                    {selectedEventId && <InlinePayInput initialValue={currentPay} onSave={(val) => handleUpdateEventPay(pr.id, i, val, pr.eventPays)} placeholder="0.00" />}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="p-2 border-r-2 border-black align-top text-center">
                          <div className="flex flex-col gap-1">
                             {isMaster ? events.map(ev => {
                               const evIns = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === ev.id && t.used === true).length;
                               return (<div key={ev.id} className="h-[26px] flex items-center justify-center w-full">{evIns > 0 ? <span className="bg-black text-[#FFEE00] px-2 py-1 rounded-sm font-black text-[14px] leading-none shadow-[2px_2px_0px_#000]">{evIns}</span> : <span className="text-black font-black text-[14px] leading-none">0</span>}</div>)
                             }) : [0, 1, 2, 3, 4, 5].map(i => {
                               const sid = pr.eventIds?.[i];
                               if (!sid) return <div key={i} className="h-[26px]"></div>;
                               const evIns = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === sid && t.used === true).length;
                               return (<div key={i} className="h-[26px] flex items-center justify-center w-full">{evIns > 0 ? <span className="bg-black text-[#FFEE00] px-2 py-1 rounded-sm font-black text-[14px] leading-none shadow-[2px_2px_0px_#000]">{evIns}</span> : <span className="text-black font-black text-[14px] leading-none">0</span>}</div>)
                             })}
                          </div>
                        </td>
                        <td className="p-2 border-r-2 border-black align-top text-right">
                          <div className="flex flex-col gap-1">
                             {isMaster ? events.map(ev => {
                               const finEv = calculatePrFinancialsForEvent(pr, ev.id);
                               return (<div key={ev.id} className="h-[26px] flex items-center justify-end w-full"><span className="text-black font-black text-[14px] leading-none">€{finEv.guadagnoTotaleEv.toFixed(2)}</span></div>)
                             }) : [0, 1, 2, 3, 4, 5].map(i => {
                               const sid = pr.eventIds?.[i];
                               if (!sid) return <div key={i} className="h-[26px]"></div>;
                               const finEv = calculatePrFinancialsForEvent(pr, sid);
                               return (<div key={i} className="h-[26px] flex items-center justify-end w-full"><span className="text-black font-black text-[14px] leading-none">€{finEv.guadagnoTotaleEv.toFixed(2)}</span></div>)
                             })}
                          </div>
                        </td>
                        <td className="p-4 text-center align-top bg-zinc-50">
                          <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-red-600 leading-none">€{guadagnoTotale.toFixed(2)}</span>
                            {acconto > 0 && <span className="text-[10px] font-black text-zinc-400 mt-1 uppercase leading-none">Cassa Tot: €{guadagnoLordo.toFixed(2)}</span>}
                          </div>
                          <div className="flex flex-col gap-2 items-center mt-3">
                            <button onClick={() => handleResetPrPassword(pr.id)} className="bg-black text-white text-[10px] p-2 border-2 border-black flex items-center justify-center gap-1 uppercase w-full shadow-[2px_2px_0px_#000] active:scale-95"><KeyRound size={12}/> RESET PWD</button>
                            {isMaster ? (
                                <>
                                <button onClick={() => setProfitsModalOpen(true)} className="bg-green-600 text-white text-[10px] font-black border-2 border-black p-2 hover:bg-green-700 transition-colors uppercase w-full shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1"><Calculator size={12}/> CONTEGGI</button>
                                <button onClick={() => setMasterModalOpen(true)} className="bg-purple-600 text-white text-[10px] font-black border-2 border-black p-2 hover:bg-purple-700 transition-colors uppercase w-full shadow-[2px_2px_0px_#000]">MODIFICA ALIAS</button>
                                </>
                            ) : (
                                <>
                                <button onClick={() => { setPayPrData(pr); setPayAmount(''); }} className="bg-[#FFEE00] text-black text-[10px] font-black border-2 border-black p-2 hover:bg-yellow-400 transition-colors uppercase w-full shadow-[2px_2px_0px_#000]">VEDI E PAGA</button>
                                <button onClick={() => openReplaceModal(pr)} className="text-blue-600 text-[10px] font-black border-2 border-blue-600 p-2 hover:bg-blue-50 transition-colors uppercase w-full">Sostituisci</button>
                                </>
                            )}
                            <button onClick={() => handleDeletePr(pr)} className={`${isMaster ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 text-red-600'} w-full border-2 border-red-600 p-2 flex justify-center`}><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: GESTIONE SERATE */}
        {activeTab === 'events' && (
          <div className="animate-in fade-in duration-300">
             <form onSubmit={handleAddEvent} className="bg-black text-white p-6 mb-10 shadow-[8px_8px_0px_#FFEE00]">
               <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-[#FFEE00] uppercase italic"><Plus/> Pubblica Nuova Serata</h2>
               
               <div className="grid grid-cols-1 gap-4 uppercase">
                 <div className="border-4 border-dashed border-zinc-700 p-4 text-center relative hover:bg-zinc-900 transition-colors cursor-pointer min-h-[100px] flex items-center justify-center">
                   <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
                   {selectedFile ? <span className="text-green-400 font-black">{selectedFile.name}</span> : <span className="font-black text-zinc-400 text-xs">CLICCA QUI PER CARICARE LA FOTO LOCANDINA</span>}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-[#FFEE00] mb-1 tracking-widest uppercase text-left">Nome Evento</label>
                      <input type="text" placeholder="ES. SATURDAY NIGHT" className="p-4 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00]" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} required />
                    </div>
                    
                    <div className="flex flex-col">
                      <label className="text-[10px] text-[#FFEE00] mb-1 tracking-widest uppercase text-left">Tipologia Evento</label>
                      <div className="relative">
                        <select 
                          className="w-full p-4 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00] appearance-none cursor-pointer"
                          value={eventForm.category}
                          onChange={e => setEventForm({...eventForm, category: e.target.value})}
                          required
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                        <Tag size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-[#FFEE00] mb-1 tracking-widest uppercase text-left">Data (Auto-link slot)</label>
                      <input type="date" className="p-4 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00]" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} required />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] text-[#FFEE00] mb-1 tracking-widest uppercase text-left">Luogo / Location</label>
                      <div className="relative">
                        <input type="text" placeholder="ES. VILLA D'ESTE" className="p-4 pl-12 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00] w-full" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} required />
                        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-col">
                   <label className="text-[10px] text-[#FFEE00] mb-1 tracking-widest uppercase text-left">Info & Listino prezzi</label>
                   <textarea placeholder="DESCRIZIONE COMPLETA..." className="p-4 bg-zinc-900 border border-zinc-700 font-bold text-white h-40 outline-none focus:border-[#FFEE00] resize-none" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} required />
                 </div>

                 <button type="submit" disabled={loading} className={`bg-[#FFEE00] text-black font-black py-4 mt-2 text-2xl uppercase italic shadow-[4px_4px_0px_#FFF] ${loading ? 'opacity-50' : 'hover:scale-[1.01] transition-transform'}`}>{loading ? 'PUBBLICAZIONE...' : 'CONFERMA E PUBBLICA'}</button>
               </div>
             </form>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {events.map(ev => (
                 <div key={ev.id} className={`border-4 p-4 flex flex-col justify-between shadow-[8px_8px_0px_#000] text-left ${ev.isCancelled ? 'bg-red-50 border-red-600' : 'bg-white border-black'}`}>
                   <div>
                     {ev.imageUrl && (
                       <div className="relative w-full mb-3">
                         <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto object-contain border-2 border-black" />
                         {ev.isCancelled && (
                           <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                             <p className="text-red-500 font-black text-xl italic uppercase rotate-[-12deg] border-4 border-red-600 px-4 py-2">EVENTO ANNULLATO</p>
                           </div>
                         )}
                         {ev.isPriveSoldOut && !ev.isCancelled && (
                           <div className="absolute bottom-2 right-2 bg-black/80 text-amber-400 font-black text-[8px] px-2 py-1 border border-amber-400/50 uppercase tracking-widest">
                             Sold out Privé
                           </div>
                         )}
                       </div>
                     )}
                     <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-3xl font-black italic uppercase leading-none mb-1">{ev.title}</p>
                          <div className="flex items-center gap-2">
                             <p className="font-bold text-zinc-400 text-[10px] tracking-widest">{ev.date}</p>
                             {ev.location && <span className="text-zinc-500 text-[10px] font-black uppercase flex items-center gap-1">• <MapPin size={10}/> {ev.location}</span>}
                          </div>
                        </div>
                        <span className="bg-black text-[#FFEE00] px-2 py-1 text-[10px] font-black italic">{ev.category || 'DISCOTECA'}</span>
                     </div>
                     {ev.description && <p className="text-xs font-bold text-zinc-800 bg-zinc-50 p-2 border border-zinc-200 h-24 overflow-y-auto whitespace-pre-wrap">{ev.description}</p>}
                   </div>
                   <button
                     onClick={() => setPriveManageEvent(ev)}
                     className="w-full p-3 border-2 border-black bg-[#FFEE00] text-black flex justify-center items-center gap-2 font-black uppercase text-xs shadow-[3px_3px_0px_#000] active:translate-y-1 transition-all mt-4"
                   >
                     <Crown size={16} /> GESTIONE PRIVÉ
                     {(ev.priveTypes || []).length > 0 && (
                       <span className="bg-black text-[#FFEE00] text-[9px] px-1.5 py-0.5 rounded-sm ml-1">
                         {ev.priveTypes.length} TIPI
                       </span>
                     )}
                   </button>
                   <div className="grid grid-cols-2 gap-3 mt-3">
                     <button
                       onClick={() => handleToggleCancelled(ev)}
                       disabled={loading}
                       className={`p-3 border-2 border-black flex justify-center items-center gap-2 font-black uppercase text-xs shadow-[3px_3px_0px_#000] active:translate-y-1 transition-all ${ev.isCancelled ? 'bg-zinc-900 text-[#FFEE00]' : 'bg-red-600 text-white'}`}
                     >
                       <Ban size={16} /> {ev.isCancelled ? 'RIATTIVA' : 'ANNULLA'}
                     </button>
                     <button
                       onClick={() => handleTogglePriveSoldOut(ev)}
                       disabled={loading}
                       className={`p-3 border-2 border-black flex justify-center items-center gap-2 font-black uppercase text-xs shadow-[3px_3px_0px_#000] active:translate-y-1 transition-all ${ev.isPriveSoldOut ? 'bg-zinc-200 text-zinc-600' : 'bg-amber-400 text-black'}`}
                     >
                       <Crown size={16} /> {ev.isPriveSoldOut ? 'PRIVÉ OK' : 'SOLD OUT PRIVÉ'}
                     </button>
                   </div>
                   <button onClick={() => handleConcludiSerata(ev.id)} className="w-full p-4 bg-black text-white border-2 border-black mt-3 flex justify-center items-center gap-2 font-black shadow-[4px_4px_0px_#FFEE00] uppercase text-sm active:translate-y-1 transition-all"><Trash2 size={20}/> ARCHIVIA SERATA</button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* TAB 4: SPONSOR */}
        {activeTab === 'sponsors' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-[#FFEE00] border-4 border-black p-6 mb-8 shadow-[8px_8px_0px_#000] text-left"><h2 className="text-xl font-black mb-2 uppercase italic flex items-center gap-2"><Gift/> Gestione Gratta e Vinci</h2><p className="text-xs font-bold leading-tight uppercase">Definisci i premi e le probabilità di vincita per attirare clienti.</p></div>
            <p className="text-center font-black opacity-20 py-20 italic border-4 border-dashed border-black">SEZIONE IN FASE DI AGGIORNAMENTO...</p>
          </div>
        )}
      </div>

      {/* PASSWORD ADMIN */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border-4 border-[#FFEE00] p-6 w-full max-w-sm shadow-[10px_10px_0px_#FFEE00]">
            <div className="flex justify-between items-start mb-6 border-b-4 border-zinc-800 pb-4 text-left">
              <h2 className="text-2xl font-black italic uppercase text-white">Security Vault</h2>
              <button onClick={() => setPasswordModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]"><X size={24} /></button>
            </div>
            <input type="text" placeholder="NUOVA PASSWORD" className="w-full p-4 bg-black border border-zinc-700 text-white font-bold uppercase mb-6 focus:border-[#FFEE00] outline-none text-center" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
            <button onClick={handleSavePassword} disabled={loading} className="w-full bg-[#FFEE00] text-black font-black p-4 uppercase border-2 border-black shadow-[4px_4px_0px_#FFF]">{loading ? '...' : 'SALVA PASSWORD'}</button>
          </div>
        </div>
      )}

      {/* DETTAGLIO FINANZIARIO */}
      {selectedEventForModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-[10px_10px_0px_#FFEE00]">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <div><p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic">Profitability Report</p><h2 className="text-2xl font-black italic uppercase leading-none mt-1">{events.find(e => e.id === selectedEventForModal)?.title}</h2></div>
              <button onClick={() => setSelectedEventForModal(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]"><X size={24} /></button>
            </div>
            <table className="w-full border-collapse border-2 border-black">
              <thead className="bg-black text-white uppercase text-[10px] italic">
                <tr><th className="p-3 text-left border-r border-zinc-700">PR</th><th className="p-3 text-center border-r border-zinc-700">IN</th><th className="p-3 text-right text-[#FFEE00]">LORDO</th></tr>
              </thead>
              <tbody>
                {activePrs.filter(p => p.id === 'MASTER' || p.eventIds?.includes(selectedEventForModal)).map(p => {
                   const finEv = calculatePrFinancialsForEvent(p, selectedEventForModal);
                   if (finEv.evIns === 0 && finEv.supervisorBonusEv === 0 && p.id !== 'MASTER') return null;
                   return (
                     <tr key={p.id} className="border-b-2 border-black text-sm font-bold uppercase hover:bg-zinc-50 text-left">
                       <td className="p-3 border-r-2 border-black">{p.name}<span className="block text-[9px] text-zinc-400 italic font-medium">ID: {p.id}</span></td>
                       <td className="p-3 border-r-2 border-black text-center text-xl font-black italic">{finEv.evIns}</td>
                       <td className="p-3 text-right text-red-600 text-lg font-black">€{finEv.guadagnoTotaleEv.toFixed(2)}</td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
            <button onClick={() => setSelectedEventForModal(null)} className="w-full mt-6 bg-black text-white font-black py-4 uppercase border-2 border-black active:translate-y-1 transition-all">CHIUDI REPORT</button>
          </div>
        </div>
      )}

      {/* BILANCIO MASTER */}
      {profitsModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <div><p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Global Profits</p><h2 className="text-2xl font-black italic uppercase leading-none mt-1 flex items-center gap-2"><Wallet size={24}/> Bilancio Master</h2></div>
              <button onClick={() => setProfitsModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]"><X size={24} /></button>
            </div>
            <div className="mb-8 border-4 border-black p-5 bg-zinc-50 text-left">
              <h3 className="font-black text-lg mb-4 uppercase underline decoration-[#FFEE00] decoration-4 italic">Cassa Generale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-zinc-500">Master Dirette</span><span className="font-black">€{masterFin.directTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-zinc-500">Bonus Team</span><span className="font-black text-green-600">€{masterFin.supervisorBonus.toFixed(2)}</span></div>
                  <div className="flex justify-between mb-4"><span className="text-[10px] font-black uppercase text-zinc-500">Consolidati Orfani</span><span className="font-black text-blue-600">€{historicalOrphanProfit.toFixed(2)}</span></div>
                  <div className="bg-black text-white p-3 mb-2 flex justify-between items-center"><span className="text-xs font-black uppercase text-[#FFEE00]">Tot. Lordo</span><span className="text-xl font-black italic">€{guadagnoLordoMaster.toFixed(2)}</span></div>
                  <div className="bg-red-50 text-red-600 p-3 border-2 border-red-600 flex justify-between items-center"><span className="text-xs font-black uppercase">Prelievi</span><span className="text-xl font-black italic">- €{accontoAttualeMaster.toFixed(2)}</span></div>
                </div>
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0px_#000]">
                  <p className="text-[10px] font-black uppercase text-zinc-500 italic">Disponibilità Netta</p>
                  <p className="text-4xl font-black italic text-green-600 mb-4 tracking-tighter">€{daPagareMaster.toFixed(2)}</p>
                  <input type="number" step="0.01" max={daPagareMaster} placeholder="Importo" className="w-full p-2 border-2 border-black font-black uppercase text-center focus:border-[#FFEE00] outline-none mb-2" value={masterPayAmount} onChange={e => setMasterPayAmount(e.target.value)} />
                  <button onClick={eseguiPagamentoMaster} className="bg-black text-[#FFEE00] font-black p-2 uppercase active:scale-95 transition-transform w-full">REGISTRA PRELIEVO</button>
                </div>
              </div>
            </div>
            <button onClick={handleAzzeraContabilitaMaster} className="w-full font-black p-4 uppercase border-2 border-red-600 text-red-600 hover:bg-red-50 transition-all italic">RESET TOTALE STAGIONE</button>
          </div>
        </div>
      )}

      {/* ALIAS MASTER */}
      {masterModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <h2 className="text-2xl font-black italic uppercase">Master Alias Registry</h2>
              <button onClick={() => setMasterModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] transition-all"><X size={24} /></button>
            </div>
            <div className="flex flex-col gap-3 mb-6">
                {prs.filter(p => p.mergedInto === 'MASTER').map(alias => (
                    <div key={alias.id} className="border-2 border-black p-3 bg-zinc-50 flex justify-between items-center text-left">
                        <p className="font-black uppercase">{alias.name} <span className="text-zinc-400 italic text-[10px]">({alias.id})</span></p>
                        <button onClick={() => handleDeleteAlias(alias.id)} className="bg-red-600 text-white p-2 border border-black active:scale-95"><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
            <button onClick={() => setMasterModalOpen(false)} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase italic">CHIUDI FINESTRA</button>
          </div>
        </div>
      )}

      {/* PAGAMENTO PR */}
      {payPrData && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <div><p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">PR Settlement</p><h2 className="text-2xl font-black italic uppercase leading-none mt-1">{payPrData.name}</h2></div>
              <button onClick={() => setPayPrData(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 transition-all"><X size={24} /></button>
            </div>
            {(() => {
              const fin = calculatePrFinancials(payPrData);
              const accontoAttuale = Number(payPrData.acconto) || 0;
              const daPagare = Math.max(0, fin.guadagnoLordo - accontoAttuale);
              return (
                <div className="flex flex-col gap-4 text-left">
                  <div className="bg-zinc-100 p-4 border-2 border-black">
                    <div className="flex justify-between mb-2"><span className="text-sm font-black uppercase">Residuo Netto:</span><span className="text-2xl font-black text-red-600 italic tracking-tighter">€{daPagare.toFixed(2)}</span></div>
                  </div>
                  <input type="number" step="0.01" max={daPagare} placeholder="Importo da Versare" className="w-full p-4 border-2 border-black font-black uppercase text-xl outline-none text-center" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  <button onClick={eseguiPagamento} disabled={loading || daPagare <= 0} className="w-full bg-[#FFEE00] text-black font-black p-4 uppercase border-2 border-black shadow-[4px_4px_0px_#000] active:scale-95 transition-all">CONFERMA PAGAMENTO</button>
                  <button onClick={() => handleAzzeraContabilita(payPrData)} className="w-full font-black text-[10px] p-3 border-2 border-red-600 text-red-600 uppercase italic">AZZERA CONTABILITÀ PR</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* SOSTITUZIONE */}
      {replacePrData && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-3xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <h2 className="text-2xl font-black italic uppercase leading-none">Gestione PR: {replacePrData.name}</h2>
              <button onClick={() => setReplacePrData(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] transition-all"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
               <div className="border-4 border-black p-6 bg-zinc-50 flex flex-col justify-between">
                  <h3 className="font-black text-lg mb-2 uppercase underline decoration-[#FFEE00] decoration-4 italic">Sostituzione (Nuovo PR)</h3>
                  <input type="text" placeholder="NUOVO NOME" className="w-full p-3 border-2 border-black mb-4 font-black uppercase outline-none" value={replaceName} onChange={e => setReplaceName(e.target.value)} />
                  <input type="tel" placeholder="TELEFONO" className="w-full p-3 border-2 border-black mb-4 font-black outline-none" value={replacePhone} onChange={e => setReplacePhone(e.target.value)} />
                  <button onClick={() => eseguiSostituzioneNuovo(replacePrData)} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase active:translate-y-1 transition-all shadow-[4px_4px_0px_#FFEE00]">AGGIORNA ANAGRAFICA</button>
               </div>
               <div className="border-4 border-black p-6 bg-zinc-50 flex flex-col justify-between">
                  <h3 className="font-black text-lg mb-2 uppercase underline decoration-[#FFEE00] decoration-4 italic">Ingloba in Esistente</h3>
                  <select className="w-full p-3 border-2 border-black mb-4 font-black uppercase outline-none bg-white cursor-pointer" value={replaceTargetId} onChange={e => setReplaceTargetId(e.target.value)}>
                     <option value="">-- SELEZIONA PR --</option>
                     {activePrs.filter(p => p.id !== replacePrData.id && p.id !== 'MASTER').map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id})</option>))}
                  </select>
                  <button onClick={() => eseguiSostituzioneIngloba(replacePrData)} className="w-full bg-red-600 text-white font-black p-4 uppercase active:translate-y-1 transition-all shadow-[4px_4px_0px_#000]">ESAGUI FUSIONE</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* GESTIONE PRIVÉ */}
      {priveManageEvent && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[10px_10px_0px_#FFEE00]">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4 text-left">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic">Configurazione Privé</p>
                <h2 className="text-2xl font-black italic uppercase leading-none mt-1">{priveManageEvent.title}</h2>
              </div>
              <button onClick={() => { setPriveManageEvent(null); setPriveForm({ name: '', price: '', inclusions: '' }); }} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]"><X size={24} /></button>
            </div>

            {/* Form nuovo tipo privé */}
            <div className="bg-zinc-100 border-2 border-black p-5 mb-6">
              <h3 className="font-black uppercase text-sm mb-4 flex items-center gap-2 italic"><Plus size={16} /> Aggiungi Tipo Privé</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nome Tavolo</label>
                  <input
                    type="text" placeholder="ES. STANDARD, VIP REGIA, PALCO..."
                    className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00]"
                    value={priveForm.name} onChange={e => setPriveForm({ ...priveForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Prezzo Totale Tavolo (€)</label>
                  <input
                    type="number" min="0" step="10" placeholder="ES. 200"
                    className="p-3 border-2 border-black font-bold outline-none focus:border-[#FFEE00]"
                    value={priveForm.price} onChange={e => setPriveForm({ ...priveForm, price: e.target.value })}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Incluso (Opzionale)</label>
                  <input
                    type="text" placeholder="ES. BOTTIGLIA DI PROSECCO INCLUSA"
                    className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00]"
                    value={priveForm.inclusions} onChange={e => setPriveForm({ ...priveForm, inclusions: e.target.value })}
                  />
                </div>
                <button
                  onClick={() => handleSavePriveType(priveManageEvent)}
                  className="bg-black text-[#FFEE00] font-black p-3 uppercase hover:bg-zinc-800 transition-all shadow-[3px_3px_0px_#FFEE00] flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> AGGIUNGI TIPO
                </button>
              </div>
            </div>

            {/* Lista tipi esistenti */}
            <h3 className="font-black uppercase text-xs text-zinc-500 tracking-widest mb-3 italic">Tipi Configurati</h3>
            {(priveManageEvent.priveTypes || []).length === 0 ? (
              <p className="text-center text-zinc-400 font-black italic uppercase text-xs py-10 border-2 border-dashed border-zinc-300">
                Nessun tipo privé configurato
              </p>
            ) : (
              <div className="space-y-3">
                {(priveManageEvent.priveTypes || []).map(pt => (
                  <div key={pt.id} className={`border-2 ${pt.available !== false ? 'border-black bg-white' : 'border-zinc-300 bg-zinc-50 opacity-60'} p-4 flex items-center justify-between gap-4 text-left`}>
                    <div className="flex-1">
                      <p className="font-black uppercase text-lg leading-none">{pt.name}</p>
                      <p className="text-2xl font-black mt-1">
                        <span className="bg-black text-[#FFEE00] px-2 py-0.5 inline-block">€{pt.price}</span>
                      </p>
                      {pt.inclusions && <p className="text-xs font-bold text-zinc-500 mt-1 italic normal-case">{pt.inclusions}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleTogglePriveAvailability(priveManageEvent, pt.id, pt.available)}
                        className={`text-[10px] font-black border-2 border-black p-2 uppercase min-w-[52px] text-center shadow-[2px_2px_0px_#000] ${pt.available !== false ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-600'}`}
                      >
                        {pt.available !== false ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => handleDeletePriveType(priveManageEvent, pt.id)}
                        className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => { setPriveManageEvent(null); setPriveForm({ name: '', price: '', inclusions: '' }); }}
              className="w-full mt-6 bg-black text-[#FFEE00] font-black p-4 uppercase border-2 border-black shadow-[4px_4px_0px_#FFEE00] italic"
            >
              CHIUDI E SALVA
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;