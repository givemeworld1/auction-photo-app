'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CameraContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lotNumber = searchParams.get('lot') || 'UNNAMED-LOT';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [lastPhotoUrl, setLastPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('READY TO SHOOT');

  // Initialize live rear camera inside bounded container
  useEffect(() => {
    let activeStream = null;

    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((e) => console.log('Video play error:', e));
        }
      } catch (err) {
        console.error('In-browser camera access error:', err);
        setStatusMessage('Camera Access Denied');
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Toggle Flashlight/Torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.error('Torch error:', e);
      }
    } else {
      setStatusMessage('Torch not supported');
      setTimeout(() => setStatusMessage('READY TO SHOOT'), 1800);
    }
  };

  // Play shutter feedback
  const playFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio fallback
    }
  };

  // Capture single frame from live stream
  const captureStillFrame = async () => {
    if (!videoRef.current || uploading) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    playFeedback();
    setUploading(true);
    setStatusMessage('SAVING...');

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploading(false);
          setStatusMessage('Capture Error');
          return;
        }

        const localUrl = URL.createObjectURL(blob);
        setLastPhotoUrl(localUrl);

        try {
          const formData = new FormData();
          formData.append('file', blob);
          formData.append('upload_preset', 'ml_default');

          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'db744xrg';
          const cloudRes = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            { method: 'POST', body: formData }
          );

          const cloudData = await cloudRes.json();

          if (cloudData.secure_url) {
            await fetch('/api/photos/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lotNumber: lotNumber,
                cloudinaryUrl: cloudData.secure_url,
                publicId: cloudData.public_id
              })
            });

            setPhotoCount((prev) => prev + 1);
            setStatusMessage(`SAVED (${photoCount + 1})`);
          } else {
            setStatusMessage('Cloud Error');
          }
        } catch (err) {
          console.error('Upload error:', err);
          setStatusMessage('Save Failed');
        } finally {
          setUploading(false);
          setTimeout(() => setStatusMessage('READY TO SHOOT'), 1200);
        }
      },
      'image/webp',
      0.75
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-black overflow-hidden select-none flex flex-col justify-between">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header Bar */}
      <div className="flex-shrink-0 z-20 pt-10 pb-3 px-4 flex justify-between items-center bg-black">
        <button
          onClick={() => router.push('/')}
          className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-700/60 flex items-center justify-center text-white text-xs font-bold active:scale-95 transition-transform"
        >
          ✕
        </button>

        {/* Lot Badge */}
        <div className="px-3 py-1 bg-neutral-900 border border-yellow-500/40 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          <span className="font-mono text-xs font-extrabold text-yellow-400 tracking-wider">
            {lotNumber}
          </span>
        </div>

        {/* Flashlight Button */}
        <button
          onClick={toggleTorch}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all ${
            torchOn
              ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/40'
              : 'bg-neutral-900 text-white border border-neutral-700/60'
          }`}
        >
          ⚡
        </button>
      </div>

      {/* Viewfinder Window (Strict Bounds) */}
      <div className="relative flex-1 mx-3 my-2 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Live Status Tag */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span className="px-3 py-0.5 bg-black/70 backdrop-blur-md rounded-full text-[10px] font-mono font-bold tracking-widest text-neutral-200 border border-white/15 uppercase">
            {statusMessage}
          </span>
        </div>
      </div>

      {/* Bottom Shutter Control Bar */}
      <div className="flex-shrink-0 z-20 pb-8 pt-3 px-6 bg-black flex items-center justify-between">
        {/* Gallery Preview Box */}
        <button
          onClick={() => router.push('/gallery')}
          className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-700/80 overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
        >
          {lastPhotoUrl ? (
            <img src={lastPhotoUrl} alt="Recent" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">🖼️</span>
          )}
        </button>

        {/* Main Shutter Button */}
        <button
          onClick={captureStillFrame}
          disabled={uploading}
          className="relative w-16 h-16 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform shadow-xl"
        >
          <div
            className={`w-12 h-12 rounded-full transition-all ${
              uploading ? 'bg-yellow-400 scale-75' : 'bg-white'
            }`}
          />
        </button>

        {/* Photo Counter */}
        <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-tight">COUNT</span>
          <span className="text-xs font-mono font-extrabold text-blue-400">{photoCount}</span>
        </div>
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">
          Loading camera module...
        </div>
      }
    >
      <CameraContent />
    </Suspense>
  );
}
