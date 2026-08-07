'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// --- IndexedDB Local Queue Storage Engine ---
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

async function savePhotoToQueue(lotNumber, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      lotNumber,
      blob,
      timestamp: new Date().toISOString(),
      dateStr: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getNextQueueItem() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        resolve({ id: cursor.key, ...cursor.value });
      } else {
        resolve(null);
      }
    };
  });
}

async function removeQueueItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Main Camera Component ---
function CameraContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lotNumber = searchParams.get('lot') || 'UNNAMED-LOT';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [queueCount, setQueueCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [flashFeedback, setFlashFeedback] = useState(false);

  // Read user presets from localStorage
  const presetZoom = parseFloat(typeof window !== 'undefined' ? localStorage.getItem('camera_preset_zoom') || '1' : '1');
  const presetFlash = typeof window !== 'undefined' ? localStorage.getItem('camera_preset_flash') || 'off' : 'off';

  // 1. Initialize Camera Stream
  useEffect(() => {
    let activeStream = null;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        activeStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.log('Play error:', e));
        }

        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const capabilities = track.getCapabilities();

          // Apply Torch Preset
          if (capabilities.torch && presetFlash === 'on') {
            track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {});
          }

          // Apply Zoom Preset
          if (capabilities.zoom) {
            const clampedZoom = Math.max(capabilities.zoom.min || 1, Math.min(capabilities.zoom.max || 3, presetZoom));
            track.applyConstraints({ advanced: [{ zoom: clampedZoom }] }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Camera Init Error:', err);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [presetZoom, presetFlash]);

  // 2. Background Queue Processor (Upload & Delete locally)
  useEffect(() => {
    let isUploading = false;

    const interval = setInterval(async () => {
      if (isUploading) return;

      const item = await getNextQueueItem();
      if (!item) return;

      isUploading = true;

      try {
        const formData = new FormData();
        formData.append('file', item.blob);
        formData.append('upload_preset', 'ml_default');

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'db744xrg';
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });

        const cloudData = await cloudRes.json();

        if (cloudData.secure_url) {
          await fetch('/api/photos/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lotNumber: item.lotNumber,
              dateStr: item.dateStr,
              cloudinaryUrl: cloudData.secure_url,
              publicId: cloudData.public_id
            })
          });

          // Delete from local phone storage once safely in cloud
          await removeQueueItem(item.id);
          setQueueCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Background upload error:', err);
      } finally {
        isUploading = false;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 3. Instant Touch Capture
  const handleTapToShoot = async (e) => {
    e.stopPropagation();

    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    // Haptic feedback + Visual Flash shutter animation
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 80);

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;

        // Save immediately to local queue
        await savePhotoToQueue(lotNumber, blob);
        setSessionCount((prev) => prev + 1);
        setQueueCount((prev) => prev + 1);
      },
      'image/webp',
      0.8
    );
  };

  return (
    <div
      onClick={handleTapToShoot}
      className="fixed inset-0 w-full bg-black select-none overflow-hidden cursor-pointer"
      style={{ height: '100dvh', maxHeight: '-webkit-fill-available' }}
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* Shutter Feedback Overlay */}
      {flashFeedback && <div className="absolute inset-0 z-50 bg-white opacity-80 pointer-events-none" />}

      {/* Fullscreen Unobstructed Live Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        className="pointer-events-none"
      />

      {/* Minimal Top Lot Badge */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
        <span className="font-mono text-xs font-extrabold text-yellow-400">LOT: {lotNumber}</span>
      </div>

      {/* Exit Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          router.push('/');
        }}
        className="absolute top-4 right-4 z-40 w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white text-xs font-bold"
      >
        ✕
      </button>

      {/* Minimal Bottom Status Display */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/15">
        <span className="text-[11px] font-mono font-extrabold text-white">
          SHOTS: <span className="text-yellow-400">{sessionCount}</span>
        </span>
        <span className="text-neutral-600">|</span>
        <span className="text-[11px] font-mono font-bold text-neutral-300">
          UPLOADING: <span className="text-blue-400">{queueCount}</span>
        </span>
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">
          Loading camera...
        </div>
      }
    >
      <CameraContent />
    </Suspense>
  );
}
