'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotNumber, setLotNumber] = useState('');
  // Recent lots list for fast 1-tap entry
  const [recentLots] = useState(['LOT-8821', 'LOT-8822', 'LOT-8815']);

  const handleStartCapture = (e) => {
    e.preventDefault();
    if (!lotNumber.trim()) return;
    // Navigates to the continuous touch camera with the chosen Lot Number
    window.location.href = `/camera?lot=${encodeURIComponent(lotNumber.trim())}`;
  };

  return (
    <main className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full min-h-screen bg-black">
      {/* Top Header */}
      <div className="pt-8 text-center">
        <span className="inline-block px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-bold tracking-widest uppercase rounded-full border border-yellow-500/20 mb-3">
          Pro Auction Camera
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Auction Photos
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Fast capture • Auto-compressed &lt; 200 KB
        </p>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col gap-5 my-auto">
        {/* Button 1: Take Photos */}
        <button
          onClick={() => setShowLotModal(true)}
          className="w-full py-6 px-6 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all duration-150 rounded-2xl flex items-center justify-between text-left shadow-lg shadow-blue-900/30 border border-blue-400/30"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl">
              📸
            </div>
            <div>
              <div className="text-xl font-bold text-white">Take Photos</div>
              <div className="text-xs text-blue-200 mt-0.5">
                Full-screen touch capture
              </div>
            </div>
          </div>
          <span className="text-2xl text-blue-200">➔</span>
        </button>

        {/* Button 2: Gallery */}
        <Link
          href="/gallery"
          className="w-full py-6 px-6 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] transition-all duration-150 rounded-2xl flex items-center justify-between text-left border border-neutral-800"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-neutral-800 flex items-center justify-center text-3xl">
              🖼️
            </div>
            <div>
              <div className="text-xl font-bold text-white">Gallery</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                Lots, folders &amp; share links
              </div>
            </div>
          </div>
          <span className="text-2xl text-neutral-500">➔</span>
        </Link>
      </div>

      {/* Footer Info */}
      <div className="pb-6 text-center text-xs text-neutral-600">
        Connected to Neon DB &amp; Cloudinary
      </div>

      {/* Lot Number Modal Overlay */}
      {showLotModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Enter Lot Number</h2>
              <button
                onClick={() => setShowLotModal(false)}
                className="text-neutral-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartCapture} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="e.g. LOT-8821"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-4 bg-black border border-neutral-700 rounded-xl text-lg font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 uppercase tracking-wide"
                />
              </div>

              {/* Recent Lots Quick-Selector */}
              {recentLots.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">
                    Recent Lots
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentLots.map((lot) => (
                      <button
                        key={lot}
                        type="button"
                        onClick={() => setLotNumber(lot)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono rounded-lg border border-neutral-700 text-neutral-300 transition-colors"
                      >
                        {lot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLotModal(false)}
                  className="flex-1 py-3.5 bg-neutral-800 text-neutral-300 font-semibold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-900/40"
                >
                  Open Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
