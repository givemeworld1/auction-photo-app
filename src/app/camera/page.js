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
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const lot = searchParams.get('lot');
    if (lot) setLotNumber(lot);
  }, [searchParams]);

  const playShutterSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn('Audio error:', e);
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
            videoRef.current.play();
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera access error:', err);
        alert('Unable to access camera. Please check permissions.');
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = async (e) => {
    if (e) {
      e.preventDefault();
    }

    if (isCapturing || !cameraReady || !videoRef.current || !canvasRef.current) return;

    if (!lotNumber.trim()) {
      alert('Please enter a Lot Number before taking photos.');
      return;
    }

    setIsCapturing(true);

    playShutterSound();
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 120);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsCapturing(false);
            return;
          }

          const dateStr = new Date().toISOString().split('T')[0];

          await savePhotoToQueue({
            lotNumber: lotNumber.trim().toUpperCase(),
            dateStr: dateStr,
            blob: blob,
            createdAt: new Date().toISOString()
          });

          setPhotoCount((prev) => prev + 1);
          setIsCapturing(false);
        },
        'image/jpeg',
        0.85
      );
    } catch (err) {
      console.error('Capture error:', err);
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-screen bg-black text-white flex flex-col justify-between p-3 select-none font-sans overflow-hidden box-border">
      <canvas ref={canvasRef} className="hidden" />

      {flashFeedback && <div className="fixed inset-0 bg-white z-50 pointer-events-none opacity-80" />}

      {/* Top Navigation Bar */}
      <div className="h-12 px-1 flex justify-between items-center z-10 shrink-0">
        <button
          onClick={() => router.push(`/gallery`)}
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

        <div className="bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1 flex items-center gap-1">
          <span className="text-[10px] text-neutral-400 font-mono">COUNT:</span>
          <span className="text-xs font-bold text-yellow-400 font-mono">{photoCount}</span>
        </div>
      </div>

      {/* Viewfinder Container (Constrained strictly inside remaining flex height) */}
      <div className="flex-1 my-2 relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center min-h-0">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover max-h-full"
        />

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-neutral-500 text-xs font-mono">
            Starting Camera...
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="h-20 px-2 flex justify-around items-center z-10 shrink-0">
        <button
          onClick={() => router.push('/gallery')}
          className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center active:scale-95"
        >
          <span className="text-base">📁</span>
          <span className="text-[8px] font-mono font-bold text-neutral-400">FOLDERS</span>
        </button>

        {/* Shutter Button using onPointerDown for fast touch response */}
        <button
          onPointerDown={handleCapture}
          disabled={!cameraReady || isCapturing}
          className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center p-1 touch-manipulation select-none active:scale-90 transition-transform ${
            isCapturing ? 'opacity-50 scale-95' : 'opacity-100'
          }`}
        >
          <div className="w-full h-full rounded-full bg-yellow-400 active:bg-yellow-500 pointer-events-none" />
        </button>

        <div className="w-12 h-12" />
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
