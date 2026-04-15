import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ShieldCheck, Power, LayoutGrid, Crown, Lock } from 'lucide-react';

const SuperAdmin = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState({ isPassEnabled: true, isPriveEnabled: true });
  const [loading, setLoading] = useState(true);

  // 1. Verifica Password (stessa logica Admin ma con "superadmin")
  const handleLogin = () => {
    if (password === 'superadmin') {
      setIsAuthorized(true);
      fetchSettings();
    } else {
      alert("Password SuperAdmin Errata");
      setPassword('');
    }
  };

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "global"));
      if (snap.exists()) {
        setSettings(snap.data());
      } else {
        // Se non esiste, crea il documento iniziale
        await setDoc(doc(db, "settings", "global"), { isPassEnabled: true, isPriveEnabled: true });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (key) => {
    const newValue = !settings[key];
    const updated = { ...settings, [key]: newValue };
    setSettings(updated);
    await setDoc(doc(db, "settings", "global"), updated, { merge: true });
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-10 text-center">
        <div className="w-full max-w-sm space-y-10">
          <ShieldCheck className="mx-auto text-red-600 mb-4" size={80} />
          <h1 className="text-white font-black italic text-2xl uppercase">SuperAdmin Access</h1>
          <input 
            type="password" 
            placeholder="SUPERADMIN CODE" 
            className="w-full p-6 bg-zinc-900 border border-red-900/30 rounded-2xl text-white text-center font-black tracking-[0.6em] outline-none focus:border-red-600" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          <button onClick={handleLogin} className="w-full bg-red-600 text-white p-6 rounded-full font-black uppercase shadow-2xl active:scale-95 transition-all">ENTRA NEL SISTEMA</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
            <h1 className="text-3xl font-black italic flex items-center gap-3">
              <ShieldCheck className="text-red-600" size={32} /> SUPERADMIN
            </h1>
            <span className="text-[10px] bg-red-600/20 text-red-500 px-4 py-1 rounded-full font-black uppercase tracking-widest border border-red-600/30">Livello 0 - Root Access</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CONTROLLO PASS LISTA */}
          <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${settings.isPassEnabled ? 'bg-zinc-900 border-green-500/50' : 'bg-zinc-900/50 border-red-500/50'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${settings.isPassEnabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                <LayoutGrid size={32} />
              </div>
              <button 
                onClick={() => toggleSetting('isPassEnabled')}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${settings.isPassEnabled ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}
              >
                <Power size={28} />
              </button>
            </div>
            <h3 className="text-2xl font-black uppercase italic italic">Tasto Pass (QR)</h3>
            <p className="text-zinc-500 text-sm mt-2 font-bold leading-relaxed">
              Stato attuale: <span className={settings.isPassEnabled ? 'text-green-500' : 'text-red-500'}>{settings.isPassEnabled ? 'ATTIVO' : 'DISATTIVATO'}</span>
              <br />Quando disattivato, gli utenti non potranno generare il QR Pass nella Home.
            </p>
          </div>

          {/* CONTROLLO PRIVÈ */}
          <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${settings.isPriveEnabled ? 'bg-zinc-900 border-amber-500/50' : 'bg-zinc-900/50 border-red-500/50'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${settings.isPriveEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                <Crown size={32} />
              </div>
              <button 
                onClick={() => toggleSetting('isPriveEnabled')}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${settings.isPriveEnabled ? 'bg-amber-500 text-black' : 'bg-red-500 text-white'}`}
              >
                <Power size={28} />
              </button>
            </div>
            <h3 className="text-2xl font-black uppercase italic italic">Tasto Privé</h3>
            <p className="text-zinc-500 text-sm mt-2 font-bold leading-relaxed">
                Stato attuale: <span className={settings.isPriveEnabled ? 'text-amber-500' : 'text-red-500'}>{settings.isPriveEnabled ? 'ATTIVO' : 'DISATTIVATO'}</span>
                <br />Usa questo per chiudere le prenotazioni tavoli in tempo reale.
            </p>
          </div>
        </div>

        <button onClick={() => window.location.reload()} className="mt-12 text-zinc-600 font-black uppercase text-[10px] tracking-widest border-b border-zinc-800 pb-2">Logout SuperAdmin</button>
      </div>
    </div>
  );
};

export default SuperAdmin;