'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function CameraPage() {
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

  // Web Audio API Shutter Click Sound Generator
  const playShutterSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // Click noise pulse
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
      console.warn('Audio playback error:', e);
    }
  };

  // Camera initialization
  useEffect(() => {
    let stream = null;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
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
      e.stopPropagation();
    }

    if (isCapturing || !cameraReady || !videoRef.current || !canvasRef.current) return;

    if (!lotNumber.trim()) {
      alert('Please enter a Lot Number before taking photos.');
      return;
    }

    setIsCapturing(true);

    // Audio & Visual feedback
    playShutterSound();
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 150);

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
      console.error('Capture failed:', err);
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between p-4 select-none font-sans overflow-hidden">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen flash feedback */}
      {flashFeedback && <div className="fixed inset-0 bg-white z-50 pointer-events-none opacity-80" />}

      {/* Top Bar */}
      <div className="pt-2 pb-3 px-1 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => router.push(`/gallery`)}
          className="w-10 h-10 rounded-full bg-neutral-900/90 border border-neutral-700 flex items-center justify-center text-sm font-bold active:scale-95"
        >
          ✕
        </button>

        <div className="flex-1 max-w-[200px] mx-3">
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
            placeholder="ENTER LOT #"
            className="w-full bg-neutral-900/90 border border-yellow-500/50 rounded-lg px-3 py-1.5 text-center text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 placeholder:text-neutral-500 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="bg-neutral-900/90 border border-neutral-700 rounded-full px-3 py-1 flex items-center gap-1">
          <span className="text-[10px] text-neutral-400 font-mono">COUNT:</span>
          <span className="text-xs font-bold text-yellow-400 font-mono">{photoCount}</span>
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className="flex-1 relative my-2 bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-neutral-500 text-xs font-mono">
            Starting Camera...
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="py-4 px-2 flex justify-around items-center z-10 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={() => router.push('/gallery')}
          className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center active:scale-95"
        >
          <span className="text-lg">📁</span>
          <span className="text-[8px] font-mono font-bold text-neutral-400">FOLDERS</span>
        </button>

        {/* Shutter Button with touch + click handlers */}
        <button
          onClick={handleCapture}
          onTouchStart={handleCapture}
          disabled={!cameraReady || isCapturing}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-90 transition-transform ${
            isCapturing ? 'opacity-50 scale-95' : 'opacity-100'
          }`}
        >
          <div className="w-full h-full rounded-full bg-yellow-400 active:bg-yellow-500" />
        </button>

        <div className="w-12 h-12" />
      </div>
    </div>
  );
}
