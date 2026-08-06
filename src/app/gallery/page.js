'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GalleryPage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error('Gallery error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateShareLink = async (folderId) => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      const data = await res.json();
      if (data.shareToken) {
        const fullUrl = `${window.location.origin}/share/${data.shareToken}`;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(fullUrl);
        }
        alert('Share link copied to clipboard!\n\n' + fullUrl);
      }
    } catch (err) {
      console.error('Share error:', err);
      alert('Failed to generate share link');
    }
  };

  // Helper to convert full Cloudinary URL into small WebP thumbnail (< 20 KB)
  const getThumbnailUrl = (url) => {
    if (!url) return '';
    return url.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_webp/');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 max-w-md mx-auto w-full flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex justify-between items-center py-4 border-b border-neutral-800 mb-6">
          <Link href="/" className="text-neutral-400 font-bold text-sm hover:text-white">
            ← Home
          </Link>
          <h1 className="text-lg font-bold text-white tracking-wide">Auction Lot Folders</h1>
          <div className="w-10"></div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-neutral-500 font-mono text-sm">
            Loading lot folders...
          </div>
        )}

        {/* Empty State */}
        {!loading && folders.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="text-4xl">📂</div>
            <div className="text-neutral-400 text-sm">No lot folders found yet.</div>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-blue-600 font-bold text-xs rounded-xl text-white"
            >
              Start Shooting
            </Link>
          </div>
        )}

        {/* Folders List Grid */}
        <div className="grid grid-cols-1 gap-4">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between shadow-md"
            >
              <div className="flex items-center gap-3">
                {/* Dynamic < 20 KB Thumbnail */}
                <div className="w-14 h-14 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-neutral-700">
                  {folder.cover_url ? (
                    <img
                      src={getThumbnailUrl(folder.cover_url)}
                      alt={folder.lot_number}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">📁</span>
                  )}
                </div>

                <div>
                  <div className="font-mono font-bold text-base text-white">
                    {folder.lot_number}
                  </div>
                  <div className="text-xs text-blue-400 font-semibold mt-0.5">
                    {folder.photo_count} Photos
                  </div>
                </div>
              </div>

              {/* Folder Actions */}
              <button
                onClick={() => handleGenerateShareLink(folder.id)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 active:scale-95"
              >
                🔗 Share
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Return Button */}
      <div className="pt-8 pb-4">
        <Link
          href="/"
          className="block w-full py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-center text-xs font-bold text-neutral-300 active:bg-neutral-800"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
