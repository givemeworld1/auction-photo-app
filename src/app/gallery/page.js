'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DB_NAME = 'AutoCamDB';
const STORE_NAME = 'photoQueue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllLocalQueuePhotos() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        const formatted = records.map((r) => {
          let previewUrl = '';
          if (r.blob) {
            previewUrl = URL.createObjectURL(r.blob);
          } else if (r.dataUrl) {
            previewUrl = r.dataUrl;
          }

          return {
            id: r.id,
            rawId: r.id,
            lotNumber: r.lotNumber,
            dateStr: r.dateStr,
            fullUrl: previewUrl,
            thumbUrl: previewUrl,
            blobSize: r.blob?.size || 0,
            isLocal: true
          };
        });
        resolve(formatted);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

async function deleteLocalQueuePhoto(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB delete error:', e);
    return false;
  }
}

function processPhotoUrls(photo) {
  if (photo.isLocal) {
    return {
      thumbUrl: photo.thumbUrl || photo.previewUrl,
      fullUrl: photo.fullUrl || photo.previewUrl
    };
  }

  const rawUrl = photo.cloudinaryUrl || photo.url || '';
  if (rawUrl.includes('res.cloudinary.com') && rawUrl.includes('/upload/')) {
    const thumbUrl = rawUrl.replace('/upload/', '/upload/w_250,q_auto:eco,f_auto/');
    return { thumbUrl, fullUrl: rawUrl };
  }

  return { thumbUrl: rawUrl, fullUrl: rawUrl };
}

