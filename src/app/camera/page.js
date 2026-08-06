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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Tap screen to capture');

  // Initialize camera stream
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
        setStatusMessage('Camera permission required');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Toggle Torch/Flashlight
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
      setStatusMessage('Hardware Torch not supported');
      setTimeout(() => setStatusMessage('Tap screen to capture'), 2000);
    }
  };

  // Adjust Zoom Level
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
        console.error('Zoom constraint error:', e);
      }
    }
  };

  // Trigger Shutter Sound & Haptic Vibration
  const playShutterFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio fallback
    }
  };

  // Capture Photo on Tap
  const handleTapCapture = async () => {
    if (!videoRef.current || uploading) return;

    playShutterFeedback();
    setUploading(true);
    setStatusMessage('Compressing & Uploading...');

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploading(false);
          setStatusMessage('Capture error. Try again.');
          return;
        }

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
            setStatusMessage(`Saved! (${photoCount + 1} photos taken)`);
          } else {
            setStatusMessage('Cloud upload issue');
          }
        } catch (err) {
          console.error('Upload error:', err);
          setStatusMessage('Upload error');
        } finally {
          setUploading(false);
          setTimeout(() => setStatusMessage('Tap screen to capture'), 1500);
        }
      },
      'image/webp',
      0.75
    );
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Video View */}
      <div 
        onClick={handleTapCapture}
        className="relative w-full h-full cursor-pointer active:opacity-95 transition-opacity"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Live Status Overlay */}
        <div className="absolute top-16 left-0 right-0 text-center pointer-events-none">
          <span className="px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-xs font-semibold text-white tracking-wide border border-white/10">
            {statusMessage}
          </span>
        </div>
      </div>

      {/* Top HUD Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
        <button
          onClick={toggleTorch}
          className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all ${
            torchOn
              ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/50'
              : 'bg-black/60 text-white border border-white/20'
          }`}
        >
          ⚡ {torchOn ? 'TORCH ON' : 'TORCH OFF'}
        </button>

        <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full font-mono text-xs font-bold text-yellow-400 tracking-wider uppercase">
          {lotNumber}
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-6 left-4 right-4 flex flex-col gap-3 pointer-events-auto">
        <div className="flex justify-between items-center bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
          <div className="text-xs font-bold text-blue-400 font-mono">
            📸 {photoCount} PHOTOS
          </div>

          <div className="flex gap-2">
            {[0.5, 1.0, 2.0].map((z) => (
              <button
                key={z}
                onClick={(e) => {
                  e.stopPropagation();
                  applyZoom(z);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-colors ${
                  zoomLevel === z
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3.5 bg-neutral-900/90 active:bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs backdrop-blur-md border border-white/10 text-center"
          >
            ✕ EXIT CAMERA
          </button>

          <button
            onClick={() => router.push('/gallery')}
            className="flex-1 py-3.5 bg-blue-600 active:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-900/50 text-center"
          >
            🖼️ VIEW GALLERY
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">Loading camera...</div>}>
      <CameraContent />
    </Suspense>
  );
}
