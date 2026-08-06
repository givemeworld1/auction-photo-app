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

  // Initialize live rear camera in browser
  useEffect(() => {
    let activeStream = null;

    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
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

  // Toggle Flashlight/Torch (if supported by device browser)
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
      setStatusMessage('Torch not supported in web view');
      setTimeout(() => setStatusMessage('READY TO SHOOT'), 1800);
    }
  };

  // Play shutter sound & vibration
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
      // Audio context fallback
    }
  };

  // Capture single still frame from live video feed
  const captureStillFrame = async () => {
    if (!videoRef.current || uploading) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // Ensure video metadata is ready

    playFeedback();
    setUploading(true);
    setStatusMessage('COMPRESSING & SAVING...');

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas frame to compressed WebP image
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploading(false);
          setStatusMessage('Capture Error');
          return;
        }

        // Set immediate local thumbnail
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
            setStatusMessage('Cloud Upload Issue');
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
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none flex flex-col justify-between">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Overlay HUD */}
      <div className="relative z-20 pt-8 pb-3 px-5 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex justify-between items-center">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 flex items-center justify-center text-white text-sm font-bold active:scale-95 transition-transform"
        >
          ✕
        </button>

        {/* Lot Badge */}
        <div className="px-4 py-1.5 bg-neutral-900/90 backdrop-blur-md border border-yellow-500/30 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          <span className="font-mono text-xs font-extrabold text-yellow-400 tracking-wider">
            {lotNumber}
          </span>
        </div>

        {/* Torch Toggle */}
        <button
          onClick={toggleTorch}
          className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-sm transition-all ${
            torchOn
              ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/40'
              : 'bg-neutral-900/80 text-white border border-neutral-700/60'
          }`}
        >
          ⚡
        </button>
      </div>

      {/* Main In-Browser Viewfinder */}
      <div className="relative flex-1 mx-3 my-1 rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover pointer-events-none"
        />

        {/* Status Overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="px-3.5 py-1 bg-black/70 backdrop-blur-md rounded-full text-[11px] font-mono font-bold tracking-widest text-neutral-200 border border-white/15 uppercase">
            {statusMessage}
          </span>
        </div>
      </div>

      {/* Bottom Shutter Controls */}
      <div className="relative z-20 pb-8 pt-4 px-6 bg-black flex items-center justify-between">
        {/* Gallery / Recent Preview */}
        <button
          onClick={() => router.push('/gallery')}
          className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700/80 overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
        >
          {lastPhotoUrl ? (
            <img src={lastPhotoUrl} alt="Recent" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">🖼️</span>
          )}
        </button>

        {/* Physical Shutter Button */}
        <button
          onClick={captureStillFrame}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
        >
          <div
            className={`w-16 h-16 rounded-full transition-all ${
              uploading ? 'bg-yellow-400 scale-75' : 'bg-white'
            }`}
          />
        </button>

        {/* Photo Count Display */}
        <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">COUNT</span>
          <span className="text-sm font-mono font-extrabold text-blue-400">{photoCount}</span>
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