export default function GalleryPage() {
  const router = useRouter();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    async function fetchGalleryData() {
      try {
        const localPhotos = await getAllLocalQueuePhotos();

        let serverPhotos = [];
        try {
          const res = await fetch('/api/photos/upload');
          const data = await res.json();
          if (Array.isArray(data)) {
            serverPhotos = data;
          }
        } catch (e) {
          console.warn('Server fetch error:', e);
        }

        const combined = [...localPhotos, ...serverPhotos].map((photo) => {
          const urls = processPhotoUrls(photo);
          return { ...photo, ...urls };
        });

        setPhotos(combined);
      } catch (err) {
        console.error('Error loading gallery photos:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGalleryData();
  }, []);

  const groupedGallery = photos.reduce((acc, photo) => {
    const dateKey = photo.dateStr || photo.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];
    const lotKey = photo.lotNumber || 'UNNAMED-LOT';

    if (!acc[dateKey]) acc[dateKey] = {};
    if (!acc[dateKey][lotKey]) acc[dateKey][lotKey] = [];

    acc[dateKey][lotKey].push(photo);
    return acc;
  }, {});

  const handleDeletePhoto = async (photo, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Delete photo permanently?')) return;

    if (photo.isLocal) {
      if (photo.rawId !== undefined) {
        await deleteLocalQueuePhoto(photo.rawId);
      }
    } else if (photo._id || photo.id) {
      try {
        await fetch(`/api/photos/upload?id=${photo._id || photo.id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Server delete error:', err);
      }
    }

    setPhotos((prev) => prev.filter((p) => p !== photo));

    if (selectedLot) {
      setSelectedLot((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p !== photo)
      }));
    }

    if (activePhoto === photo) setActivePhoto(null);
  };

  const handleOpenEditor = (photo, e) => {
    if (e) e.stopPropagation();
    setBrightness(100);
    setContrast(100);
    setRotation(0);
    setActivePhoto(photo);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col justify-between p-4 select-none font-sans overflow-hidden">
      
      {/* Navigation Header */}
      <div className="pt-2 pb-3 px-1 flex justify-between items-center border-b border-neutral-800/80">
        <button
          onClick={() => {
            if (selectedLot) {
              setSelectedLot(null);
            } else {
              router.push('/');
            }
          }}
          className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold active:scale-95"
        >
          {selectedLot ? '←' : '✕'}
        </button>

        <div className="text-center">
          <h1 className="text-sm font-extrabold tracking-wide">
            {selectedLot ? `LOT: ${selectedLot.lotNumber}` : 'DIRECTORY FOLDERS'}
          </h1>
          <p className="text-[10px] text-neutral-400 font-mono">
            {selectedLot ? `${selectedLot.photos.length} THUMBNAILS` : 'FOLDERS BY DATE & LOT'}
          </p>
        </div>

        {selectedLot ? (
          <button
            onClick={() => router.push(`/camera?lot=${encodeURIComponent(selectedLot.lotNumber)}`)}
            className="px-3 py-1.5 rounded-full bg-yellow-400 text-black text-xs font-extrabold flex items-center gap-1 active:scale-95"
          >
            <span>📷</span> +Add
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 my-3 overflow-y-auto">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs font-mono text-neutral-500">
            Scanning folders...
          </div>
        ) : selectedLot ? (
          /* INSIDE FOLDER -> THUMBNAILS FITTED TO GRID */
          <div className="grid grid-cols-3 gap-2 p-1 max-w-full">
            {selectedLot.photos.map((photo, index) => {
              const estKB = photo.blobSize ? (photo.blobSize / 1024).toFixed(1) : '<20';

              return (
                <div
                  key={photo._id || photo.id || index}
                  onClick={(e) => handleOpenEditor(photo, e)}
                  className="relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden aspect-square cursor-pointer active:scale-95 transition-transform max-w-full max-h-full"
                >
                  {photo.thumbUrl ? (
                    <img
                      src={photo.thumbUrl}
                      alt="Thumbnail"
                      loading="lazy"
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-600 text-[10px] font-mono">
                      No Preview
                    </div>
                  )}

                  {/* Size Indicator */}
                  <span className="absolute top-1 left-1 bg-black/80 backdrop-blur-md text-[8px] font-mono px-1.5 py-0.5 rounded text-neutral-300 border border-white/10 pointer-events-none">
                    {estKB} KB
                  </span>

                  {/* Queue Tag */}
                  {photo.isLocal && (
                    <span className="absolute bottom-1 left-1 bg-amber-500 text-black text-[7px] font-mono px-1 py-0.5 rounded font-extrabold pointer-events-none">
                      QUEUED
                    </span>
                  )}

                  {/* Delete Action */}
                  <button
                    onClick={(e) => handleDeletePhoto(photo, e)}
                    className="absolute top-1 right-1 w-6 h-6 rounded bg-red-600/90 text-white text-[11px] font-bold flex items-center justify-center backdrop-blur-md z-10"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* MAIN DIRECTORY -> Folders Only (No Image Previews) */
          <div className="space-y-5">
            {Object.keys(groupedGallery).length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <span className="text-4xl mb-2">📁</span>
                <p className="text-sm font-bold text-neutral-300">No Folders Created</p>
                <p className="text-xs text-neutral-500 mt-1">Capture photos to generate Lot folders automatically.</p>
              </div>
            ) : (
              Object.entries(groupedGallery).map(([dateStr, lotGroup]) => (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-500/20">
                      📅 {dateStr}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(lotGroup).map(([lotNum, folderPhotos]) => {
                      const queuedCount = folderPhotos.filter((p) => p.isLocal).length;

                      return (
                        <div
                          key={lotNum}
                          onClick={() => setSelectedLot({ lotNumber: lotNum, photos: folderPhotos })}
                          className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col justify-between hover:border-neutral-700 active:scale-98 transition-all cursor-pointer"
                        >
                          <div className="w-full h-20 bg-neutral-950/80 rounded-lg border border-neutral-800/80 flex flex-col items-center justify-center mb-2 relative">
                            <span className="text-3xl">📁</span>

                            <span className="absolute top-1.5 right-1.5 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-neutral-200">
                              {folderPhotos.length} {folderPhotos.length === 1 ? 'item' : 'items'}
                            </span>

                            {queuedCount > 0 && (
                              <span className="absolute bottom-1.5 left-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold">
                                ⏳ {queuedCount} queued
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between px-0.5">
                            <div>
                              <p className="text-xs font-bold text-white font-mono">LOT {lotNum}</p>
                              <p className="text-[9px] text-neutral-400">Tap to open →</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* FULL PICTURE OVERLAY (CONSTRAINED TO SCREEN BOUNDARIES) */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 h-screen w-screen overflow-hidden">
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActivePhoto(null)}
              className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-white flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
            <h2 className="text-xs font-bold font-mono text-yellow-400">
              LOT {activePhoto.lotNumber || 'PHOTO'}
            </h2>
            <button
              onClick={() => setActivePhoto(null)}
              className="px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-extrabold"
            >
              Done
            </button>
          </div>

          <div className="flex-1 my-2 flex items-center justify-center overflow-hidden relative">
            <img
              src={activePhoto.fullUrl}
              alt="Full View"
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                transform: `rotate(${rotation}deg)`
              }}
              className="max-h-[70vh] max-w-full object-contain rounded-lg transition-transform duration-200"
            />
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2 mb-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-neutral-400">Rotate Canvas</span>
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="py-1 px-3 rounded-lg bg-neutral-800 text-xs font-bold text-white border border-neutral-700 active:scale-95"
              >
                🔄 90°
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-neutral-400 font-bold">
                <span>Brightness Adjust</span>
                <span>{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-yellow-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
