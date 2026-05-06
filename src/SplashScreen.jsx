import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { X } from 'lucide-react';

const AD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minuti

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('logo'); // 'logo' | 'ad' | 'done'
  const [adConfig, setAdConfig] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const videoRef = useRef(null);

  useEffect(() => {
    let timerFired = false;
    let configLoaded = false;
    let loadedConfig = null;

    const decide = () => {
      if (!timerFired || !configLoaded) return;
      const lastSeen = sessionStorage.getItem('ad_last_seen');
      const cooldownOk = !lastSeen || Date.now() - Number(lastSeen) > AD_COOLDOWN_MS;
      const hasContent = loadedConfig?.videoUrl || loadedConfig?.imageUrl;
      if (loadedConfig?.enabled && hasContent && cooldownOk) {
        setAdConfig(loadedConfig);
        setPhase('ad');
      } else {
        setPhase('done');
      }
    };

    const t = setTimeout(() => { timerFired = true; decide(); }, 1800);

    getDoc(doc(db, 'settings', 'splash_ad'))
      .then(snap => { if (snap.exists()) loadedConfig = snap.data(); })
      .catch(() => {})
      .finally(() => { configLoaded = true; decide(); });

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'ad' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === 'done') onDone();
  }, [phase, onDone]);

  const handleVideoEnd = () => setCountdown(0);

  const closeAd = () => {
    sessionStorage.setItem('ad_last_seen', String(Date.now()));
    setPhase('done');
  };

  if (phase === 'logo') {
    return (
      <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center">
        <style>{`
          @keyframes splashLogo {
            0%   { opacity: 0; transform: scale(0.7); }
            40%  { opacity: 1; transform: scale(1.05); }
            65%  { transform: scale(0.97); }
            100% { opacity: 1; transform: scale(1); }
          }
          .animate-splash-logo {
            animation: splashLogo 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
        `}</style>
        <img src="/logo.png" alt="Logo" className="w-32 h-32 object-contain animate-splash-logo" />
      </div>
    );
  }

  if (phase === 'ad' && adConfig) {
    const isVideo = !!adConfig.videoUrl;

    return (
      <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-end justify-center pb-8 px-4">
        <div className="relative w-full max-w-sm bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-400">

          {/* Media: video o immagine */}
          {isVideo ? (
            <video
              ref={videoRef}
              src={adConfig.videoUrl}
              autoPlay
              muted={false}
              playsInline
              onEnded={handleVideoEnd}
              className="w-full object-cover"
            />
          ) : adConfig.imageUrl ? (
            <img
              src={adConfig.imageUrl}
              alt={adConfig.title || 'Pubblicità'}
              className="w-full object-cover"
            />
          ) : null}

          {/* Slogan / offerta — sopra il footer */}
          {adConfig.slogan ? (
            <div className="bg-purple-700 px-4 py-2.5 text-center">
              <p className="text-white text-sm font-black uppercase tracking-wide">{adConfig.slogan}</p>
            </div>
          ) : null}

          {/* Footer: etichetta + pulsante chiudi */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              {adConfig.title || 'Pubblicità'}
            </span>
            <button
              onClick={countdown <= 0 ? closeAd : undefined}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                countdown <= 0
                  ? 'bg-white text-black active:scale-95 cursor-pointer'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {countdown > 0 ? (
                <span>{countdown}s</span>
              ) : (
                <><X size={12} /><span>CHIUDI</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
