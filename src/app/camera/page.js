'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

async function savePhotoToQueue(photoData) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(photoData);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Queue save error:', e);
  }
}

// Low-latency Web Audio Synthesizer (Bypasses external file loading)
function playShutterBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // Silently continue if audio fails on restricted devices
  }
}

function CameraContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lotNumber, setLotNumber] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const lot = searchParams.get('lot');
    if (lot) setLotNumber(lot);
  }, [searchParams]);

  // Lock document scroll on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Initialize Camera Stream
  useEffect(() => {
    let stream = null;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        alert('Camera access denied or unreadable. Check browser permissions.');
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const triggerPhotoCapture = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isCapturing || !videoRef.current || !canvasRef.current) return;

    if (!lotNumber.trim()) {
      alert('Please enter a Lot Number first.');
      return;
    }

    setIsCapturing(true);

    playShutterBeep();
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 100);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const dateStr = new Date().toISOString().split('T')[0];

            await savePhotoToQueue({
              lotNumber: lotNumber.trim().toUpperCase(),
              dateStr: dateStr,
              blob: blob,
              createdAt: new Date().toISOString()
            });

            setPhotoCount((prev) => prev + 1);
          }
          setIsCapturing(false);
        },
        'image/jpeg',
        0.85
      );
    } catch (err) {
      console.error('Capture execution failed:', err);
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-2 select-none font-sans overflow-hidden box-border touch-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen flash feedback */}
      {flashFeedback && <div className="fixed inset-0 bg-white z-50 pointer-events-none opacity-80" />}

      {/* Top Header Bar */}
      <div className="h-12 px-1 flex justify-between items-center z-30 shrink-0">
        <button
          type="button"
          onClick={() => router.push('/gallery')}
          className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-sm font-bold active:scale-95"
        >
          ✕
        </button>

        <div className="flex-1 max-w-[180px] mx-2">
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
            placeholder="ENTER LOT #"
            className="w-full bg-neutral-900 border border-yellow-500/50 rounded-lg px-2 py-1.5 text-center text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 placeholder:text-neutral-500 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <button
          type="button"
          onClick={() => router.push('/gallery')}
          className="bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 flex items-center gap-1 active:scale-95"
        >
          <span className="text-[10px] text-neutral-400 font-mono">COUNT:</span>
          <span className="text-xs font-bold text-yellow-400 font-mono">{photoCount}</span>
        </button>
      </div>

      {/* Viewfinder Button Container (Screen Area) */}
      <button
        type="button"
        onClick={triggerPhotoCapture}
        style={{ touchAction: 'none' }}
        className="flex-1 my-1 relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center min-h-0 w-full p-0 cursor-pointer outline-none active:opacity-90"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          disablePictureInPicture
          className="w-full h-full object-cover max-h-full pointer-events-none select-none"
        />

        {!cameraReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-neutral-500 text-xs font-mono pointer-events-none">
            Starting Camera...
          </div>
        ) : (
          <div className="absolute bottom-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-neutral-300 pointer-events-none border border-white/10">
            TAP SCREEN TO TAKE PHOTO
          </div>
        )}
      </button>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black text-white flex items-center justify-center text-xs font-mono">Loading Camera...</div>}>
      <CameraContent />
    </Suspense>
  );
}
