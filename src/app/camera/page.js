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

// Memory-synthesized shutter sound WAV blob
function createShutterAudio() {
  if (typeof window === 'undefined') return null;

  const sampleRate = 8000;
  const numSamples = sampleRate * 0.08; // 80ms duration
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples, true);

  for (let i = 0; i < numSamples; i++) {
    const decay = 1 - i / numSamples;
    const sample = Math.sin(i * 0.4) * decay * 127 + 128;
    view.setUint8(44 + i, sample);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const audio = new Audio(URL.createObjectURL(blob));
  audio.volume = 1.0;
  return audio;
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
  const audioRef = useRef(null);

  useEffect(() => {
    const lot = searchParams.get('lot');
    if (lot) setLotNumber(lot);
    audioRef.current = createShutterAudio();
  }, [searchParams]);

  const playSound = () => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {
      // Ignore audio block to prevent stopping capture execution
    }
  };

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
        console.error('Camera access error:', err);
        alert('Camera permissions required. Please check browser settings.');
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
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }

    if (isCapturing || !videoRef.current || !canvasRef.current) return;

    if (!lotNumber.trim()) {
      alert('Please enter a Lot Number first.');
      return;
    }

    setIsCapturing(true);

    playSound();
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 120);

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
      console.error('Capture failed:', err);
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black text-white flex flex-col justify-between p-3 select-none font-sans overflow-hidden box-border">
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen flash feedback */}
      {flashFeedback && <div className="fixed inset-0 bg-white z-50 pointer-events-none opacity-80" />}

      {/* Top Controls Bar */}
      <div className="h-12 px-1 flex justify-between items-center z-10 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push('/gallery');
          }}
          className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-sm font-bold active:scale-95"
        >
          ✕
        </button>

        <div className="flex-1 max-w-[180px] mx-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
            placeholder="ENTER LOT #"
            className="w-full bg-neutral-900 border border-yellow-500/50 rounded-lg px-2 py-1.5 text-center text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 placeholder:text-neutral-500 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push('/gallery');
          }}
          className="bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 flex items-center gap-1 active:scale-95"
        >
          <span className="text-[10px] text-neutral-400 font-mono">COUNT:</span>
          <span className="text-xs font-bold text-yellow-400 font-mono">{photoCount}</span>
        </button>
      </div>

      {/* Entire Camera Viewfinder acts as the touch shutter button */}
      <div
        onTouchStart={triggerPhotoCapture}
        onClick={triggerPhotoCapture}
        className="flex-1 my-2 relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center min-h-0 w-full cursor-pointer touch-none active:opacity-90"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover max-h-full pointer-events-none"
        />

        {!cameraReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-neutral-500 text-xs font-mono">
            Starting Camera...
          </div>
        ) : (
          <div className="absolute bottom-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-neutral-300 pointer-events-none border border-white/10">
            TAP SCREEN TO TAKE PHOTO
          </div>
        )}
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 h-[100dvh] bg-black text-white flex items-center justify-center text-xs font-mono">Loading Camera...</div>}>
      <CameraContent />
    </Suspense>
  );
}
