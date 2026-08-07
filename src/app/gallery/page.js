'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GalleryPage() {
  const router = useRouter();

  // Navigation & state variables
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState(null); // Active folder view
  const [activePhoto, setActivePhoto] = useState(null); // Photo open in Editor

  // Editor adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Fetch photos from server database
  useEffect(() => {
    async function fetchGalleryData() {
      try {
        const res = await fetch('/api/photos');
        const data = await res.json();
        if (Array.isArray(data)) {
          setPhotos(data);
        }
      } catch (err) {
        console.error('Error loading gallery photos:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGalleryData();
  }, []);

  // Group photos by Date -> Lot Number
  const groupedGallery = photos.reduce((acc, photo) => {
    const dateKey = photo.dateStr || photo.createdAt?.split('T')[0] || 'Unassigned Date';
    const lotKey = photo.lotNumber || 'UNNAMED-LOT';

    if (!acc[dateKey]) acc[dateKey] = {};
    if (!acc[dateKey][lotKey]) acc[dateKey][lotKey] = [];

    acc[dateKey][lotKey].push(photo);
    return acc;
  }, {});

  // Delete single photo
  const handleDeletePhoto = async (photoId, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await fetch(`/api/photos?id=${photoId}`, { method: 'DELETE' });
      setPhotos((prev) => prev.filter((p) => p._id !== photoId && p.id !== photoId));
      if (activePhoto && (activePhoto._id === photoId || activePhoto.id === photoId)) {
        setActivePhoto(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Open photo in editor
  const handleOpenEditor = (photo, e) => {
    if (e) e.stopPropagation();
    setBrightness(100);
    setContrast(100);
    setRotation(0);
    setActivePhoto(photo);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col justify-between p-4 select-none font-sans overflow-y-auto">
      
      {/* Top Bar Header */}
      <div className="pt-4 pb-4 px-2 flex justify-between items-center border-b border-neutral-800/80">
        <button
          onClick={() => {
            if (selectedLot) {
              setSelectedLot(null);
            } else {
              router.push('/');
            }
          }}
          className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold active:scale-95 transition-transform"
        >
          {selectedLot ? '←' : '✕'}
        </button>

        <div className="text-center">
          <h1 className="text-sm font-extrabold tracking-wide">
            {selectedLot ? `LOT: ${selectedLot.lotNumber}` : 'Gallery Directory'}
          </h1>
          <p className="text-[10px] text-neutral-400 font-mono">
            {selectedLot ? `${selectedLot.photos.length} PHOTOS` : 'DATE & LOT STRUCTURE'}
          </p>
        </div>

        {selectedLot ? (
          <button
            onClick={() => router.push(`/camera?lot=${encodeURIComponent(selectedLot.lotNumber)}`)}
            className="px-3 py-1.5 rounded-full bg-yellow-400 text-black text-xs font-extrabold flex items-center gap-1 active:scale-95 transition-transform shadow-sm shadow-yellow-400/20"
          >
            <span>📷</span> +More
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 my-4 overflow-y-auto">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs font-mono text-neutral-500">
            Loading folders...
          </div>
        ) : selectedLot ? (
          
          /* VIEW 2: Inside Lot Folder */
          <div className="grid grid-cols-2 gap-3 p-1">
            {selectedLot.photos.map((photo, index) => (
              <div
                key={photo._id || photo.id || index}
                className="relative group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden aspect-square"
              >
                <img
                  src={photo.cloudinaryUrl || photo.url}
                  alt="Lot preview"
                  className="w-full h-full object-cover"
                />

                {/* Photo Action Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-100 flex items-end justify-between p-2">
                  <button
                    onClick={(e) => handleOpenEditor(photo, e)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900/90 border border-white/20 text-[10px] font-bold text-white backdrop-blur-md active:scale-95"
                  >
                    ✏️ Edit
                  </button>

                  <button
                    onClick={(e) => handleDeletePhoto(photo._id || photo.id, e)}
                    className="w-7 h-7 rounded-lg bg-red-500/80 text-white text-xs font-bold flex items-center justify-center backdrop-blur-md active:scale-95"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (

          /* VIEW 1: Date & Lot Folder Directory */
          <div className="space-y-6">
            {Object.keys(groupedGallery).length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <span className="text-3xl mb-2">📁</span>
                <p className="text-sm font-bold text-neutral-300">No Folders Found</p>
                <p className="text-xs text-neutral-500 mt-1">Start taking photos to create Lot folders.</p>
              </div>
            ) : (
              Object.entries(groupedGallery).map(([dateStr, lotGroup]) => (
                <div key={dateStr} className="space-y-3">
                  {/* Date Group Header */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-md border border-yellow-500/20">
                      📅 {dateStr}
                    </span>
                  </div>

                  {/* Lot Folders */}
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(lotGroup).map(([lotNum, folderPhotos]) => (
                      <div
                        key={lotNum}
                        onClick={() => setSelectedLot({ lotNumber: lotNum, photos: folderPhotos })}
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-col justify-between hover:border-neutral-700 active:scale-98 transition-all cursor-pointer"
                      >
                        {/* Preview Thumbnail Grid */}
                        <div className="w-full h-24 bg-neutral-950 rounded-xl overflow-hidden mb-3 relative">
                          {folderPhotos[0] ? (
                            <img
                              src={folderPhotos[0].cloudinaryUrl || folderPhotos[0].url}
                              alt="Lot Folder cover"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700 text-xl">
                              📷
                            </div>
                          )}
                          <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold text-white">
                            {folderPhotos.length}
                          </span>
                        </div>

                        {/* Folder Info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-extrabold text-white font-mono">LOT {lotNum}</p>
                            <p className="text-[10px] text-neutral-400">Tap to inspect</p>
                          </div>
                          <span className="text-neutral-500 text-xs">→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4">
          <div className="flex justify-between items-center pt-4">
            <button
              onClick={() => setActivePhoto(null)}
              className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
            <h2 className="text-xs font-bold font-mono text-yellow-400">PHOTO EDITOR</h2>
            <button
              onClick={() => {
                alert('Edits applied successfully!');
                setActivePhoto(null);
              }}
              className="px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-extrabold"
            >
              Done
            </button>
          </div>

          {/* Canvas Preview with Dynamic Filters */}
          <div className="flex-1 my-6 flex items-center justify-center overflow-hidden">
            <img
              src={activePhoto.cloudinaryUrl || activePhoto.url}
              alt="Editing preview"
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                transform: `rotate(${rotation}deg)`
              }}
              className="max-h-full max-w-full object-contain rounded-xl transition-all"
            />
          </div>

          {/* Quick Controls */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center gap-4">
              <span className="text-xs font-bold text-neutral-400">Rotate</span>
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="py-1.5 px-4 rounded-xl bg-neutral-800 text-xs font-bold text-white border border-neutral-700"
              >
                🔄 90° ({rotation}°)
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400 font-bold">
                <span>Brightness</span>
                <span>{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(e.target.value)}
                className="w-full accent-yellow-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400 font-bold">
                <span>Contrast</span>
                <span>{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={(e) => setContrast(e.target.value)}
                className="w-full accent-yellow-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
