'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ZOOM_OPTIONS = [0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5, 1.7, 2.0];
const FLASH_OPTIONS = [
  { id: 'off', label: 'Off', icon: '🚫' },
  { id: 'auto', label: 'Auto', icon: '⚡' },
  { id: 'on', label: 'Torch / Always On', icon: '💡' }
];

export default function PresetsPage() {
  const router = useRouter();

  const [selectedZoom, setSelectedZoom] = useState(1.0);
  const [selectedFlash, setSelectedFlash] = useState('off');
  const [savedBanner, setSavedBanner] = useState(false);

  // Load existing presets from localStorage on mount
  useEffect(() => {
    const storedZoom = localStorage.getItem('camera_preset_zoom');
    const storedFlash = localStorage.getItem('camera_preset_flash');

    if (storedZoom) setSelectedZoom(parseFloat(storedZoom));
    if (storedFlash) setSelectedFlash(storedFlash);
  }, []);

  // Save presets to localStorage
  const handleSave = () => {
    localStorage.setItem('camera_preset_zoom', selectedZoom.toString());
    localStorage.setItem('camera_preset_flash', selectedFlash);

    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      router.push('/');
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col justify-between p-6 select-none font-sans overflow-y-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pt-4 pb-6">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold active:scale-95 transition-transform"
          >
            ✕
          </button>
          <h1 className="text-base font-extrabold tracking-wide">Camera Presets</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Section 1: Zoom Levels */}
        <div className="mt-2 bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm font-bold text-white">Default Zoom Size</p>
              <p className="text-[11px] text-neutral-400">Select active viewfinder scaling</p>
            </div>
            <span className="font-mono text-sm font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-500/20">
              {selectedZoom}x
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {ZOOM_OPTIONS.map((zoom) => {
              const isSelected = selectedZoom === zoom;
              return (
                <button
                  key={zoom}
                  onClick={() => setSelectedZoom(zoom)}
                  className={`py-3 rounded-xl font-mono text-xs font-extrabold border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20'
                      : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {zoom}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Flash Mode */}
        <div className="mt-4 bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-sm font-bold text-white">Flash Settings</p>
            <p className="text-[11px] text-neutral-400">Default torch state when opening camera</p>
          </div>

          <div className="flex flex-col gap-2">
            {FLASH_OPTIONS.map((flash) => {
              const isSelected = selectedFlash === flash.id;
              return (
                <button
                  key={flash.id}
                  onClick={() => setSelectedFlash(flash.id)}
                  className={`py-3.5 px-4 rounded-xl flex items-center justify-between border transition-all active:scale-98 ${
                    isSelected
                      ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/50 font-bold'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{flash.icon}</span>
                    <span className="text-xs font-semibold">{flash.label}</span>
                  </div>
                  {isSelected && <span className="text-xs font-mono">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Save Action Bar */}
      <div className="pb-6 pt-4">
        {savedBanner && (
          <div className="mb-3 py-2 text-center bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold rounded-xl animate-in fade-in">
            ✓ Presets saved!
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-yellow-400 text-black font-extrabold text-sm active:scale-95 transition-transform shadow-lg shadow-yellow-400/20"
        >
          Save Presets & Back
        </button>
      </div>
    </div>
  );
}
