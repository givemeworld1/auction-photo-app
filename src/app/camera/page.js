'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CameraContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lotNumber = searchParams.get('lot') || 'UNNAMED-LOT';

  const fileInputRef = useRef(null);

  const [photoCount, setPhotoCount] = useState(0);
  const [lastPhotoUrl, setLastPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('READY TO SHOOT');

  // Trigger Native iOS Rear Camera
  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle Photo Taken from Native iOS Camera
  const handlePhotoCaptured = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMessage('COMPRESSING & SAVING...');

    try {
      // Create bitmap to resize and convert to high-efficiency WebP (< 200 KB)
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');

      const MAX_WIDTH = 1920;
      const scale = Math.min(1, MAX_WIDTH / imageBitmap.width);
      canvas.width = imageBitmap.width * scale;
      canvas.height = imageBitmap.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setUploading(false);
            setStatusMessage('Error processing image');
            return;
          }

          // Generate immediate local preview
          const localPreviewUrl = URL.createObjectURL(blob);
          setLastPhotoUrl(localPreviewUrl);

          // Upload to Cloudinary
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
            // Save to Neon DB
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
            setStatusMessage('Cloud Upload Error');
          }
          setUploading(false);
          setTimeout(() => setStatusMessage('READY TO SHOOT'), 1500);
        },
        'image/webp',
        0.75
      );
    } catch (err) {
      console.error('Capture processing error:', err);
      setStatusMessage('Save Failed');
      setUploading(false);
    } finally {
      // Clear value so user can take consecutive shots with same input element
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-5 flex flex-col justify-between max-w-md mx-auto select-none">
      {/* Native iOS Rear Camera Direct Trigger Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCaptured}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex justify-between items-center py-4 border-b border-neutral-800">
        <button
          onClick={() => router.push('/')}
          className="text-neutral-400 text-xs font-bold hover:text-white px-3 py-1.5 bg-neutral-900 rounded-lg border border-neutral-800"
        >
          ← EXIT
        </button>

        <div className="px-4 py-1.5 bg-neutral-900 border border-yellow-500/30 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          <span className="font-mono text-xs font-extrabold text-yellow-400 tracking-wider">
            {lotNumber}
          </span>
        </div>

        <button
          onClick={() => router.push('/gallery')}
          className="text-blue-400 text-xs font-bold px-3 py-1.5 bg-neutral-900 rounded-lg border border-neutral-800"
        >
          GALLERY
        </button>
      </div>

      {/* Center Action Viewport */}
      <div className="my-auto py-8 text-center flex flex-col items-center justify-center gap-6">
        {/* Recent Photo Preview Window */}
        <div className="w-64 h-64 bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-3xl overflow-hidden flex items-center justify-center relative shadow-2xl">
          {lastPhotoUrl ? (
            <img src={lastPhotoUrl} alt="Last shot" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-6">
              <span className="text-5xl block mb-3">📸</span>
              <span className="text-xs font-mono text-neutral-500">Tap button below to shoot</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-yellow-400 font-mono text-xs font-bold animate-pulse">
                COMPRESSING WEBP...
              </div>
            </div>
          )}
        </div>

        {/* Live Status Pill */}
        <div className="px-4 py-1.5 bg-neutral-900 rounded-full border border-neutral-800 font-mono text-xs font-bold text-neutral-300 uppercase tracking-widest">
          {statusMessage}
        </div>

        {/* Big Capture Trigger Button */}
        <button
          onClick={openNativeCamera}
          disabled={uploading}
          className="w-full py-5 bg-blue-600 active:bg-blue-500 text-white font-extrabold text-base tracking-wider rounded-2xl shadow-lg shadow-blue-900/50 flex items-center justify-center gap-3 active:scale-98 transition-all"
        >
          <span className="text-2xl">📷</span> TAKE PHOTO ({photoCount})
        </button>
        <p className="text-[11px] text-neutral-500 font-mono">
          Opens rear camera view with 0.5x Ultra-Wide & Flash support
        </p>
      </div>

      {/* Bottom Counter Footer */}
      <div className="py-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-400 font-mono">
        <span>LOT: {lotNumber}</span>
        <span className="text-blue-400 font-bold">{photoCount} SAVED TO NEON</span>
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
