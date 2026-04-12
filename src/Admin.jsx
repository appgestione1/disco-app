import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { 
  collection, getDocs, updateDoc, 
  deleteDoc, doc, setDoc, query, orderBy, getDoc 
} from 'firebase/firestore';
import { 
  Users, Calendar, Ticket, Gift, Trash2, 
  Plus, Save, RefreshCw, Phone, BarChart, DollarSign, Award, X, Lock, Wallet, Calculator
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

  const [prForm, setPrForm] = useState({ name: '', phone: '', supervisorId: '' });
  const [autoPrCode, setAutoPrCode] = useState('PR001'); 
  const [eventForm, setEventForm] = useState({ title: '', date: '', description: '' }); 
  const [selectedFile, setSelectedFile] = useState(null);

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
              title: eventForm.title, date: eventForm.date, description: eventForm.description,
              imageUrl: canvas.toDataURL('image/jpeg', 0.7), active: true, timestamp: new Date()
            });
            setEventForm({ title: '', date: '', description: '' }); setSelectedFile(null); await fetchData();
          } catch (dbError) { alert("Errore salvataggio database."); } finally { setLoading(false); }
        };
      };
      reader.readAsDataURL(selectedFile);
    } catch (e) { setLoading(false); }
  };

  const orphanedTickets = tickets.filter(t => {
    if (t.clearedFromMaster) return false; 
    if (t.used !== true) return false; 

    const evExists = events.some(e => e.id === t.eventId);
    if (!evExists) return false; 

    const pr = activePrs.find(p => p.id === t.prId || p.aliases?.includes(t.prId));
    
    if (!pr) return true; 

    if (pr.id === 'MASTER') return false; 
    return !pr.eventIds?.includes(t.eventId);
  });

  const orphansByEvent = orphanedTickets.reduce((acc, t) => {
    if (!acc[t.eventId]) acc[t.eventId] = [];
    acc[t.eventId].push(t);
    return acc;
  }, {});

  const handleClearOrphans = async () => {
    if (orphanedTickets.length === 0) return;
    setLoading(true);
    try {
      const masterRef = doc(db, "prs_registry", "MASTER");
      const masterSnap = await getDoc(masterRef);
      const currentOrphans = Number(masterSnap.data()?.historicalOrphanCount) || 0;
      const currentProfit = Number(masterSnap.data()?.historicalOrphanProfit) || 0;

      let additionalProfit = 0;
      for (const eventId in orphansByEvent) {
         additionalProfit += (orphansByEvent[eventId].length * (Number(orphanValues[eventId]) || 0));
      }

      await updateDoc(masterRef, { 
        historicalOrphanCount: currentOrphans + orphanedTickets.length,
        historicalOrphanProfit: currentProfit + additionalProfit
      }, { merge: true });
      
      for (const t of orphanedTickets) if (t.id) await updateDoc(doc(db, "tickets", t.id), { clearedFromMaster: true });
      setOrphanValues({}); await fetchData();
    } catch (e) { alert("Errore consolidamento."); } finally { setLoading(false); }
  };

  const handleConcludiSerata = async (eventId) => {
    const eventTitle = events.find(e => e.id === eventId)?.title || "questo evento";
    const conferma = window.confirm(`ATTENZIONE!\nSei sicuro di voler concludere ${eventTitle}?\n\nGli slot verranno svuotati. Se ci sono ticket orfani per questa serata, ti verrà chiesto di assegnargli un valore prima della chiusura.`);
    if (!conferma) return;
    setLoading(true);
    try {
      const eventOrphans = orphanedTickets.filter(t => t.eventId === eventId);
      if (eventOrphans.length > 0) {
        const valStr = window.prompt(`Ci sono ${eventOrphans.length} ticket orfani per questa serata.\nQuanto hai guadagnato (in €) per singolo ingresso orfano?`, "0");
        const profitToAdd = eventOrphans.length * (Number(valStr) || 0);

        const masterRef = doc(db, "prs_registry", "MASTER");
        const masterSnap = await getDoc(masterRef);
        await updateDoc(masterRef, { 
          historicalOrphanCount: (Number(masterSnap.data()?.historicalOrphanCount) || 0) + eventOrphans.length,
          historicalOrphanProfit: (Number(masterSnap.data()?.historicalOrphanProfit) || 0) + profitToAdd
        }, { merge: true });

        for (const t of eventOrphans) if (t.id) await updateDoc(doc(db, "tickets", t.id), { clearedFromMaster: true });
      }

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
  let totalPrCosts = 0;
  activePrs.forEach(p => { totalPrCosts += calculatePrFinancials(p).guadagnoLordo; });

  return (
    <div className="min-h-screen bg-zinc-50 text-black font-sans pb-20 uppercase font-black">
      
      {/* HEADER DASHBOARD */}
      <div className="bg-black text-white p-5 sticky top-0 z-50 flex justify-between items-center border-b-4 border-[#FFEE00]">
        <div>
          <h1 className="font-black italic text-2xl leading-none">ADMIN PANEL</h1>
          <p className="text-[10px] font-bold text-[#FFEE00] tracking-[0.3em]">VERSION 5.0 LIVE</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setPasswordModalOpen(true)} className="bg-zinc-800 text-white p-2 rounded-full border-2 border-zinc-600 hover:bg-zinc-700">
            <Lock size={24} />
          </button>
          <button onClick={fetchData} className={`bg-[#FFEE00] text-black p-2 rounded-full ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={24} />
          </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_#000]"><Ticket className="mb-2 text-zinc-400" /><p className="text-[10px] font-black uppercase">Pass Generati Totali</p><p className="text-5xl font-black italic">{tickets.length}</p></div>
              <div className="bg-[#FFEE00] border-4 border-black p-5 shadow-[6px_6px_0px_#000]"><Users className="mb-2 text-black" /><p className="text-[10px] font-black uppercase">Ingressi Effettivi Totali</p><p className="text-5xl font-black italic">{totalScanned}</p></div>
              <div className="bg-black text-white border-4 border-black p-5 shadow-[6px_6px_0px_#FFEE00]"><Award className="mb-2 text-[#FFEE00]" /><p className="text-[10px] font-black uppercase text-[#FFEE00]">Drink Vinti Totali</p><p className="text-5xl font-black italic">{totalWon}</p></div>
              <div className="bg-white border-4 border-red-600 p-5 shadow-[6px_6px_0px_#dc2626]"><DollarSign className="mb-2 text-red-600" /><p className="text-[10px] font-black uppercase text-red-600">Costo Stimato PR LORDO</p><p className="text-5xl font-black italic">€{totalPrCosts.toFixed(2)}</p></div>
            </div>

            <h2 className="text-2xl font-black italic mb-6 underline uppercase">Dati Live per Singola Serata</h2>
            <div className="flex flex-col gap-6">
               {events.map(ev => {
                 const evTickets = tickets.filter(t => t.eventId === ev.id);
                 const passGenerati = evTickets.length;
                 const drinkVinti = evTickets.filter(t => t.won === true).length;
                 const ingressiEffettivi = evTickets.filter(t => t.used === true).length;
                 
                 const evPrs = prs.filter(p => !p.mergedInto && (p.id === 'MASTER' || p.eventIds?.includes(ev.id) || p.eventId === ev.id));
                 
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
                         <p className="font-bold text-zinc-400 text-xs mb-6 uppercase">{ev.date}</p>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                           <div className="bg-zinc-100 border-2 border-black p-3"><p className="text-[10px] font-black uppercase text-zinc-500">Pass Generati</p><p className="text-3xl font-black italic">{passGenerati}</p></div>
                           <div className="bg-[#FFEE00] border-2 border-black p-3"><p className="text-[10px] font-black uppercase">Ingressi Effettivi</p><p className="text-3xl font-black italic">{ingressiEffettivi}</p></div>
                           <div className="bg-black text-white border-2 border-black p-3"><p className="text-[10px] font-black uppercase text-[#FFEE00]">Drink Vinti</p><p className="text-3xl font-black italic">{drinkVinti}</p></div>
                           <div className="bg-red-50 border-2 border-red-600 p-3"><p className="text-[10px] font-black uppercase text-red-600">Costo PR LORDO</p><p className="text-3xl font-black italic text-red-600">€{costoPR.toFixed(2)}</p></div>
                         </div>
                       </div>
                       <button onClick={() => setSelectedEventForModal(ev.id)} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase flex justify-center items-center gap-2 shadow-[4px_4px_0px_#FFEE00] active:translate-y-1 active:shadow-[0px_0px_0px_#FFEE00] transition-all">
                         <BarChart size={20} /> VEDI DETTAGLIO FINANZIARIO PR
                       </button>
                     </div>
                   </div>
                 );
               })}
               {events.length === 0 && <p className="font-black italic opacity-50 py-10 text-center uppercase">Nessuna serata in corso</p>}
            </div>
          </div>
        )}

        {/* TAB 2: TEAM PR */}
        {activeTab === 'prs' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={handleAddPr} className="bg-white border-4 border-black p-6 mb-10 shadow-[8px_8px_0px_#000]">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase"><Plus size={24}/> NUOVO COLLABORATORE</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Codice Automatico</label><input type="text" value={autoPrCode} className="p-3 border-2 border-black font-black bg-zinc-100 text-zinc-500 cursor-not-allowed outline-none" readOnly /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nome Completo *</label><input type="text" placeholder="Es. Mario Rossi" className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00]" value={prForm.name} onChange={e => setPrForm({...prForm, name: e.target.value})} required /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Telefono</label><input type="tel" placeholder="Es. 3331234567" className="p-3 border-2 border-black font-bold outline-none focus:border-[#FFEE00]" value={prForm.phone} onChange={e => setPrForm({...prForm, phone: e.target.value})} /></div>
                <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Supervisore (Opzionale)</label>
                  <select className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00] bg-white" value={prForm.supervisorId} onChange={e => setPrForm({...prForm, supervisorId: e.target.value})}>
                    <option value="">-- NESSUN SUPERVISORE --</option>
                    {activePrs.filter(p => p.id !== 'MASTER').map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                  </select>
                </div>
              </div>
              <button className="w-full mt-6 bg-black text-white font-black py-4 uppercase hover:bg-[#FFEE00] hover:text-black transition-all shadow-[4px_4px_0px_#FFEE00] active:translate-y-1 active:shadow-none">SALVA NEL TEAM</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-4 border-black bg-white">
                <thead>
                  <tr className="bg-black text-white">
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

                    // Pre-calcoli
                    const fin = isMaster ? masterFin : calculatePrFinancials(pr);
                    const guadagnoLordo = isMaster ? guadagnoLordoMaster : fin.guadagnoLordo;
                    const acconto = Number(pr.acconto) || 0;
                    const guadagnoTotale = Math.max(0, guadagnoLordo - acconto);

                    return (
                      <tr key={pr.id} className="border-b-2 border-black hover:bg-[#FFEE00]/10">
                        <td className="p-4 border-r-2 border-black align-top">
                          <p className="font-black text-lg leading-none">{pr.name}</p>
                          {pr.phone && <p className="text-xs font-bold opacity-50 flex items-center gap-1 mt-1"><Phone size={10}/> {pr.phone}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black italic px-2 py-1 rounded ${isMaster ? 'bg-[#FFEE00] text-black' : 'bg-black text-[#FFEE00]'}`}>ID: {pr.id}</span>
                            {isMaster && <span className="text-[10px] font-black italic bg-green-600 text-white px-2 py-1 rounded shadow-[2px_2px_0px_#000]">TUTTI GLI EVENTI</span>}
                            {pr.aliases && pr.aliases.length > 0 && <span className="text-[10px] font-black italic bg-purple-600 text-white px-2 py-1 rounded shadow-[2px_2px_0px_#000]">ALIAS: {pr.aliases.join(', ')}</span>}
                            {!isMaster && <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${pr.id}`); alert("Link copiato! Invialo a " + pr.name + " per fargli usare l'app."); }} className="text-[10px] font-black underline cursor-pointer text-blue-600 hover:text-blue-800 uppercase">Copia Link App</button>}
                          </div>
                        </td>
                        
                        <td className="p-4 border-r-2 border-black text-xs font-bold uppercase align-top">
                          {pr.supervisorId && !isMaster ? (
                            <>
                              <span className="block text-sm text-black">{supNameText}</span>
                              <div className="mt-2 flex items-center h-[26px]">
                                <span className="text-[9px] text-zinc-500 whitespace-nowrap mr-2">BONUS:</span>
                                <InlinePayInput 
                                   initialValue={pr.supervisorPay} 
                                   onSave={(val) => handleUpdateSupervisorPay(pr.id, val)}
                                   placeholder="0.00"
                                />
                              </div>
                            </>
                          ) : 'NESSUNO'}
                        </td>
                        
                        <td className="p-2 border-r-2 border-black align-top">
                          {isMaster ? (
                            <div className="flex flex-col gap-1">
                              {events.map(ev => (
                                <div key={ev.id} className="h-[26px] flex items-center">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[160px]" title={ev.title}>{ev.title}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {[0, 1, 2, 3, 4, 5].map(i => {
                                const selectedEventId = pr.eventIds?.[i] || "";
                                const currentPay = pr.eventPays?.[i] || "";
                                return (
                                  <div key={i} className="h-[26px] flex items-stretch gap-1">
                                    <select 
                                      className="w-28 bg-white border-2 border-black text-[10px] font-bold uppercase px-1 cursor-pointer outline-none h-full"
                                      value={selectedEventId}
                                      onChange={(e) => handleUpdatePrEventSlot(pr.id, i, e.target.value, pr.eventIds)}
                                      disabled={loading}
                                    >
                                      <option value="">-- VUOTO --</option>
                                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                                    </select>
                                    {selectedEventId && (
                                      <InlinePayInput 
                                         initialValue={currentPay} 
                                         onSave={(val) => handleUpdateEventPay(pr.id, i, val, pr.eventPays)}
                                         placeholder="0.00"
                                      />
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        
                        <td className="p-2 border-r-2 border-black align-top text-center">
                          {isMaster ? (
                            <div className="flex flex-col gap-1">
                               {events.map(ev => {
                                 const evIns = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === ev.id && t.used === true).length;
                                 return (
                                  <div key={ev.id} className="h-[26px] flex items-center justify-center w-full">
                                     {evIns > 0 ? <span className="bg-black text-[#FFEE00] px-2 py-1 rounded-sm font-black text-[14px] leading-none shadow-[2px_2px_0px_#000] shrink-0">{evIns}</span> : <span className="text-black font-black text-[14px] leading-none shrink-0">0</span>}
                                  </div>
                                 )
                               })}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {[0, 1, 2, 3, 4, 5].map(i => {
                                const selectedEventId = pr.eventIds?.[i] || "";
                                if (!selectedEventId) return <div key={i} className="h-[26px] flex items-center justify-center"></div>;
                                
                                const evIns = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === selectedEventId && t.used === true).length;
                                return (
                                  <div key={i} className="h-[26px] flex items-center justify-center w-full">
                                     {evIns > 0 ? <span className="bg-black text-[#FFEE00] px-2 py-1 rounded-sm font-black text-[14px] leading-none shadow-[2px_2px_0px_#000] shrink-0">{evIns}</span> : <span className="text-black font-black text-[14px] leading-none shrink-0">0</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        
                        <td className="p-2 border-r-2 border-black align-top text-right">
                          {isMaster ? (
                            <div className="flex flex-col gap-1">
                               {events.map(ev => {
                                 const finEv = calculatePrFinancialsForEvent(pr, ev.id);
                                 return (
                                  <div key={ev.id} className="h-[26px] flex items-center justify-end w-full">
                                     {finEv.guadagnoTotaleEv > 0 ? <span className="text-black font-black text-[14px] leading-none shrink-0">€{finEv.guadagnoTotaleEv.toFixed(2)}</span> : <span className="text-black font-black text-[14px] leading-none shrink-0">€0.00</span>}
                                  </div>
                                 )
                               })}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {[0, 1, 2, 3, 4, 5].map(i => {
                                const selectedEventId = pr.eventIds?.[i] || "";
                                if (!selectedEventId) return <div key={i} className="h-[26px] flex items-center justify-end"></div>;
                                
                                const finEv = calculatePrFinancialsForEvent(pr, selectedEventId);
                                return (
                                  <div key={i} className="h-[26px] flex items-center justify-end w-full">
                                     {finEv.guadagnoTotaleEv > 0 ? <span className="text-black font-black text-[14px] leading-none shrink-0">€{finEv.guadagnoTotaleEv.toFixed(2)}</span> : <span className="text-black font-black text-[14px] leading-none shrink-0">€0.00</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        
                        <td className="p-4 text-center align-top bg-zinc-50">
                          <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-red-600 leading-none">€{guadagnoTotale.toFixed(2)}</span>
                            {acconto > 0 && <span className="text-[10px] font-black text-zinc-400 mt-1 uppercase leading-none">Cassa Tot: €{guadagnoLordo.toFixed(2)}</span>}
                          </div>
                          
                          <div className="flex flex-col gap-2 items-center mt-3">
                            {isMaster ? (
                                <>
                                <button onClick={() => setProfitsModalOpen(true)} className="bg-green-600 text-white text-[10px] font-black border-2 border-black p-2 hover:bg-green-700 transition-colors uppercase w-full shadow-[2px_2px_0px_#000] active:translate-y-px active:shadow-none flex items-center justify-center gap-1">
                                  <Calculator size={12}/> CONTEGGI {orphanedTickets.length > 0 && <span className="bg-[#FFEE00] text-black rounded-full px-1.5 ml-1">{orphanedTickets.length}</span>}
                                </button>
                                <button onClick={() => setMasterModalOpen(true)} className="bg-purple-600 text-white text-[10px] font-black border-2 border-black p-2 hover:bg-purple-700 transition-colors uppercase w-full shadow-[2px_2px_0px_#000] active:translate-y-px active:shadow-none">MODIFICA ALIAS</button>
                                </>
                            ) : (
                                <>
                                <button onClick={() => { setPayPrData(pr); setPayAmount(''); }} className="bg-[#FFEE00] text-black text-[10px] font-black border-2 border-black p-2 hover:bg-yellow-400 transition-colors uppercase w-full shadow-[2px_2px_0px_#000] active:translate-y-px active:shadow-none">VEDI E PAGA</button>
                                <button onClick={() => openReplaceModal(pr)} className="text-blue-600 text-[10px] font-black border-2 border-blue-600 p-2 hover:bg-blue-50 transition-colors uppercase w-full">Sostituisci</button>
                                </>
                            )}
                            <button onClick={() => handleDeletePr(pr)} className={`${isMaster ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-800 hover:bg-red-50'} text-red-600 transition-colors w-full border-2 border-red-600 p-2 flex justify-center`}><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {activePrs.length === 0 && <p className="font-black italic opacity-50 py-10 text-center uppercase border-2 border-t-0 border-black">Nessun PR registrato</p>}
            </div>
          </div>
        )}

        {/* TAB 3: GESTIONE SERATE */}
        {activeTab === 'events' && (
          <div className="animate-in fade-in duration-300">
             <form onSubmit={handleAddEvent} className="bg-black text-white p-6 mb-10 shadow-[8px_8px_0px_#FFEE00]">
               <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-[#FFEE00] uppercase italic"><Plus/> Carica Locandina</h2>
               <div className="grid grid-cols-1 gap-4 uppercase">
                 <div className="border-4 border-dashed border-zinc-700 p-4 text-center relative hover:bg-zinc-900 transition-colors cursor-pointer min-h-[100px] flex items-center justify-center">
                   <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
                   {selectedFile ? <span className="text-green-400 font-black">{selectedFile.name}</span> : <span className="font-black text-zinc-400">CLICCA QUI PER CARICARE LA FOTO</span>}
                 </div>
                 <input type="text" placeholder="NOME SERATA" className="p-4 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00]" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} required />
                 <input type="date" className="p-4 bg-zinc-900 border border-zinc-700 font-black text-white outline-none focus:border-[#FFEE00]" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} required />
                 <textarea placeholder="INCOLLA QUI IL TESTO (EMOJI, PREZZI, INFO...)" className="p-4 bg-zinc-900 border border-zinc-700 font-bold text-white h-40 outline-none focus:border-[#FFEE00] resize-none" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} required />
                 <button type="submit" disabled={loading} className={`bg-[#FFEE00] text-black font-black py-4 mt-2 text-2xl uppercase italic ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}>{loading ? 'CARICAMENTO IN CORSO...' : 'PUBBLICA SERATA'}</button>
               </div>
             </form>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {events.map(ev => (
                 <div key={ev.id} className="bg-white border-4 border-black p-4 flex flex-col justify-between shadow-[8px_8px_0px_#000]">
                   <div>
                     {ev.imageUrl && <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto object-contain border-2 border-black mb-3" />}
                     <p className="text-3xl font-black italic uppercase leading-none mb-1">{ev.title}</p>
                     <p className="font-bold text-zinc-400 mb-3 text-[10px] tracking-widest">{ev.date}</p>
                     {ev.description && <p className="text-xs font-bold text-zinc-800 bg-zinc-100 p-2 border border-zinc-300 h-24 overflow-y-auto whitespace-pre-wrap mb-3">{ev.description}</p>}
                   </div>
                   <button onClick={() => handleConcludiSerata(ev.id)} className="w-full p-4 bg-red-600 text-white border-2 border-black mt-4 flex justify-center items-center gap-2 font-black shadow-[4px_4px_0px_#000] uppercase text-sm active:translate-y-1 active:shadow-[0px_0px_0px_#000] transition-all"><Trash2 size={20}/> CONCLUDI SERATA E LIBERA SLOT</button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* TAB 4: SPONSOR */}
        {activeTab === 'sponsors' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-[#FFEE00] border-4 border-black p-6 mb-8"><h2 className="text-xl font-black mb-2 uppercase">Configurazione Gratta e Vinci</h2><p className="text-xs font-bold leading-tight uppercase">Definisci qui cosa vince il cliente e con quale probabilità.</p></div>
            <p className="text-center font-black opacity-20 py-20 italic">Sezione Sponsor in fase di ottimizzazione...</p>
          </div>
        )}
      </div>

      {/* POPUP MODIFICA PASSWORD ADMIN */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border-4 border-[#FFEE00] p-6 w-full max-w-sm shadow-[10px_10px_0px_#FFEE00]">
            <div className="flex justify-between items-start mb-6 border-b-4 border-zinc-800 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sicurezza</p>
                <h2 className="text-2xl font-black italic uppercase leading-none mt-1 text-white">Cambia Password</h2>
              </div>
              <button onClick={() => setPasswordModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>
            <input 
              type="text" 
              placeholder="NUOVA PASSWORD" 
              className="w-full p-4 bg-black border border-zinc-700 text-white font-bold uppercase mb-6 focus:border-[#FFEE00] outline-none text-center"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
            />
            <button onClick={handleSavePassword} disabled={loading} className="w-full bg-[#FFEE00] text-black font-black p-4 uppercase active:scale-95 transition-transform border-2 border-black shadow-[4px_4px_0px_#FFF]">{loading ? '...' : 'SALVA PASSWORD'}</button>
          </div>
        </div>
      )}

      {/* POPUP DETTAGLIO EVENTO */}
      {selectedEventForModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-[10px_10px_0px_#FFEE00]">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
              <div><p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Dettaglio Finanziario LORDO</p><h2 className="text-2xl font-black italic uppercase leading-none mt-1">{events.find(e => e.id === selectedEventForModal)?.title}</h2></div>
              <button onClick={() => setSelectedEventForModal(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>
            <table className="w-full border-collapse border-2 border-black">
              <thead className="bg-black text-white uppercase text-[10px] sm:text-xs italic">
                <tr><th className="p-3 text-left border-r border-zinc-700">COLLABORATORE</th><th className="p-3 text-center border-r border-zinc-700">IN</th><th className="p-3 text-right border-r border-zinc-700">ACCORDO</th><th className="p-3 text-right text-[#FFEE00]">TOT LORDO</th></tr>
              </thead>
              <tbody>
                {activePrs.filter(p => p.id === 'MASTER' || p.eventIds?.includes(selectedEventForModal) || p.eventId === selectedEventForModal).map(p => {
                   const finEv = calculatePrFinancialsForEvent(p, selectedEventForModal);
                   if (finEv.evIns === 0 && finEv.supervisorBonusEv === 0 && p.id !== 'MASTER') return null;

                   let supNameText = p.supervisorId;
                   if (p.supervisorId && p.id !== 'MASTER') {
                     const supObj = prs.find(s => s.id === p.supervisorId);
                     supNameText = supObj ? (supObj.mergedInto === 'MASTER' ? `MASTER (ex ${supObj.name})` : supObj.name) : p.supervisorId;
                   }
                   
                   return (
                     <tr key={p.id} className="border-b-2 border-black text-sm font-bold uppercase hover:bg-zinc-100">
                       <td className="p-3 border-r-2 border-black">{p.name}{p.supervisorId && <span className="block text-[9px] text-zinc-500 italic mt-1">SUP: {supNameText}</span>}<span className="block text-[9px] text-zinc-400 italic">ID: {p.id}</span></td>
                       <td className="p-3 border-r-2 border-black text-center text-2xl font-black italic">{finEv.evIns}</td>
                       <td className="p-3 border-r-2 border-black text-right text-[10px] text-zinc-600 leading-tight">
                         {finEv.directTotalEv > 0 && <span>ACCORDO DIRETTO<br/></span>}
                         {finEv.supervisorBonusEv > 0 && <span className="text-green-600">+ BONUS TEAM</span>}
                         {finEv.guadagnoTotaleEv === 0 && <span>NESSUN COSTO</span>}
                       </td>
                       <td className="p-3 text-right text-red-600 text-xl italic font-black">€{finEv.guadagnoTotaleEv.toFixed(2)}{finEv.supervisorBonusEv > 0 && <span className="block text-[9px] text-green-600 mt-1">di cui €{finEv.supervisorBonusEv.toFixed(2)} da team</span>}</td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
            {activePrs.filter(p => p.id === 'MASTER' || p.eventIds?.includes(selectedEventForModal) || p.eventId === selectedEventForModal).length === 0 && <div className="text-center py-10 border-2 border-t-0 border-black"><p className="font-black italic opacity-30 uppercase text-lg">Nessun PR assegnato a questa serata</p></div>}
            <button onClick={() => setSelectedEventForModal(null)} className="w-full mt-6 bg-black text-white font-black py-4 uppercase border-2 border-black active:translate-y-1 transition-all">CHIUDI FINESTRA</button>
          </div>
        </div>
      )}

      {/* POPUP BILANCIO E ORFANI (MASTER) */}
      {profitsModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Amministrazione</p>
                <h2 className="text-2xl font-black italic uppercase leading-none mt-1 flex items-center gap-2"><Wallet size={24}/> Bilancio Master</h2>
              </div>
              <button onClick={() => setProfitsModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>

            {/* SEZIONE 1: ESTRATTO CONTO E CASSA */}
            <div className="mb-8 border-4 border-black p-5 bg-zinc-50">
              <h3 className="font-black text-lg mb-4 uppercase underline decoration-[#FFEE00] decoration-4">1. Estratto Conto Generale</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-end mb-2 border-b-2 border-dashed border-zinc-300 pb-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Da Liste Dirette Master</span>
                    <span className="font-black">€{masterFin.directTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end mb-2 border-b-2 border-dashed border-zinc-300 pb-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Da Bonus Rete (Sub-PR)</span>
                    <span className="font-black text-green-600">€{masterFin.supervisorBonus.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end mb-4 border-b-2 border-dashed border-zinc-300 pb-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Da Orfani Consolidati ({historicalOrphanCount} IN)</span>
                    <span className="font-black text-blue-600">€{historicalOrphanProfit.toFixed(2)}</span>
                  </div>

                  <div className="bg-black text-white p-3 mb-2 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-[#FFEE00]">Tot. Generato</span>
                    <span className="text-xl font-black italic">€{guadagnoLordoMaster.toFixed(2)}</span>
                  </div>
                  <div className="bg-red-50 text-red-600 p-3 border-2 border-red-600 flex justify-between items-center">
                    <span className="text-xs font-black uppercase">Prelievi Effettuati</span>
                    <span className="text-xl font-black italic">- €{accontoAttualeMaster.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-white border-4 border-black p-4 flex flex-col justify-center text-center shadow-[4px_4px_0px_#000]">
                  <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Residuo Cassa Master</p>
                  <p className="text-4xl font-black italic text-green-600 mb-4">€{daPagareMaster.toFixed(2)}</p>
                  
                  <input 
                      type="number" min="0.01" step="0.01" max={daPagareMaster} placeholder="Importo Prelievo" 
                      className="w-full p-2 border-2 border-black font-black uppercase text-center focus:border-[#FFEE00] outline-none mb-2" 
                      value={masterPayAmount} onChange={e => setMasterPayAmount(e.target.value)} 
                  />
                  <button onClick={eseguiPagamentoMaster} disabled={loading || daPagareMaster <= 0} className="bg-black text-[#FFEE00] font-black p-2 uppercase active:scale-95 transition-transform w-full">REGISTRA PRELIEVO</button>
                </div>
              </div>
            </div>

            {/* SEZIONE 2: LISTA ORFANI E PREZZARIO */}
            <div className="mb-8">
              <h3 className="font-black text-lg mb-2 uppercase underline decoration-[#FFEE00] decoration-4">2. Consolidamento Orfani In Sospeso</h3>
              <p className="text-[10px] font-bold text-zinc-500 mb-4 uppercase">QR Code generati da link di PR che non sono stati assegnati alla serata in questione, o da PR eliminati. Assegna un valore economico a questi ingressi e aggiungili al bilancio Master.</p>
              
              {orphanedTickets.length === 0 ? (
                  <div className="border-2 border-black p-6 bg-zinc-50 text-center">
                    <p className="text-sm font-bold text-zinc-500 italic">Nessun ticket orfano in sospeso.</p>
                  </div>
              ) : (
                  <div className="border-4 border-black p-4 bg-zinc-50 flex flex-col gap-6">
                      {Object.entries(orphansByEvent).map(([eventId, tks]) => {
                        const evTitle = events.find(e => e.id === eventId)?.title || 'Evento Ignoto';
                        const eventTotal = tks.length * (Number(orphanValues[eventId]) || 0);

                        return (
                          <div key={eventId} className="flex flex-col gap-3 border-b-2 border-dashed border-zinc-300 pb-4 last:border-0 last:pb-0">
                              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                  <div className="flex-1 text-center md:text-left">
                                    <p className="font-black uppercase text-sm leading-tight">{evTitle}</p>
                                    <p className="text-[10px] font-bold text-zinc-500">QR Orfani Rilevati: <span className="text-black font-black bg-[#FFEE00] px-1 rounded">{tks.length} IN</span></p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 whitespace-nowrap">Valore € / IN:</label>
                                    <input 
                                      type="number" min="0" step="0.50" placeholder="Es. 15.00" 
                                      className="w-20 p-2 border-2 border-black font-black text-center focus:border-[#FFEE00] outline-none"
                                      value={orphanValues[eventId] || ''}
                                      onChange={e => setOrphanValues({...orphanValues, [eventId]: e.target.value})}
                                    />
                                  </div>
                              </div>
                              
                              <div className="bg-white border-2 border-black p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
                                  <div className="flex justify-between border-b-2 border-black pb-1 mb-1">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase">Cliente</span>
                                    <span className="text-[9px] font-black text-zinc-500 uppercase">PR di Origine</span>
                                  </div>
                                  {tks.map(t => (
                                      <div key={t.id} className="flex justify-between items-center hover:bg-zinc-100 px-1">
                                          <span className="text-xs font-bold uppercase truncate max-w-[60%]">{t.customerName || 'Sconosciuto'}</span>
                                          <span className="text-[10px] font-bold text-red-600 uppercase truncate max-w-[35%]">{t.prId}</span>
                                      </div>
                                  ))}
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-black uppercase bg-black text-white px-2 py-1">Totale Evento: €{eventTotal.toFixed(2)}</span>
                              </div>
                          </div>
                        )
                      })}
                      <button onClick={handleClearOrphans} disabled={loading} className="w-full mt-2 bg-[#FFEE00] text-black font-black p-4 uppercase border-2 border-black shadow-[4px_4px_0px_#000] active:scale-95 transition-transform">
                        {loading ? '...' : 'INCASSA E CONSOLIDA NEL BILANCIO'}
                      </button>
                  </div>
              )}
            </div>

            {/* SEZIONE 3: AZZERAMENTO STAGIONALE */}
            <div className="border-t-4 border-black pt-6">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-2 text-center">Operazioni di fine stagione</p>
              <button onClick={handleAzzeraContabilitaMaster} disabled={loading} className="w-full font-black p-4 uppercase transition-transform border-2 border-red-600 text-red-600 hover:bg-red-50 active:scale-95">
                CHIUDI ED AZZERA CONTABILITÀ MASTER
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP PAGAMENTO PR SINGOLO */}
      {payPrData && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Registra Acconto</p>
                <h2 className="text-2xl font-black italic uppercase leading-none mt-1">Paga: {payPrData.name}</h2>
                <p className="text-xs font-black bg-black text-[#FFEE00] px-2 py-1 inline-block mt-2">ID: {payPrData.id}</p>
              </div>
              <button onClick={() => setPayPrData(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>

            {(() => {
              const fin = calculatePrFinancials(payPrData);
              const accontoAttuale = Number(payPrData.acconto) || 0;
              const daPagare = Math.max(0, fin.guadagnoLordo - accontoAttuale);

              return (
                <div className="flex flex-col gap-4">
                  <div className="bg-zinc-100 p-4 border-2 border-black">
                    <p className="text-xs font-bold uppercase text-zinc-600 flex justify-between mb-1"><span>Generato Lordo:</span> <span>€{fin.guadagnoLordo.toFixed(2)}</span></p>
                    <p className="text-xs font-bold uppercase text-zinc-600 flex justify-between mb-1"><span>Acconti Precedenti:</span> <span>- €{accontoAttuale.toFixed(2)}</span></p>
                    <div className="border-t-2 border-black my-2 pt-2 flex justify-between items-center">
                      <span className="text-sm font-black uppercase">Residuo da Pagare:</span>
                      <span className="text-2xl font-black text-red-600 italic">€{daPagare.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Importo del Pagamento (€)</label>
                    <input type="number" min="0.01" step="0.01" max={daPagare} placeholder="Es. 50.00" className="w-full p-4 border-2 border-black font-black uppercase text-xl focus:border-[#FFEE00] outline-none" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  </div>

                  <button onClick={eseguiPagamento} disabled={loading || daPagare <= 0} className={`w-full font-black p-4 uppercase transition-transform mt-2 border-2 border-black shadow-[4px_4px_0px_#000] ${daPagare <= 0 ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-[#FFEE00] text-black active:scale-95'}`}>
                    {loading ? 'ELABORAZIONE...' : daPagare <= 0 ? 'NESSUN DEBITO' : 'CONFERMA PAGAMENTO'}
                  </button>

                  <div className="mt-4 pt-4 border-t-2 border-dashed border-zinc-300">
                    <p className="text-[10px] font-black uppercase text-zinc-500 mb-2 text-center">Operazioni di fine stagione / Chiusura conti</p>
                    <button onClick={() => handleAzzeraContabilita(payPrData)} disabled={loading} className="w-full font-black text-xs p-3 uppercase transition-transform border-2 border-red-600 text-red-600 hover:bg-red-50 active:scale-95">AZZERA CONTABILITÀ PR</button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* POPUP GESTIONE ALIAS */}
      {masterModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-2xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Gestione Avanzata</p>
                <h2 className="text-2xl font-black italic uppercase leading-none mt-1">Alias Master</h2>
              </div>
              <button onClick={() => setMasterModalOpen(false)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>

            <h3 className="font-black text-lg mb-4 uppercase underline decoration-[#FFEE00] decoration-4">Alias Inglobati (Vecchi PR)</h3>
            
            {prs.filter(p => p.mergedInto === 'MASTER').length === 0 ? (
                <p className="text-sm font-bold text-zinc-500 italic mb-6">Nessun alias presente nel Profilo Master.</p>
            ) : (
                <div className="flex flex-col gap-3 mb-6">
                    {prs.filter(p => p.mergedInto === 'MASTER').map(alias => (
                        <div key={alias.id} className="border-2 border-black p-3 bg-zinc-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <p className="font-black uppercase">{alias.name} <span className="text-[10px] text-zinc-500">({alias.id})</span></p>
                                <p className="text-[10px] font-bold text-zinc-500">Ingressi Totali Storici: {alias.count}</p>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(`Ciao! Il tuo vecchio pass per la lista non è più attivo. Clicca su questo nuovo link per aggiornarlo subito ed entrare in lista Master: ${window.location.origin}/?ref=MASTER`);
                                        alert("Messaggio con link di aggiornamento copiato negli appunti!");
                                    }}
                                    className="bg-blue-600 text-white text-[10px] font-black px-3 py-2 border-2 border-black uppercase active:scale-95 transition-transform w-full"
                                >
                                    Copia Link Aggiornamento
                                </button>
                                <button 
                                    onClick={() => handleDeleteAlias(alias.id)}
                                    className="bg-red-600 text-white text-[10px] font-black px-3 py-2 border-2 border-black uppercase active:scale-95 transition-transform w-full"
                                >
                                    Elimina Definitivamente
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            <button onClick={() => setMasterModalOpen(false)} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase active:scale-95 transition-transform border-2 border-black shadow-[4px_4px_0px_#FFEE00]">CHIUDI PANNELLO</button>
          </div>
        </div>
      )}

      {/* POPUP SOSTITUZIONE PR */}
      {replacePrData && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 w-full max-w-3xl shadow-[10px_10px_0px_#FFEE00] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
              <div><p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sostituzione o Unione</p><h2 className="text-2xl font-black italic uppercase leading-none mt-1">Gestisci PR: {replacePrData.name}</h2><p className="text-xs font-black bg-black text-[#FFEE00] px-2 py-1 inline-block mt-2">ID: {replacePrData.id}</p></div>
              <button onClick={() => setReplacePrData(null)} className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1 active:shadow-none transition-all"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="border-4 border-black p-6 bg-zinc-50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-lg mb-2 uppercase underline decoration-[#FFEE00] decoration-4">1. Inserisci Nuovo PR</h3>
                    <p className="text-[11px] font-bold text-zinc-600 mb-6 uppercase">Mantieni questo ID e i vecchi link validi, ma cambia il nome della persona che ci lavora da ora in poi.</p>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nome Nuovo PR *</label>
                    <input type="text" placeholder="ES. MARCO" className="w-full p-3 border-2 border-black mb-4 font-black uppercase focus:border-[#FFEE00] outline-none" value={replaceName} onChange={e => setReplaceName(e.target.value)} />
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nuovo Telefono</label>
                    <input type="tel" placeholder="OPZIONALE" className="w-full p-3 border-2 border-black mb-4 font-black focus:border-[#FFEE00] outline-none" value={replacePhone} onChange={e => setReplacePhone(e.target.value)} />
                  </div>
                  <button onClick={() => eseguiSostituzioneNuovo(replacePrData)} disabled={loading} className="w-full bg-black text-[#FFEE00] font-black p-4 uppercase active:scale-95 transition-transform mt-4 border-2 border-black shadow-[4px_4px_0px_#FFEE00]">{loading ? '...' : 'SALVA NUOVO NOME'}</button>
               </div>
               <div className="border-4 border-black p-6 bg-zinc-50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-lg mb-2 uppercase underline decoration-[#FFEE00] decoration-4">2. Ingloba in Esistente</h3>
                    <p className="text-[11px] font-bold text-zinc-600 mb-6 uppercase">Trasferisci per sempre questo ID (e i suoi link in giro) a un altro PR che hai già nella tabella.</p>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Scegli PR di Destinazione *</label>
                    <select className="w-full p-3 border-2 border-black mb-4 font-black uppercase focus:border-[#FFEE00] outline-none bg-white" value={replaceTargetId} onChange={e => setReplaceTargetId(e.target.value)}>
                       <option value="">-- SELEZIONA PR --</option>
                       {activePrs.filter(p => p.id !== replacePrData.id && p.id !== 'MASTER').map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id})</option>))}
                    </select>
                  </div>
                  <button onClick={() => eseguiSostituzioneIngloba(replacePrData)} disabled={loading} className="w-full bg-red-600 text-white font-black p-4 uppercase active:scale-95 transition-transform mt-4 border-2 border-black shadow-[4px_4px_0px_#000]">{loading ? '...' : 'INGLOBA ORA'}</button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;