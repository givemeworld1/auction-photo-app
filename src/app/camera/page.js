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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('READY');

  // Initialize rear camera explicitly for still photo capture
  useEffect(() => {
    let activeStream = null;

    async function startCamera() {
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
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setStatusMessage('Camera Access Denied');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Toggle Hardware Torch / Flashlight
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
      setStatusMessage('Torch unavailable on lens');
      setTimeout(() => setStatusMessage('READY'), 2000);
    }
  };

  // Set Camera Zoom (0.5x, 1x, 2x)
  const applyZoom = async (zoomValue) => {
    setZoomLevel(zoomValue);
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    if (capabilities.zoom) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: zoomValue }]
        });
      } catch (e) {
        console.error('Zoom error:', e);
      }
    }
  };

  // Shutter Haptic & Audio Feedback
  const playShutterFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      // Audio context safety
    }
  };

  // Dedicated Still Photo Capture
  const takeStillPhoto = async () => {
    if (!videoRef.current || uploading) return;

    playShutterFeedback();
    setUploading(true);
    setStatusMessage('SAVING...');

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Compress to high-efficiency WebP (< 200 KB)
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploading(false);
          setStatusMessage('Capture Failed');
          return;
        }

        // Generate instant local preview thumbnail
        const localPreviewUrl = URL.createObjectURL(blob);
        setLastPhotoUrl(localPreviewUrl);

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

            setPhotoCount(prev => prev + 1);
            setStatusMessage(`SAVED (${photoCount + 1})`);
          } else {
            setStatusMessage('Cloud Error');
          }
        } catch (err) {
          console.error('Upload error:', err);
          setStatusMessage('Saved Locally');
        } finally {
          setUploading(false);
          setTimeout(() => setStatusMessage('READY'), 1200);
        }
      },
      'image/webp',
      0.75
    );
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none flex flex-col justify-between">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header Bar */}
      <div className="relative z-20 pt-10 pb-3 px-5 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-center">
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

        {/* Top Controls: Torch & Grid */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-xs font-bold transition-all ${
              showGrid
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-900/80 text-neutral-400 border border-neutral-700/60'
            }`}
          >
            GRID
          </button>

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
      </div>

      {/* Center Viewfinder Window */}
      <div className="relative flex-1 mx-3 my-1 rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* 3x3 Composition Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/10">
            <div className="border-r border-b border-white/10"></div>
            <div className="border-r border-b border-white/10"></div>
            <div className="border-b border-white/10"></div>
            <div className="border-r border-b border-white/10"></div>
            <div className="border-r border-b border-white/10"></div>
            <div className="border-b border-white/10"></div>
            <div className="border-r border-white/10"></div>
            <div className="border-r border-white/10"></div>
            <div></div>
          </div>
        )}

        {/* Status Indicator Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="px-3.5 py-1 bg-black/70 backdrop-blur-md rounded-full text-[11px] font-mono font-bold tracking-widest text-neutral-200 border border-white/15 uppercase">
            {statusMessage}
          </span>
        </div>

        {/* Zoom Selector Controls Overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/15">
          {[0.5, 1.0, 2.0].map((z) => (
            <button
              key={z}
              onClick={() => applyZoom(z)}
              className={`w-8 h-8 rounded-full text-xs font-mono font-bold transition-all ${
                zoomLevel === z
                  ? 'bg-yellow-400 text-black scale-110'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Pro Control Bar */}
      <div className="relative z-20 pb-8 pt-4 px-6 bg-black flex items-center justify-between">
        {/* Gallery / Recent Shot Preview */}
        <button
          onClick={() => router.push('/gallery')}
          className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700/80 overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
        >
          {lastPhotoUrl ? (
            <img src={lastPhotoUrl} alt="Recent shot" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">🖼️</span>
          )}
        </button>

        {/* Main iOS-Style Physical Shutter Button */}
        <button
          onClick={takeStillPhoto}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
        >
          <div className={`w-16 h-16 rounded-full transition-all ${
            uploading ? 'bg-yellow-400 scale-75' : 'bg-white'
          }`} />
        </button>

        {/* Photo Counter Badge */}
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
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">Initializing Camera...</div>}>
      <CameraContent />
    </Suspense>
  );
}
