import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, getDocs, updateDoc, where,
  deleteDoc, doc, setDoc, query, orderBy, getDoc, deleteField
} from 'firebase/firestore';
import {
  Users, Calendar, Ticket, Gift, Trash2,
  Plus, Save, RefreshCw, Phone, BarChart, DollarSign, Award, X, Lock, Wallet, Calculator, Tag, MapPin, KeyRound, Ban, Crown,
  LogOut, Eye, EyeOff, Building2, Zap
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

// --- LOGIN SCREEN ---
const AdminLogin = ({ onLogin }) => {
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupId.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'groups', groupId.trim()));
      if (snap.exists() && snap.data().password === password) {
        onLogin({ groupId: snap.id, groupName: snap.data().name, groupType: snap.data().type });
      } else {
        alert('Credenziali non valide');
      }
    } catch { alert('Errore di connessione'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Building2 size={48} className="text-[#FFEE00] mx-auto mb-4" />
          <h1 className="text-3xl font-black italic uppercase text-white">Admin Panel</h1>
          <p className="text-zinc-600 text-xs tracking-widest mt-2 uppercase">Accesso Gruppo</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-zinc-900 border-4 border-[#FFEE00] p-8 shadow-[8px_8px_0px_#FFEE00] space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">ID Gruppo</label>
            <input
              type="text"
              className="w-full mt-1 p-4 bg-black border-2 border-zinc-700 text-white font-black uppercase outline-none focus:border-[#FFEE00]"
              placeholder="es. discoteca-x"
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Password</label>
            <div className="relative mt-1">
              <input
                type={showPwd ? 'text' : 'password'}
                className="w-full p-4 bg-black border-2 border-zinc-700 text-white font-black outline-none focus:border-[#FFEE00] pr-12"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                {showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFEE00] text-black font-black py-4 uppercase text-lg shadow-[4px_4px_0px_#FFF] active:translate-y-1 transition-all disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Admin = () => {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('adminGroup') || 'null'); } catch { return null; }
  });

  const handleLogin = (sessionData) => {
    localStorage.setItem('adminGroup', JSON.stringify(sessionData));
    setSession(sessionData);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminGroup');
    setSession(null);
  };

  if (!session) return <AdminLogin onLogin={handleLogin} />;
  return <AdminPanel session={session} onLogout={handleLogout} />;
};

const AdminPanel = ({ session, onLogout }) => {
  const { groupId, groupName } = session;
  const masterId = `MASTER_${groupId}`;

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
  const [showNewPrForm, setShowNewPrForm] = useState(false);
  const [showBulkSetup, setShowBulkSetup] = useState(false);
  const [bulkEventConfig, setBulkEventConfig] = useState([]);

  const [eventForm, setEventForm] = useState({ title: '', date: '', description: '', category: 'DISCOTECA', location: '' });
  const [selectedFile, setSelectedFile] = useState(null);


  const categories = session.groupType === 'LOUNGE/PUB'
    ? [{ id: 'PUB', label: 'LOUNGE/PUB' }]
    : [{ id: 'DISCOTECA', label: 'DISCOTECA' }];

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const activePrIds = prs.filter(p => !p.mergedInto && p.id !== masterId).map(p => p.id);
    setBulkEventConfig(prev => {
      const prevMap = Object.fromEntries(prev.map(c => [c.eventId, c]));
      return events.map(ev => {
        const existing = prevMap[ev.id];
        if (existing) {
          const existingPrMap = Object.fromEntries((existing.prConfigs || []).map(pc => [pc.prId, pc]));
          const prConfigs = activePrIds.map(prId =>
            existingPrMap[prId] || { prId, selected: true, pay: existing.pay || '' }
          );
          return { ...existing, prConfigs };
        }
        return {
          eventId: ev.id, selected: false, pay: '',
          prConfigs: activePrIds.map(prId => ({ prId, selected: true, pay: '' }))
        };
      });
    });
  }, [events, prs]);

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
      const evSnap = await getDocs(query(collection(db, "events"), where("groupId", "==", groupId)));
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const prRegistrySnap = await getDocs(query(collection(db, "prs_registry"), where("groupId", "==", groupId)));
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

  const getLastReset = (pr) => {
    if (!pr?.lastReset) return null;
    return pr.lastReset?.toDate ? pr.lastReset.toDate() : new Date(pr.lastReset);
  };

  const afterReset = (t, lastReset) => {
    if (!lastReset) return true;
    const tDate = t.timestamp?.toDate ? t.timestamp.toDate() : (t.timestamp ? new Date(t.timestamp) : null);
    return !tDate || tDate > lastReset;
  };

  const calculatePrFinancials = (pr) => {
    const lastReset = getLastReset(pr);
    let directTotal = 0;
    let supervisorBonus = 0;

    const myTickets = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.used === true && afterReset(t, lastReset));
    myTickets.forEach(t => {
        const slotIndex = pr.eventIds?.indexOf(t.eventId);
        const rate = (slotIndex !== -1 && slotIndex !== undefined) ? (Number(pr.eventPays?.[slotIndex]) || 0) : 0;
        directTotal += rate;
    });

    const subPrs = activePrs.filter(sub => sub.supervisorId === pr.id || pr.aliases?.includes(sub.supervisorId));
    subPrs.forEach(sub => {
        const subTickets = tickets.filter(t => (t.prId === sub.id || sub.aliases?.includes(t.prId)) && t.used === true && afterReset(t, lastReset));
        const bonusRate = Number(sub.supervisorPay) || 0;
        supervisorBonus += (subTickets.length * bonusRate);
    });

    return { directTotal, supervisorBonus, guadagnoLordo: directTotal + supervisorBonus };
  };

  const calculatePrFinancialsForEvent = (pr, eventId) => {
    const lastReset = getLastReset(pr);
    let directTotalEv = 0;
    let supervisorBonusEv = 0;

    const myEvTickets = tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === eventId && t.used === true && afterReset(t, lastReset));
    const slotIndex = pr.eventIds?.indexOf(eventId);
    const rate = (slotIndex !== -1 && slotIndex !== undefined) ? (Number(pr.eventPays?.[slotIndex]) || 0) : 0;
    directTotalEv = myEvTickets.length * rate;

    const subPrs = activePrs.filter(sub => sub.supervisorId === pr.id || pr.aliases?.includes(sub.supervisorId));
    subPrs.forEach(sub => {
        const subEvTickets = tickets.filter(t => (t.prId === sub.id || sub.aliases?.includes(t.prId)) && t.eventId === eventId && t.used === true && afterReset(t, lastReset));
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
        groupId,
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
      const update = { eventIds: newEventIds };
      if (eventId) {
        const title = events.find(e => e.id === eventId)?.title;
        if (title) update[`eventTitles.${eventId}`] = title;
      }
      await updateDoc(doc(db, "prs_registry", prId), update);
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

  const handleApplyBulkSetup = async () => {
    const selectedConfigs = bulkEventConfig.filter(c => c.selected);
    if (selectedConfigs.length === 0) return alert('Seleziona almeno una serata!');
    const involvedPrIds = new Set(
      selectedConfigs.flatMap(c => (c.prConfigs || []).filter(pc => pc.selected).map(pc => pc.prId))
    );
    if (involvedPrIds.size === 0) return alert('Nessun PR selezionato!');
    const prsToUpdate = activePrs.filter(p => involvedPrIds.has(p.id));
    if (!window.confirm(`Applicare il setup a ${prsToUpdate.length} PR?\n\nSovrascrive gli slot esistenti.`)) return;
    setLoading(true);
    try {
      for (const pr of prsToUpdate) {
        const prEvents = selectedConfigs.filter(c =>
          (c.prConfigs || []).find(pc => pc.prId === pr.id && pc.selected)
        );
        const newEventIds = Array(6).fill('');
        const newEventPays = Array(6).fill(0);
        const eventTitlesUpdate = {};
        prEvents.slice(0, 6).forEach((config, i) => {
          newEventIds[i] = config.eventId;
          const prConf = config.prConfigs?.find(pc => pc.prId === pr.id);
          newEventPays[i] = Number(prConf?.pay ?? config.pay) || 0;
          const ev = events.find(e => e.id === config.eventId);
          if (ev) eventTitlesUpdate[`eventTitles.${config.eventId}`] = ev.title;
        });
        await updateDoc(doc(db, 'prs_registry', pr.id), {
          eventIds: newEventIds,
          eventPays: newEventPays,
          ...eventTitlesUpdate
        });
      }
      await fetchData();
      alert(`Setup applicato a ${prsToUpdate.length} PR!`);
    } catch { alert("Errore durante l'applicazione."); } finally { setLoading(false); }
  };

  const handleDeletePr = async (pr) => {
    if (pr.id === masterId) return alert("Il Profilo MASTER non può essere eliminato!");
    const conferma = window.confirm(`ATTENZIONE!\nSei sicuro di voler eliminare ${pr.name}?\n\nI suoi dati verranno trasferiti al "PROFILO MASTER".`);
    if (!conferma) return;
    setLoading(true);
    try {
      const masterExists = prs.find(p => p.id === masterId);
      if (!masterExists) {
        await setDoc(doc(db, "prs_registry", masterId), {
          name: "PROFILO MASTER", phone: "", groupId, isMaster: true, eventIds: [], supervisorId: "",
          active: true, mergedInto: null, acconto: 0, historicalOrphanCount: 0, historicalOrphanProfit: 0
        });
        await setDoc(doc(db, "prs", masterId), { count: 0 }, { merge: true });
      }
      await updateDoc(doc(db, "prs_registry", pr.id), { mergedInto: masterId });
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
    if (pr.id === masterId) return alert("Il Profilo MASTER non può essere sostituito!");
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
      await updateDoc(doc(db, "prs_registry", pr.id), { acconto: 0, lastReset: new Date() });
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
              groupId,
              imageUrl: canvas.toDataURL('image/jpeg', 0.7),
              active: true,
              timestamp: new Date()
            });
            const defaultCat = categories[0]?.id || 'DISCOTECA';
            setEventForm({ title: '', date: '', description: '', category: defaultCat, location: '' });
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

  const masterPr = prs.find(p => p.id === masterId);
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
      
      {/* HEADER + TAB NAV — sticky insieme */}
      <div className="sticky top-0 z-50">
        <div className="bg-black text-white px-4 py-2 flex justify-between items-center border-b-4 border-[#FFEE00]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-10 md:h-16 object-contain block" />
            <div>
              <h1 className="font-black italic text-base md:text-2xl leading-none">ADMIN PANEL</h1>
              <p className="text-[9px] text-[#FFEE00] tracking-widest mt-0.5">{groupName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPasswordModalOpen(true)} className="bg-zinc-800 text-white p-2 rounded-full border-2 border-zinc-600">
              <Lock size={18} />
            </button>
            <button onClick={fetchData} className={`bg-[#FFEE00] text-black p-2 rounded-full ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={18} />
            </button>
            <button onClick={onLogout} className="bg-red-600 text-white p-2 rounded-full border-2 border-red-800">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="flex bg-white border-b-4 border-black">
          <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 px-1 font-black flex flex-col items-center justify-center gap-1 text-[10px] ${activeTab === 'stats' ? 'bg-[#FFEE00]' : ''}`}><BarChart size={18}/> LIVE</button>
          <button onClick={() => setActiveTab('prs')} className={`flex-1 py-3 px-1 font-black flex flex-col items-center justify-center gap-1 text-[10px] border-l-2 border-black ${activeTab === 'prs' ? 'bg-[#FFEE00]' : ''}`}><Users size={18}/> TEAM</button>
          <button onClick={() => setActiveTab('events')} className={`flex-1 py-3 px-1 font-black flex flex-col items-center justify-center gap-1 text-[10px] border-l-2 border-black ${activeTab === 'events' ? 'bg-[#FFEE00]' : ''}`}><Calendar size={18}/> SERATE</button>
          <button onClick={() => setActiveTab('sponsors')} className={`flex-1 py-3 px-1 font-black flex flex-col items-center justify-center gap-1 text-[10px] border-l-2 border-black ${activeTab === 'sponsors' ? 'bg-[#FFEE00]' : ''}`}><Gift size={18}/> SPONSOR</button>
        </div>
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
                 const evPrs = prs.filter(p => !p.mergedInto && (p.id === masterId || p.eventIds?.includes(ev.id)));
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

            {/* SETUP RAPIDO SERATE */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowBulkSetup(v => !v)}
                className="flex items-center justify-between gap-2 font-black uppercase text-sm border-4 border-[#FFEE00] bg-black text-[#FFEE00] px-5 py-3 shadow-[4px_4px_0px_#FFEE00] w-full active:translate-y-1 transition-all"
              >
                <span className="flex items-center gap-2"><Zap size={18}/> SETUP RAPIDO SERATE</span>
                <span className="text-zinc-400 text-xs">{showBulkSetup ? '▲' : '▼'}</span>
              </button>
              {showBulkSetup && (
                <div className="bg-black text-white border-4 border-[#FFEE00] border-t-0 shadow-[8px_8px_0px_#FFEE00]">
                  <div className="p-4 border-b border-zinc-800">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed">
                      Attiva le serate, imposta la tariffa e decidi quali PR assegnare.
                      Il setup sovrascrive gli slot di ogni PR selezionato. Max 6 serate.
                    </p>
                  </div>

                  {events.length === 0 ? (
                    <p className="text-zinc-500 text-xs italic text-center py-8">Nessuna serata disponibile</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-zinc-800">
                      {bulkEventConfig.map((config, idx) => {
                        const ev = events.find(e => e.id === config.eventId);
                        if (!ev) return null;
                        const selectedCount = bulkEventConfig.filter(c => c.selected).length;
                        const isLimitReached = !config.selected && selectedCount >= 6;
                        const nonMasterPrs = activePrs.filter(p => p.id !== masterId);
                        return (
                          <div key={config.eventId} className={`transition-all ${config.selected ? 'bg-zinc-900' : isLimitReached ? 'opacity-30' : ''}`}>

                            {/* riga evento */}
                            <div
                              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                              onClick={() => {
                                if (isLimitReached) return;
                                setBulkEventConfig(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
                              }}
                            >
                              <div className={`w-5 h-5 border-2 shrink-0 flex items-center justify-center transition-all ${config.selected ? 'bg-[#FFEE00] border-[#FFEE00]' : 'border-zinc-500'}`}>
                                {config.selected && <span className="text-[10px] font-black text-black">✓</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-xs uppercase truncate leading-none">{ev.title}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{ev.date}</p>
                              </div>
                              {config.selected && (
                                <div
                                  className="flex items-center border-2 border-[#FFEE00] bg-zinc-800 h-[30px] w-[90px] shrink-0"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span className="px-1.5 text-[9px] font-black text-zinc-400 border-r border-zinc-600 h-full flex items-center shrink-0">€ tutti</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    className="w-full h-full px-1 font-black text-[11px] text-center focus:outline-none bg-transparent text-[#FFEE00]"
                                    value={config.pay}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setBulkEventConfig(prev => prev.map((c, i) => i !== idx ? c : {
                                        ...c, pay: val,
                                        prConfigs: (c.prConfigs || []).map(pc => ({ ...pc, pay: val }))
                                      }));
                                    }}
                                    onBlur={e => {
                                      const parsed = parseFloat(e.target.value);
                                      if (!isNaN(parsed)) {
                                        const fmt = parsed.toFixed(2);
                                        setBulkEventConfig(prev => prev.map((c, i) => i !== idx ? c : {
                                          ...c, pay: fmt,
                                          prConfigs: (c.prConfigs || []).map(pc => ({ ...pc, pay: fmt }))
                                        }));
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* lista PR per questa serata — verticale con gerarchia */}
                            {config.selected && nonMasterPrs.length > 0 && (
                              <div className="px-4 pb-3" onClick={e => e.stopPropagation()}>
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Team assegnato a questa serata:</p>
                                <div className="flex flex-col gap-1">
                                  {(() => {
                                    const topLevel = nonMasterPrs.filter(p => !p.supervisorId || !nonMasterPrs.find(s => s.id === p.supervisorId));
                                    const subPrsOf = (supId) => nonMasterPrs.filter(p => p.supervisorId === supId);

                                    const PrRow = ({ pr, indent = false }) => {
                                      const prConf = config.prConfigs?.find(pc => pc.prId === pr.id);
                                      const isChecked = prConf ? prConf.selected : true;
                                      const prPay = prConf ? prConf.pay : (config.pay ?? '');
                                      const updatePrConf = (updater) => setBulkEventConfig(prev => prev.map((c, i) => {
                                        if (i !== idx) return c;
                                        const exists = (c.prConfigs || []).some(pc => pc.prId === pr.id);
                                        const base = exists
                                          ? c.prConfigs.map(pc => pc.prId === pr.id ? updater(pc) : pc)
                                          : [...(c.prConfigs || []), updater({ prId: pr.id, selected: true, pay: c.pay || '' })];
                                        return { ...c, prConfigs: base };
                                      }));
                                      return (
                                        <div className={`flex items-center gap-2 ${indent ? 'ml-5 pl-3 border-l-2 border-zinc-700' : ''}`}>
                                          <button
                                            type="button"
                                            onClick={() => updatePrConf(pc => ({ ...pc, selected: !pc.selected }))}
                                            className={`flex items-center gap-1.5 flex-1 min-w-0 py-1.5 px-2 border-2 transition-all ${isChecked ? 'bg-[#FFEE00] text-black border-[#FFEE00]' : 'bg-zinc-950 text-zinc-500 border-zinc-700'}`}
                                          >
                                            <span className={`w-3 h-3 border shrink-0 flex items-center justify-center text-[8px] font-black ${isChecked ? 'bg-black border-black text-[#FFEE00]' : 'border-zinc-600'}`}>
                                              {isChecked ? '✓' : ''}
                                            </span>
                                            <span className="text-[10px] font-black uppercase truncate">{pr.name}</span>
                                            <span className="text-[8px] opacity-50 font-bold shrink-0">{pr.id}</span>
                                          </button>
                                          {isChecked && (
                                            <div className="flex items-center border-2 border-[#FFEE00] bg-zinc-800 h-[30px] w-[80px] shrink-0">
                                              <span className="px-1 text-[9px] font-black text-zinc-400 border-r border-zinc-600 h-full flex items-center shrink-0">€</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                className="w-full h-full px-1 font-black text-[11px] text-center focus:outline-none bg-transparent text-[#FFEE00]"
                                                value={prPay}
                                                onChange={e => updatePrConf(pc => ({ ...pc, pay: e.target.value }))}
                                                onBlur={e => {
                                                  const parsed = parseFloat(e.target.value);
                                                  if (!isNaN(parsed)) updatePrConf(pc => ({ ...pc, pay: parsed.toFixed(2) }));
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    };

                                    return topLevel.map(pr => (
                                      <React.Fragment key={pr.id}>
                                        <PrRow pr={pr} indent={false} />
                                        {subPrsOf(pr.id).map(sub => (
                                          <PrRow key={sub.id} pr={sub} indent={true} />
                                        ))}
                                      </React.Fragment>
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-4 border-t border-zinc-800">
                    <button
                      onClick={handleApplyBulkSetup}
                      disabled={loading || bulkEventConfig.filter(c => c.selected).length === 0}
                      className="w-full bg-[#FFEE00] text-black font-black py-4 uppercase text-sm shadow-[4px_4px_0px_#FFF] active:translate-y-1 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <Zap size={18}/>
                      APPLICA SETUP AL TEAM
                      {bulkEventConfig.filter(c => c.selected).length > 0 && (
                        <span className="bg-black text-[#FFEE00] text-[9px] font-black px-2 py-0.5 ml-1">
                          {bulkEventConfig.filter(c => c.selected).length} {bulkEventConfig.filter(c => c.selected).length === 1 ? 'SERATA' : 'SERATE'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-10">
              <button
                type="button"
                onClick={() => setShowNewPrForm(v => !v)}
                className="flex items-center gap-2 font-black uppercase text-sm border-4 border-black bg-white px-5 py-3 shadow-[4px_4px_0px_#000] hover:bg-[#FFEE00] transition-all active:translate-y-1"
              >
                <Plus size={18}/> NUOVO COLLABORATORE
                <span className="ml-1 text-zinc-500">{showNewPrForm ? '▲' : '▼'}</span>
              </button>
              {showNewPrForm && (
                <form onSubmit={handleAddPr} className="bg-white border-4 border-black border-t-0 p-6 shadow-[8px_8px_0px_#000]">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Codice Automatico</label><input type="text" value={autoPrCode} className="p-3 border-2 border-black font-black bg-zinc-100 text-zinc-500 cursor-not-allowed outline-none" readOnly /></div>
                    <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Nome Completo *</label><input type="text" placeholder="Es. Mario Rossi" className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00]" value={prForm.name} onChange={e => setPrForm({...prForm, name: e.target.value})} required /></div>
                    <div className="flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Telefono</label><input type="tel" placeholder="Es. 3331234567" className="p-3 border-2 border-black font-bold outline-none focus:border-[#FFEE00]" value={prForm.phone} onChange={e => setPrForm({...prForm, phone: e.target.value})} /></div>
                  </div>
                  <div className="mt-4 flex flex-col"><label className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-left">Supervisore (Opzionale)</label>
                    <select className="p-3 border-2 border-black font-bold uppercase outline-none focus:border-[#FFEE00] bg-white" value={prForm.supervisorId} onChange={e => setPrForm({...prForm, supervisorId: e.target.value})}>
                      <option value="">-- NESSUN SUPERVISORE --</option>
                      {activePrs.filter(p => p.id !== masterId).map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                    </select>
                  </div>
                  <button className="w-full mt-6 bg-black text-white font-black py-4 uppercase hover:bg-[#FFEE00] hover:text-black transition-all shadow-[4px_4px_0px_#FFEE00] active:translate-y-1">SALVA NEL TEAM</button>
                </form>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {activePrs.map(pr => {
                const isMaster = pr.id === masterId;
                const lr = getLastReset(pr);
                const countT = (eventId) => tickets.filter(t => (t.prId === pr.id || pr.aliases?.includes(t.prId)) && t.eventId === eventId && t.used === true && afterReset(t, lr)).length;
                let supNameText = '';
                if (pr.supervisorId && !isMaster) {
                  const supObj = prs.find(p => p.id === pr.supervisorId);
                  supNameText = supObj ? (supObj.mergedInto === masterId ? `MASTER (ex ${supObj.name})` : supObj.name) : pr.supervisorId;
                }
                return (
                  <div key={pr.id} className={`border-4 bg-white overflow-hidden ${isMaster ? 'border-[#FFEE00] shadow-[5px_5px_0px_#FFEE00]' : 'border-black shadow-[5px_5px_0px_#000]'}`}>

                    {/* intestazione card */}
                    <div className={`px-4 py-3 flex justify-between items-center ${isMaster ? 'bg-[#FFEE00]' : 'bg-black'}`}>
                      <div>
                        <p className={`font-black text-base leading-none ${isMaster ? 'text-black' : 'text-white'}`}>{pr.name}</p>
                        {pr.phone && <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isMaster ? 'text-zinc-600' : 'text-zinc-400'}`}><Phone size={9}/> {pr.phone}</p>}
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 border-2 ${isMaster ? 'bg-black text-[#FFEE00] border-black' : 'bg-[#FFEE00] text-black border-[#FFEE00]'}`}>
                        {isMaster ? '★ MASTER' : pr.id}
                      </span>
                    </div>

                    {/* slot serate */}
                    <div className="divide-y divide-zinc-100">
                      {isMaster ? events.map(ev => {
                        const n = countT(ev.id);
                        const finEv = calculatePrFinancialsForEvent(pr, ev.id);
                        return (
                          <div key={ev.id} className="px-4 py-2 flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase truncate flex-1">{ev.title}</span>
                            <span className={`text-xs font-black px-2 py-0.5 shrink-0 ${n > 0 ? 'bg-black text-[#FFEE00]' : 'text-zinc-400'}`}>{n}</span>
                            <span className="text-sm font-black w-16 text-right shrink-0">€{finEv.guadagnoTotaleEv.toFixed(2)}</span>
                          </div>
                        );
                      }) : (() => {
                        const assignedSlots = (pr.eventIds || []).map((id, i) => ({ id, i })).filter(s => s.id);
                        if (assignedSlots.length === 0) return (
                          <p key="empty" className="text-[10px] text-zinc-400 italic text-center py-3 px-4">Nessuna serata — usa Setup Rapido</p>
                        );
                        return assignedSlots.map(({ id: evId, i }) => {
                          const ev = events.find(e => e.id === evId);
                          const n = countT(evId);
                          const finEv = calculatePrFinancialsForEvent(pr, evId);
                          const currentPay = pr.eventPays?.[i] || '';
                          return (
                            <div key={evId} className="px-3 py-2 flex items-center gap-2">
                              <span className="text-[11px] font-black uppercase truncate flex-1">{ev?.title || evId}</span>
                              <div className="h-[26px] shrink-0">
                                <InlinePayInput initialValue={currentPay} onSave={val => handleUpdateEventPay(pr.id, i, val, pr.eventPays)} placeholder="€/ing" />
                              </div>
                              <span className={`text-xs font-black px-1.5 py-0.5 shrink-0 ${n > 0 ? 'bg-black text-[#FFEE00]' : 'text-zinc-400'}`}>{n}</span>
                              <span className="text-xs font-black w-14 text-right shrink-0">€{finEv.guadagnoTotaleEv.toFixed(2)}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* link + supervisore */}
                    {(!isMaster) && (
                      <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${pr.id}`); alert("Link copiato!"); }}
                          className="text-[10px] font-black underline text-blue-600 uppercase">Copia Link App</button>
                        {supNameText && (
                          <span className="text-[10px] text-zinc-500 font-black uppercase">Sup: {supNameText}</span>
                        )}
                        {pr.supervisorId && (
                          <div className="flex items-center gap-1 h-[24px]">
                            <span className="text-[9px] text-zinc-500 uppercase">Bonus:</span>
                            <InlinePayInput initialValue={pr.supervisorPay} onSave={val => handleUpdateSupervisorPay(pr.id, val)} placeholder="0.00" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* azioni */}
                    <div className="p-3 border-t-2 border-black grid grid-cols-2 gap-2">
                      <button onClick={() => handleResetPrPassword(pr.id)}
                        className="col-span-2 bg-black text-white text-[10px] font-black p-2 border-2 border-black flex items-center justify-center gap-1 uppercase shadow-[2px_2px_0px_#555] active:scale-95">
                        <KeyRound size={11}/> RESET PWD
                      </button>
                      {isMaster ? (<>
                        <button onClick={() => setProfitsModalOpen(true)}
                          className="bg-green-600 text-white text-[10px] font-black border-2 border-black p-2 uppercase shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1">
                          <Calculator size={11}/> CONTEGGI
                        </button>
                        <button onClick={() => setMasterModalOpen(true)}
                          className="bg-purple-600 text-white text-[10px] font-black border-2 border-black p-2 uppercase shadow-[2px_2px_0px_#000] flex items-center justify-center">
                          MODIFICA ALIAS
                        </button>
                      </>) : (<>
                        <button onClick={() => { setPayPrData(pr); setPayAmount(''); }}
                          className="bg-[#FFEE00] text-black text-[10px] font-black border-2 border-black p-2 uppercase shadow-[2px_2px_0px_#000]">
                          VEDI E PAGA
                        </button>
                        <button onClick={() => openReplaceModal(pr)}
                          className="text-blue-600 text-[10px] font-black border-2 border-blue-600 p-2 uppercase">
                          Sostituisci
                        </button>
                      </>)}
                      <button onClick={() => handleDeletePr(pr)}
                        className={`col-span-2 ${isMaster ? 'opacity-30 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'} border-2 border-red-600 p-2 flex justify-center`}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
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
                {activePrs.filter(p => p.id === masterId || p.eventIds?.includes(selectedEventForModal)).map(p => {
                   const finEv = calculatePrFinancialsForEvent(p, selectedEventForModal);
                   if (finEv.evIns === 0 && finEv.supervisorBonusEv === 0 && p.id !== masterId) return null;
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
                {prs.filter(p => p.mergedInto === masterId).map(alias => (
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
              const lastReset = getLastReset(payPrData);
              const myTickets = tickets.filter(t => (t.prId === payPrData.id || payPrData.aliases?.includes(t.prId)) && t.used === true && afterReset(t, lastReset));
              const byEvent = {};
              myTickets.forEach(t => {
                if (!byEvent[t.eventId]) byEvent[t.eventId] = 0;
                byEvent[t.eventId]++;
              });
              const perEventRows = Object.entries(byEvent).map(([eventId, count]) => {
                const slotIndex = payPrData.eventIds?.indexOf(eventId);
                const rate = (slotIndex !== -1 && slotIndex !== undefined) ? (Number(payPrData.eventPays?.[slotIndex]) || 0) : 0;
                const eventTitle = events.find(e => e.id === eventId)?.title || payPrData.eventTitles?.[eventId] || eventId;
                return { eventTitle, count, rate, total: count * rate };
              });

              // bonus supervisore (filtrato con lo stesso lastReset del PR supervisore)
              const subPrs = activePrs.filter(sub => sub.supervisorId === payPrData.id || payPrData.aliases?.includes(sub.supervisorId));
              let supervisorBonus = 0;
              subPrs.forEach(sub => {
                const subTickets = tickets.filter(t => (t.prId === sub.id || sub.aliases?.includes(t.prId)) && t.used === true && afterReset(t, lastReset));
                supervisorBonus += subTickets.length * (Number(sub.supervisorPay) || 0);
              });

              const directTotal = perEventRows.reduce((s, r) => s + r.total, 0);
              const guadagnoLordo = directTotal + supervisorBonus;
              const accontoAttuale = Number(payPrData.acconto) || 0;
              const daPagare = Math.max(0, guadagnoLordo - accontoAttuale);

              return (
                <div className="flex flex-col gap-4 text-left">

                  {/* DETTAGLIO SERATE */}
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Dettaglio Serate</p>
                    {perEventRows.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">Nessun ingresso registrato.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {perEventRows.map((row, i) => (
                          <div key={i} className="flex justify-between items-center border-b border-zinc-100 py-1.5">
                            <div>
                              <p className="text-sm font-black uppercase leading-none">{row.eventTitle}</p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">{row.count} ing × €{row.rate.toFixed(2)}</p>
                            </div>
                            <span className="font-black text-base">€{row.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BONUS SUPERVISORE */}
                  {supervisorBonus > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t-2 border-dashed border-zinc-300">
                      <span className="text-[11px] font-black uppercase text-zinc-500">Bonus Supervisore</span>
                      <span className="font-black text-base">€{supervisorBonus.toFixed(2)}</span>
                    </div>
                  )}

                  {/* RIEPILOGO */}
                  <div className="border-t-4 border-black pt-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-zinc-500">Totale Lordo</span>
                      <span className="font-black text-lg">€{guadagnoLordo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-zinc-500">Acconti Versati</span>
                      <span className="font-black text-lg text-zinc-400">− €{accontoAttuale.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-black text-white px-4 py-3 mt-1">
                      <span className="text-xs font-black uppercase tracking-widest">Residuo</span>
                      <span className="text-2xl font-black italic text-[#FFEE00]">€{daPagare.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* PAGAMENTO */}
                  <input type="number" step="0.01" max={daPagare} placeholder="Importo da versare" className="w-full p-4 border-2 border-black font-black text-xl outline-none text-center focus:border-[#FFEE00]" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  <button onClick={eseguiPagamento} disabled={loading || daPagare <= 0} className="w-full bg-[#FFEE00] text-black font-black p-4 uppercase border-2 border-black shadow-[4px_4px_0px_#000] active:scale-95 transition-all disabled:opacity-40">CONFERMA PAGAMENTO</button>
                  <button onClick={() => handleAzzeraContabilita(payPrData)} className="w-full font-black text-[10px] p-3 border-2 border-red-600 text-red-600 uppercase hover:bg-red-50 transition-all">AZZERA CONTABILITÀ PR</button>
                </div>
              );
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
                     {activePrs.filter(p => p.id !== replacePrData.id && p.id !== masterId).map(p => (<option key={p.id} value={p.id}>{p.name} ({p.id})</option>))}
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