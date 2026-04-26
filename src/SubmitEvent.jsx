import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { ChevronLeft, Phone, User, Calendar, MapPin, Tag, FileText, Upload, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  { id: 'DISCOTECA', label: 'Discoteca' },
  { id: 'TEATRO', label: 'Teatro' },
  { id: 'CINEMA', label: 'Cinema' },
  { id: 'CONCERTI', label: 'Concerti' },
  { id: 'ARENE ESTIVE', label: 'Arene Estive' },
  { id: 'PUB', label: 'Lounge/Pub' },
];

const SubmitEvent = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState({ price: 10, isFree: true });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [form, setForm] = useState({
    nome: '', cognome: '', phone: '',
    title: '', date: '', category: 'DISCOTECA',
    location: '', description: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'eventSubmission'));
        if (snap.exists()) setSettings(snap.data());
      } catch {}
    };
    fetchSettings();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 800 / img.width;
          canvas.width = 800;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.cognome.trim() || !form.phone.trim()) {
      return alert('Inserisci nome, cognome e telefono');
    }
    setLoading(true);
    try {
      const imageUrl = selectedFile ? await compressImage(selectedFile) : '';
      await addDoc(collection(db, 'event_proposals'), {
        ...form,
        imageUrl,
        status: 'pending',
        isFree: settings.isFree,
        price: settings.price,
        timestamp: new Date()
      });
      setSubmitted(true);
    } catch {
      alert("Errore durante l'invio. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle size={80} className="text-[#D4AF37] mb-8" />
        <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Richiesta Inviata!</h1>
        <p className="text-zinc-400 font-bold text-sm mb-10 max-w-xs leading-relaxed uppercase">
          La tua proposta è in attesa di approvazione. Ti contatteremo al numero fornito.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#D4AF37] text-black px-10 py-4 rounded-full font-black uppercase text-xs tracking-widest active:scale-95 transition-transform"
        >
          Torna alla Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 uppercase font-black">
      <div className="p-6 border-b border-white/10 sticky top-0 bg-black/90 backdrop-blur z-50 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-[9px] text-[#D4AF37] tracking-[0.3em] font-black uppercase">Evento Esterno</p>
          <h1 className="text-xl font-black italic uppercase tracking-tighter">Inserisci il Tuo Evento</h1>
        </div>
      </div>

      <div className="px-6 pt-8 max-w-lg mx-auto">
        {/* Badge prezzo */}
        <div className="flex items-center justify-between bg-zinc-900 border border-white/5 rounded-[2rem] p-6 mb-8">
          <div>
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Costo Inserimento</p>
            {settings.isFree ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-zinc-600 line-through">€{settings.price}</span>
                <span className="bg-[#D4AF37] text-black text-xs font-black px-3 py-1 rounded-full uppercase">Gratuito</span>
              </div>
            ) : (
              <span className="text-2xl font-black text-[#D4AF37]">€{settings.price}</span>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Tag size={22} className="text-[#D4AF37]" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dati personali */}
          <div>
            <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-widest mb-4">I Tuoi Dati</p>
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="text" placeholder="Nome" required
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37]"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="text" placeholder="Cognome" required
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37]"
                  value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="tel" placeholder="Telefono / WhatsApp" required
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37]"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Dettagli evento */}
          <div>
            <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-widest mb-4">Dettagli Evento</p>
            <div className="space-y-3">
              <input
                type="text" placeholder="Nome Evento" required
                className="w-full p-5 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37]"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="date" required
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black outline-none focus:border-[#D4AF37]"
                  value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <select
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37] appearance-none"
                  value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="text" placeholder="Location / Luogo" required
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black uppercase outline-none focus:border-[#D4AF37]"
                  value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="relative">
                <FileText className="absolute left-4 top-5 text-zinc-600" size={18} />
                <textarea
                  placeholder="Descrizione, listino, info utili..."
                  className="w-full p-5 pl-12 bg-zinc-900 border border-white/10 rounded-2xl text-white font-black outline-none focus:border-[#D4AF37] h-28 resize-none text-xs uppercase"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Locandina */}
          <div>
            <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-widest mb-4">Locandina (Opzionale)</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-colors"
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-40 object-contain rounded-xl" />
              ) : (
                <>
                  <Upload size={32} className="text-zinc-600 mb-3" />
                  <p className="text-zinc-500 font-black text-xs uppercase">Carica Locandina</p>
                </>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] text-black p-6 rounded-full font-black uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'Invio in corso...' : 'Invia Proposta Evento'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitEvent;
