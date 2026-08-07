'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotNumber, setLotNumber] = useState('');

  const handleStartShooting = (e) => {
    e.preventDefault();
    if (!lotNumber.trim()) return;
    
    const formattedLot = lotNumber.trim().toUpperCase();
    router.push(`/camera?lot=${encodeURIComponent(formattedLot)}`);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col justify-between p-6 select-none font-sans">
      {/* Top Header */}
      <div className="pt-8 text-center">
        <span className="text-xs font-mono font-bold tracking-widest text-yellow-400 uppercase bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-500/20">
          Inspection Suite
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mt-3">Auto Cam Manager</h1>
        <p className="text-xs text-neutral-400 mt-1">High-speed lot photography & sync</p>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col gap-4 my-auto max-w-sm w-full mx-auto">
        {/* 1. Camera Preset Button */}
        <button
          onClick={() => router.push('/presets')}
          className="w-full py-4 px-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-between active:scale-98 transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-lg">
              ⚙️
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Camera Presets</p>
              <p className="text-[11px] text-neutral-400">Zoom steps & Flash behavior</p>
            </div>
          </div>
          <span className="text-neutral-500 text-sm">→</span>
        </button>

        {/* 2. Take Photos Button */}
        <button
          onClick={() => setShowLotModal(true)}
          className="w-full py-5 px-5 rounded-2xl bg-yellow-400 text-black font-extrabold flex items-center justify-between active:scale-98 transition-all shadow-lg shadow-yellow-400/20"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-xl">
              📷
            </span>
            <div className="text-left">
              <p className="text-base font-extrabold">Take Photos</p>
              <p className="text-[11px] text-black/70">Start shoot by Lot Number</p>
            </div>
          </div>
          <span className="text-black/60 text-lg">→</span>
        </button>

        {/* 3. Gallery Button */}
        <button
          onClick={() => router.push('/gallery')}
          className="w-full py-4 px-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-between active:scale-98 transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-lg">
              🖼️
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Gallery</p>
              <p className="text-[11px] text-neutral-400">Date & Lot organized folders</p>
            </div>
          </div>
          <span className="text-neutral-500 text-sm">→</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="pb-4 text-center">
        <p className="text-[10px] font-mono text-neutral-500">
          QUEUE ENGINE ACTIVE • AUTO-SYNC ENABLED
        </p>
      </div>

      {/* Lot Number Input Modal */}
      {showLotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Enter Lot Number</h2>
              <button
                onClick={() => setShowLotModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartShooting} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 5032"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full py-3 px-4 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono text-center text-xl font-bold uppercase focus:outline-none focus:border-yellow-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-yellow-400 text-black font-extrabold text-sm active:scale-95 transition-transform"
              >
                Open Viewfinder →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
