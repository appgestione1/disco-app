import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import {
  collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import { BarChart2 } from 'lucide-react';
import {
  ShieldCheck, Power, LayoutGrid, Crown, Calendar, ChevronDown,
  List, Star, Inbox, Check, X, Settings, Euro, ChevronLeft, Phone, User, MapPin, Trash2,
  Users, KeyRound, Eye, EyeOff, Plus, Building2
} from 'lucide-react';

const LineChart = ({ data = [], color = '#D4AF37', height = 50 }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100 / (data.length - 1);
  const pts = data.map((v, i) => `${(i * w).toFixed(1)},${(height - (v / max) * (height - 4)).toFixed(1)}`).join(' ');
  const area = `0,${height} ` + pts + ` ${100},${height}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const GrowthBadge = ({ current, previous }) => {
  if (previous == null || previous === 0 && current === 0) return null;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  return (
    <span className={`text-[9px] font-black ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
};

const SuperAdmin = () => {
  const [events, setEvents] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState(null); // null | 'events' | 'proposals' | 'settings' | 'stats' | 'groups'
  const [stats, setStats] = useState(null);
  const [statsFilter, setStatsFilter] = useState('TOTALE');
  const [trendMetric, setTrendMetric] = useState('share');
  const [selectedProposal, setSelectedProposal] = useState(null);

  const [submissionSettings, setSubmissionSettings] = useState({ price: 10, isFree: true });
  const [priceInput, setPriceInput] = useState('10');

  // Popup pubblicità
  const [popupConfig, setPopupConfig] = useState({ imageUrl: '', videoUrl: '', slogan: '', address: '', expiry: '', qrUrl: '', showSaveButton: false });
  const [popupFile, setPopupFile] = useState(null);
  const [popupSaving, setPopupSaving] = useState(false);

  // Gruppi
  const [groups, setGroups] = useState([]);
  const [groupForm, setGroupForm] = useState({ id: '', name: '', type: 'DISCOTECA', password: '' });
  const [groupLoading, setGroupLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [groupPrs, setGroupPrs] = useState({});
  const [commissionInputs, setCommissionInputs] = useState({});
  const [visiblePrPasswords, setVisiblePrPasswords] = useState({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [evSnap, propSnap, settSnap, popupSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'event_proposals')),
        getDoc(doc(db, 'settings', 'eventSubmission')),
        getDoc(doc(db, 'settings', 'popup')),
      ]);
      if (popupSnap.exists()) {
        setPopupConfig({ imageUrl: '', videoUrl: '', slogan: '', address: '', expiry: '', qrUrl: '', showSaveButton: false, ...popupSnap.data() });
      }
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setProposals(propSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
      if (settSnap.exists()) {
        const s = settSnap.data();
        setSubmissionSettings(s);
        setPriceInput(String(s.price ?? 10));
      }
      await fetchGroups();
    } catch (e) {
      console.error('Errore fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    const [groupSnap, prsSnap] = await Promise.all([
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'prs_registry')),
    ]);
    const fetchedGroups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setGroups(fetchedGroups);
    const inputs = {};
    fetchedGroups.forEach(g => {
      inputs[g.id] = {
        perOrfano: g.commissions?.perOrfano ?? '',
        perPR: g.commissions?.perPR ?? '',
        perEvento: g.commissions?.perEvento ?? '',
        perQR: g.commissions?.perQR ?? '',
      };
    });
    setCommissionInputs(inputs);
    const allPrs = prsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const byGroup = {};
    fetchedGroups.forEach(g => {
      byGroup[g.id] = allPrs.filter(p => p.groupId === g.id && !p.isMaster && !p.mergedInto);
    });
    setGroupPrs(byGroup);
  };

  const handleCreateGroup = async () => {
    const { id, name, type, password } = groupForm;
    if (!id.trim() || !name.trim() || !password.trim()) return alert('Compila tutti i campi');
    if (!/^[a-z0-9-]+$/.test(id)) return alert('ID gruppo: solo lettere minuscole, numeri e trattini');
    setGroupLoading(true);
    try {
      const exists = await getDoc(doc(db, 'groups', id));
      if (exists.exists()) return alert('ID gruppo già esistente');
      await setDoc(doc(db, 'groups', id), { name, type, password, createdAt: new Date() });
      const masterId = `MASTER_${id}`;
      await setDoc(doc(db, 'prs_registry', masterId), {
        name: 'PROFILO MASTER', groupId: id, isMaster: true,
        eventIds: ['','','','','',''], eventPays: [0,0,0,0,0,0],
        supervisorId: '', active: true, mergedInto: null,
        acconto: 0, historicalOrphanCount: 0, historicalOrphanProfit: 0
      });
      await setDoc(doc(db, 'prs', masterId), { count: 0 }, { merge: true });
      setGroupForm({ id: '', name: '', type: 'DISCOTECA', password: '' });
      await fetchGroups();
      alert(`Gruppo "${name}" creato con successo!`);
    } catch (e) { alert('Errore durante la creazione del gruppo'); }
    finally { setGroupLoading(false); }
  };

  const handleDeleteEvent = async (ev) => {
    if (!window.confirm(`Eliminare "${ev.title}"?\nI conteggi PR e i dati dei gruppi NON verranno modificati.`)) return;
    try {
      await deleteDoc(doc(db, 'events', ev.id));
      setEvents(events.filter(e => e.id !== ev.id));
    } catch { alert('Errore eliminazione evento'); }
  };

  const handleSaveCommissions = async (groupId) => {
    const c = commissionInputs[groupId] || {};
    try {
      const commissions = {
        perOrfano: Number(c.perOrfano) || 0,
        perPR: Number(c.perPR) || 0,
        perEvento: Number(c.perEvento) || 0,
        perQR: Number(c.perQR) || 0,
      };
      await updateDoc(doc(db, 'groups', groupId), { commissions });
      setGroups(groups.map(g => g.id === groupId ? { ...g, commissions } : g));
      alert('Commissioni salvate!');
    } catch { alert('Errore salvataggio commissioni'); }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Eliminare il gruppo "${group.name}"?\n\nAttenzione: gli eventi e i PR del gruppo non verranno eliminati automaticamente.`)) return;
    try {
      await deleteDoc(doc(db, 'groups', group.id));
      setGroups(groups.filter(g => g.id !== group.id));
    } catch { alert('Errore eliminazione gruppo'); }
  };

  const togglePasswordVisible = (groupId) => {
    setVisiblePasswords(prev => ({ ...prev, [groupId]: !prev[groupId] }));
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

  const handleSavePopup = async () => {
    setPopupSaving(true);
    try {
      if (popupFile) {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image(); img.src = ev.target.result;
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              const scale = Math.min(1, 900 / img.width);
              canvas.width = img.width * scale; canvas.height = img.height * scale;
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              const newUrl = canvas.toDataURL('image/jpeg', 0.75);
              const updated = { ...popupConfig, imageUrl: newUrl };
              await setDoc(doc(db, 'settings', 'popup'), updated);
              setPopupConfig(updated); setPopupFile(null); resolve();
            };
            img.onerror = reject;
          };
          reader.onerror = reject;
          reader.readAsDataURL(popupFile);
        });
      } else {
        await setDoc(doc(db, 'settings', 'popup'), popupConfig);
      }
      alert('Popup salvato!');
    } catch (e) { alert('Errore salvataggio popup.'); } finally { setPopupSaving(false); }
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

  const handleResetStats = async (docId, label) => {
    if (!window.confirm(`Azzerare "${label}"? L'operazione non è reversibile.`)) return;
    try {
      await deleteDoc(doc(db, 'analytics', docId));
      await fetchStats();
    } catch { alert('Errore durante il reset'); }
  };

  const fetchStats = async () => {
    const safe = (snap) => (snap?.status === 'fulfilled' && snap.value?.exists?.()) ? snap.value.data() : {};
    try {
      const [sharesR, catsR, filmsR, pvR, installsR, sessionsR, prsR] = await Promise.allSettled([
        getDoc(doc(db, 'analytics', 'shares')),
        getDoc(doc(db, 'analytics', 'categories')),
        getDoc(doc(db, 'analytics', 'films')),
        getDoc(doc(db, 'analytics', 'pageviews')),
        getDoc(doc(db, 'analytics', 'installs')),
        getDoc(doc(db, 'analytics', 'sessions')),
        getDocs(collection(db, 'prs_registry')),
      ]);
      const prNames = {};
      if (prsR.status === 'fulfilled') prsR.value.docs.forEach(d => { prNames[d.id] = d.data().name || d.id; });
      setStats({
        shares: safe(sharesR),
        categories: safe(catsR),
        films: safe(filmsR)?.titles || {},
        pageviews: safe(pvR),
        installs: safe(installsR),
        sessions: safe(sessionsR),
        prNames,
      });
    } catch (e) {
      console.error('fetchStats error:', e);
      setStats({ shares: {}, categories: {}, films: {}, pageviews: {}, installs: {}, sessions: {}, prNames: {} });
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

            {/* STATISTICHE */}
            <button
              onClick={() => { setActiveView('stats'); fetchStats(); }}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-zinc-900 border-2 border-blue-500/30 text-zinc-400 px-10 py-7 rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all duration-300 hover:border-blue-500 hover:text-white"
            >
              <BarChart2 size={36} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-2xl italic tracking-tighter">Statistiche</span>
            </button>

            {/* GESTIONE GRUPPI */}
            <button
              onClick={() => { setActiveView('groups'); fetchGroups(); }}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-zinc-900 border-2 border-green-500/30 text-zinc-400 px-10 py-7 rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all duration-300 hover:border-green-500 hover:text-white"
            >
              <Building2 size={36} className="text-green-400 group-hover:scale-110 transition-transform" />
              <span className="text-2xl italic tracking-tighter">Gruppi Admin</span>
              {groups.length > 0 && (
                <span className="ml-auto bg-green-500 text-black text-sm font-black w-8 h-8 rounded-full flex items-center justify-center">{groups.length}</span>
              )}
            </button>

            {/* PUBBLICITÀ */}
            <button
              onClick={() => setActiveView('popup')}
              className="group relative w-full max-w-sm flex items-center gap-6 bg-zinc-900 border-2 border-purple-500/30 text-zinc-400 px-10 py-7 rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all duration-300 hover:border-purple-500 hover:text-white"
            >
              <Star size={36} className="text-purple-400 group-hover:rotate-12 transition-transform" />
              <div className="text-left">
                <span className="text-2xl italic tracking-tighter block">Pubblicità</span>
                {(popupConfig.imageUrl || popupConfig.videoUrl) && <span className="text-[9px] text-purple-400 font-black tracking-widest">CONFIGURATA</span>}
              </div>
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

        {/* SEZIONE STATISTICHE */}
        {activeView === 'stats' && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-blue-400 text-xs tracking-widest italic flex items-center gap-2"><BarChart2 size={14} /> Analytics App</h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1"><ChevronLeft size={14} /> Indietro</button>
            </div>

            {/* Filtro periodo */}
            <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
              {['OGGI','7G','30G','TOTALE'].map(f => (
                <button key={f} onClick={() => setStatsFilter(f)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${statsFilter === f ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
                  {f}
                </button>
              ))}
            </div>

            {!stats ? (
              <div className="text-center py-20 text-zinc-600 animate-pulse">Caricamento...</div>
            ) : (() => {
              const filteredDays = statsFilter === 'OGGI' ? 1 : statsFilter === '7G' ? 7 : statsFilter === '30G' ? 30 : null;
              const trendDays = filteredDays || 7;

              const daysArray = (offset = 0) => Array.from({ length: trendDays }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - offset - i);
                return d.toISOString().split('T')[0];
              });

              const sumDays = (obj, keys) => keys.reduce((a, k) => a + (obj?.daily?.[k] ?? 0), 0);
              const sumCatDays = (cat, keys) => keys.reduce((a, k) => a + (stats.categories?.daily?.[k]?.[cat] ?? 0), 0);

              const curKeys = daysArray(0);
              const prevKeys = daysArray(trendDays);

              const totalShares = filteredDays ? sumDays(stats.shares, curKeys) : (stats.shares?.total ?? 0);
              const prevShares  = filteredDays ? sumDays(stats.shares, prevKeys) : null;
              const totalVisits = filteredDays ? sumDays(stats.pageviews, curKeys) : (stats.pageviews?.total ?? 0);
              const prevVisits  = filteredDays ? sumDays(stats.pageviews, prevKeys) : null;

              const filteredCatCount = (cat) => filteredDays ? sumCatDays(cat, curKeys) : (stats.categories?.[cat] ?? 0);

              const prShares = Object.entries(stats.shares?.by_pr || {}).filter(([k]) => k !== 'MASTER');
              const avgSession = stats.sessions?.total > 0
                ? Math.round((stats.sessions.total_seconds || 0) / stats.sessions.total) : 0;
              const pwaSessions = stats.installs?.pwa_sessions ?? 0;
              const pwaInstalls = stats.installs?.total ?? 0;
              const cats = ['DISCOTECA','CINEMA','CONCERTI','TEATRO','ARENE ESTIVE','PUB'];
              const catCounts = cats.map(c => filteredCatCount(c));
              const maxCat = Math.max(...catCounts, 1);

              // Dati per i grafici (ordine cronologico)
              const shareData  = [...curKeys].reverse().map(k => stats.shares?.daily?.[k] ?? 0);
              const visitData  = [...curKeys].reverse().map(k => stats.pageviews?.daily?.[k] ?? 0);

              return (
                <>
                  {/* Card sponsor — metriche chiave */}
                  <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#D4AF37]/30 rounded-3xl p-6 mb-2">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[9px] text-[#D4AF37] font-black tracking-widest">MEDIA KIT — METRICHE SPONSOR</p>
                      <button onClick={() => handleResetStats('pageviews', 'Visite')} className="text-[8px] text-red-500/50 hover:text-red-500 transition-colors normal-case font-normal">reset visite</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Visite', value: totalVisits, prev: prevVisits, color: 'text-white' },
                        { label: 'Sessione Media', value: avgSession > 0 ? `${avgSession}s` : '—', prev: null, color: 'text-blue-400' },
                        { label: 'Condivisioni', value: totalShares, prev: prevShares, color: 'text-[#D4AF37]' },
                        { label: 'Utenti PWA', value: pwaSessions, prev: null, color: 'text-green-400' },
                        { label: 'Installazioni', value: pwaInstalls, prev: null, color: 'text-purple-400' },
                        { label: 'Share Esterni', value: stats.shares?.by_pr?.MASTER ?? 0, prev: null, color: 'text-orange-400' },
                      ].map(({ label, value, prev, color }) => (
                        <div key={label} className="bg-black/40 rounded-2xl p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className={`text-2xl font-black italic ${color}`}>{value}</p>
                            {typeof value === 'number' && <GrowthBadge current={value} previous={prev} />}
                          </div>
                          <p className="text-[8px] text-zinc-600 tracking-widest mt-1 normal-case">{label}</p>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Leaderboard PR per condivisioni */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] text-[#D4AF37] tracking-widest flex items-center gap-2">🏆 PR — Classifica Condivisioni</p>
                      <button onClick={() => handleResetStats('shares', 'Condivisioni')} className="text-[8px] text-red-500/50 hover:text-red-500 transition-colors normal-case font-normal">reset</button>
                    </div>
                    {prShares.length === 0
                      ? <p className="text-zinc-600 text-[10px] normal-case">Nessuna condivisione PR ancora registrata</p>
                      : prShares.sort(([,a],[,b]) => b - a).map(([prId, count], i) => (
                        <div key={prId} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                          <span className={`text-sm font-black w-6 ${i === 0 ? 'text-[#D4AF37]' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-700' : 'text-zinc-700'}`}>
                            {i + 1}°
                          </span>
                          <span className="font-black text-white text-[11px] flex-1 normal-case">
                            {stats.prNames?.[prId] || prId}
                          </span>
                          <span className="text-[#D4AF37] font-black">{count}</span>
                          <span className="text-zinc-600 text-[9px]">share</span>
                        </div>
                      ))
                    }
                    <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center">
                      <span className="text-[9px] text-zinc-500 normal-case">Condivisioni utenti esterni (MASTER)</span>
                      <span className="text-orange-400 font-black">{stats.shares?.by_pr?.MASTER ?? 0}</span>
                    </div>
                  </div>

                  {/* Sezioni più visitate */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] text-zinc-500 tracking-widest">Sezioni più visitate</p>
                      <button onClick={() => handleResetStats('categories', 'Sezioni')} className="text-[8px] text-red-500/50 hover:text-red-500 transition-colors normal-case font-normal">reset</button>
                    </div>
                    {catCounts.every(c => c === 0) ? (
                      <p className="text-[10px] text-zinc-600 normal-case font-normal py-2">Nessuna visita registrata — i dati appariranno con l'utilizzo dell'app.</p>
                    ) : cats.map((cat, idx) => (
                      <div key={cat} className="flex items-center gap-3 mb-3">
                        <span className="text-[9px] font-black text-zinc-400 w-24 flex-shrink-0">{cat}</span>
                        <div className="flex-1 bg-zinc-800 rounded-full h-2">
                          <div className="bg-[#D4AF37] h-2 rounded-full transition-all" style={{ width: `${(catCounts[idx] / maxCat) * 100}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-zinc-400 w-6 text-right">{catCounts[idx]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Film più visti */}
                  {Object.keys(stats.films).length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] text-zinc-500 tracking-widest">Film più cliccati</p>
                        <button onClick={() => handleResetStats('films', 'Film')} className="text-[8px] text-red-500/50 hover:text-red-500 transition-colors normal-case font-normal">reset</button>
                      </div>
                      {Object.entries(stats.films).sort(([,a],[,b]) => b - a).slice(0, 5).map(([title, count]) => (
                        <div key={title} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                          <span className="text-[10px] font-black text-white normal-case truncate max-w-[75%]">{title.replace(/_/g, ' ')}</span>
                          <span className="text-[#D4AF37] font-black">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grafico trend — barre verticali */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] text-zinc-500 tracking-widest">Trend</p>
                      <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
                        {[['share','Condivisioni','#D4AF37'],['visite','Visite','#60a5fa']].map(([key, label, color]) => (
                          <button key={key} onClick={() => setTrendMetric(key)}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${trendMetric === key ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Barre verticali */}
                    {(() => {
                      const barData = trendMetric === 'share' ? shareData : visitData;
                      const maxBar = Math.max(...barData, 1);
                      const color = trendMetric === 'share' ? '#D4AF37' : '#60a5fa';
                      const keys = [...curKeys].reverse();
                      const hasData = barData.some(v => v > 0);

                      if (!hasData) return (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-40">
                          <BarChart2 size={32} className="text-zinc-600" />
                          <p className="text-[10px] text-zinc-500 font-black normal-case text-center">
                            Nessun dato per questo periodo.<br />I grafici si popolano con l'utilizzo dell'app.
                          </p>
                        </div>
                      );

                      return (
                        <>
                          <div className="flex items-end gap-1 h-24">
                            {barData.map((v, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                                {v > 0 && trendDays <= 7 && (
                                  <span className="text-[7px] font-black mb-0.5" style={{ color }}>{v}</span>
                                )}
                                <div className="w-full rounded-t-md transition-all duration-500"
                                  style={{ height: `${Math.max((v / maxBar) * 88, v > 0 ? 4 : 0)}px`, background: color }} />
                              </div>
                            ))}
                          </div>
                          <div className={`flex mt-2 ${trendDays > 7 ? 'justify-between' : 'gap-1'}`}>
                            {trendDays > 7
                              ? keys.filter((_, i) => i === 0 || i === Math.floor(keys.length / 2) || i === keys.length - 1).map(k => (
                                  <span key={k} className="text-[8px] text-zinc-500">
                                    {new Date(k).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                  </span>
                                ))
                              : keys.map(k => (
                                  <span key={k} className="flex-1 text-center text-[8px] text-zinc-500">
                                    {new Date(k).getDate()}
                                  </span>
                                ))
                            }
                          </div>
                        </>
                      );
                    })()}

                    {filteredDays && (
                      <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-[8px] text-zinc-600 normal-case mb-1">Periodo prec.</p>
                          <p className="text-sm font-black text-zinc-400">{trendMetric === 'share' ? prevShares : prevVisits}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] text-zinc-600 normal-case mb-1">Periodo att.</p>
                          <p className="text-sm font-black" style={{ color: trendMetric === 'share' ? '#D4AF37' : '#60a5fa' }}>
                            {trendMetric === 'share' ? totalShares : totalVisits}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] text-zinc-600 normal-case mb-1">Crescita</p>
                          <GrowthBadge
                            current={trendMetric === 'share' ? totalShares : totalVisits}
                            previous={trendMetric === 'share' ? prevShares : prevVisits}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center bg-zinc-900 border border-zinc-700 text-zinc-400 py-4 rounded-2xl text-[10px] font-black tracking-widest hover:border-blue-500 hover:text-blue-400 transition-all">
                    Apri Google Analytics →
                  </a>
                </>
              );
            })()}
          </div>
        )}

        {/* SEZIONE GRUPPI ADMIN */}
        {activeView === 'groups' && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-green-400 text-xs tracking-widest italic flex items-center gap-2"><Building2 size={14} /> Gruppi Admin</h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1"><ChevronLeft size={14} /> Indietro</button>
            </div>

            {/* Form crea nuovo gruppo */}
            <div className="bg-zinc-900 border border-green-500/30 rounded-3xl p-6 space-y-4">
              <p className="text-[10px] text-green-400 font-black tracking-widest flex items-center gap-2"><Plus size={12}/> NUOVO GRUPPO</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] text-zinc-500 mb-1 tracking-widest">ID GRUPPO</p>
                  <input
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-green-500"
                    placeholder="es. discoteca-x"
                    value={groupForm.id}
                    onChange={e => setGroupForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g,'-') }))}
                  />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 mb-1 tracking-widest">NOME</p>
                  <input
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-green-500"
                    placeholder="es. Discoteca X"
                    value={groupForm.name}
                    onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 mb-1 tracking-widest">TIPO</p>
                  <select
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-green-500"
                    value={groupForm.type}
                    onChange={e => setGroupForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="DISCOTECA">DISCOTECA</option>
                    <option value="LOUNGE/PUB">LOUNGE/PUB</option>
                  </select>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 mb-1 tracking-widest">PASSWORD</p>
                  <input
                    type="text"
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-green-500"
                    placeholder="password admin"
                    value={groupForm.password}
                    onChange={e => setGroupForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={groupLoading}
                className="w-full bg-green-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {groupLoading ? 'Creazione...' : 'Crea Gruppo'}
              </button>
            </div>

            {/* Lista gruppi esistenti */}
            {groups.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm italic">Nessun gruppo creato ancora</div>
            ) : (
              <div className="space-y-3">
                {groups.map(group => (
                  <div key={group.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-black text-white text-lg italic">{group.name}</p>
                        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${group.type === 'DISCOTECA' ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'}`}>
                          {group.type}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteGroup(group)} className="text-red-500/40 hover:text-red-500 transition-colors p-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/40 rounded-xl p-3">
                        <p className="text-[8px] text-zinc-600 mb-1 tracking-widest">ID ACCESSO</p>
                        <p className="font-black text-green-400 text-sm">{group.id}</p>
                      </div>
                      <div className="bg-black/40 rounded-xl p-3">
                        <p className="text-[8px] text-zinc-600 mb-1 tracking-widest">PASSWORD</p>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-[#D4AF37] text-sm flex-1">
                            {visiblePasswords[group.id] ? group.password : '••••••••'}
                          </p>
                          <button onClick={() => togglePasswordVisible(group.id)} className="text-zinc-600 hover:text-white">
                            {visiblePasswords[group.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[8px] text-zinc-600 italic">
                      URL Admin: <span className="text-zinc-400">/admin-segreto-stefano</span>
                    </p>

                    {/* Commissioni Master */}
                    <div className="border-t border-zinc-800 pt-3 space-y-2">
                      <p className="text-[9px] text-[#D4AF37] font-black tracking-widest flex items-center gap-1"><Euro size={10}/> COMMISSIONI MASTER</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'perOrfano', label: 'Per ingresso orfano' },
                          { key: 'perPR', label: 'Per ingresso da PR' },
                          { key: 'perEvento', label: 'Fisso per evento' },
                          { key: 'perQR', label: 'Per QR realizzato' },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-black/40 rounded-xl p-2">
                            <p className="text-[8px] text-zinc-600 mb-1">{label}</p>
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500 text-xs">€</span>
                              <input
                                type="number" min="0" step="0.50"
                                className="w-full bg-transparent text-white font-black text-sm outline-none"
                                placeholder="0"
                                value={commissionInputs[group.id]?.[key] ?? ''}
                                onChange={e => setCommissionInputs(prev => ({
                                  ...prev,
                                  [group.id]: { ...(prev[group.id] || {}), [key]: e.target.value }
                                }))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleSaveCommissions(group.id)}
                        className="w-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black py-2 rounded-xl tracking-widest active:scale-95 transition-transform"
                      >
                        SALVA COMMISSIONI
                      </button>
                    </div>

                    {/* Lista PR del gruppo */}
                    <div className="border-t border-zinc-800 pt-3 space-y-2">
                      <p className="text-[9px] text-zinc-400 font-black tracking-widest flex items-center gap-1">
                        <Users size={10}/> PR DEL GRUPPO {groupPrs[group.id]?.length > 0 && `(${groupPrs[group.id].length})`}
                      </p>
                      {groupPrs[group.id]?.length > 0 ? (
                        <div className="space-y-1.5">
                          {groupPrs[group.id].map(pr => (
                            <div key={pr.id} className="bg-black/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[9px] font-black text-white truncate">{pr.name}</span>
                                <span className="text-[8px] text-zinc-600 shrink-0">{pr.id}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[9px] font-black text-[#D4AF37]">
                                  {visiblePrPasswords[pr.id] ? (pr.prPassword || 'PR') : '•••'}
                                </span>
                                <button onClick={() => setVisiblePrPasswords(prev => ({ ...prev, [pr.id]: !prev[pr.id] }))} className="text-zinc-600 hover:text-white">
                                  {visiblePrPasswords[pr.id] ? <EyeOff size={12}/> : <Eye size={12}/>}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[8px] text-zinc-700 italic">Nessun PR ancora in questo gruppo</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <div key={ev.id} className="relative bg-zinc-900 border-2 border-zinc-800 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                <button onClick={() => handleDeleteEvent(ev)} className="absolute top-3 right-3 text-red-500/30 hover:text-red-500 transition-colors p-1.5">
                  <Trash2 size={14} />
                </button>
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

        {/* SEZIONE PUBBLICITÀ POPUP */}
        {activeView === 'popup' && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 max-w-sm mx-auto space-y-6 pb-10">
            <div className="flex items-center justify-between mb-2 px-4">
              <h2 className="text-purple-400 text-xs tracking-widest italic flex items-center gap-2">
                <Star size={14} /> Pubblicità Apertura App
              </h2>
              <button onClick={() => setActiveView(null)} className="text-red-500 text-[10px] underline flex items-center gap-1">
                <ChevronLeft size={14} /> Indietro
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">

              {/* LOCANDINA / BANNER */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">🖼 Locandina / Banner</p>
                <label className="block w-full border-2 border-dashed border-zinc-700 bg-black rounded-2xl p-4 text-center cursor-pointer active:bg-zinc-900 transition-all">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files[0]) setPopupFile(e.target.files[0]); }} />
                  <span className="text-purple-400 font-black text-sm uppercase">
                    {popupFile ? popupFile.name : '⬆ Cambia immagine'}
                  </span>
                </label>
                {(popupFile || popupConfig.imageUrl) && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-purple-500/40 relative">
                    <img src={popupFile ? URL.createObjectURL(popupFile) : popupConfig.imageUrl} alt="Anteprima" className="w-full object-contain max-h-48" />
                    <button onClick={() => { setPopupFile(null); setPopupConfig(p => ({ ...p, imageUrl: '' })); }} className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1"><X size={14} /></button>
                  </div>
                )}
              </div>

              {/* URL VIDEO SPOT */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">🎬 URL Video Spot (opzionale)</p>
                <input type="url" placeholder="https://... (.mp4 o link diretto)"
                  className="w-full p-4 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-sm normal-case"
                  value={popupConfig.videoUrl || ''} onChange={e => setPopupConfig(p => ({ ...p, videoUrl: e.target.value }))} />
                <p className="text-[9px] text-zinc-600 mt-1.5 normal-case italic">Se impostato, mostra il video al posto della locandina</p>
              </div>

              {/* SLOGAN */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">✏️ Slogan / Offerta</p>
                <input type="text" placeholder="es. Ingresso gratuito fino alle 24:00"
                  className="w-full p-4 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-sm normal-case"
                  value={popupConfig.slogan || ''} onChange={e => setPopupConfig(p => ({ ...p, slogan: e.target.value }))} />
              </div>

              {/* INDIRIZZO */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">📍 Indirizzo</p>
                <input type="text" placeholder="es. Via Roma 1, Catania"
                  className="w-full p-4 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-sm normal-case"
                  value={popupConfig.address || ''} onChange={e => setPopupConfig(p => ({ ...p, address: e.target.value }))} />
              </div>

              {/* SCADENZA OFFERTA */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">⏳ Scadenza Offerta</p>
                <input type="date"
                  className="w-full p-4 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-sm"
                  value={popupConfig.expiry || ''} onChange={e => setPopupConfig(p => ({ ...p, expiry: e.target.value }))} />
                <p className="text-[9px] text-zinc-600 mt-1.5 normal-case italic">Mostra un conto alla rovescia nel popup</p>
              </div>

              {/* QR CODE */}
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">📲 URL per QR Code</p>
                <input type="url" placeholder="https://... (link a cui punta il QR)"
                  className="w-full p-4 bg-black border border-zinc-700 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-sm normal-case"
                  value={popupConfig.qrUrl || ''} onChange={e => setPopupConfig(p => ({ ...p, qrUrl: e.target.value }))} />
                <p className="text-[9px] text-zinc-600 mt-1.5 normal-case italic">Mostra un QR nel popup che porta a questo link</p>
              </div>

              {/* SALVA IN GALLERIA */}
              <div className="flex items-center justify-between bg-black border border-zinc-700 rounded-2xl px-5 py-4">
                <div>
                  <p className="text-sm font-black text-white">Pulsante "Salva Promo"</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 normal-case">Mostra il tasto per salvare il popup in galleria</p>
                </div>
                <button
                  onClick={() => setPopupConfig(p => ({ ...p, showSaveButton: !p.showSaveButton }))}
                  className={`relative w-14 h-7 rounded-full transition-colors border-2 flex-shrink-0 ${popupConfig.showSaveButton ? 'bg-purple-600 border-purple-500' : 'bg-zinc-700 border-zinc-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${popupConfig.showSaveButton ? 'left-7' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <p className="text-[9px] text-zinc-600 normal-case italic">
                  Il popup appare all'apertura, con 5s di attesa prima di chiudere. Non si ripete per 5 minuti.
                </p>
                <button
                  onClick={() => { localStorage.removeItem('popup_last_shown'); alert('Cooldown azzerato — riapri la home per testare il popup.'); }}
                  className="w-full border border-purple-500/40 text-purple-400 p-3 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
                >
                  🔄 TESTA POPUP (AZZERA COOLDOWN)
                </button>
              </div>

              <button onClick={handleSavePopup} disabled={popupSaving}
                className="w-full bg-purple-600 text-white p-5 rounded-full font-black uppercase tracking-widest text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {popupSaving ? 'Salvataggio...' : '💾 Salva Pubblicità'}
              </button>
            </div>
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
