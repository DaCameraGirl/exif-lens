'use client';

import { useState, useCallback, useRef } from 'react';
import { Aperture, Timer, Sun, MapPin, Upload, X, Download, Shield, Zap, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import exifr from 'exifr';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const ExifMap = dynamic(() => import('./ExifMap'), { ssr: false });

type ExifData = Record<string, any>;

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  exif: ExifData | null;
  error: string | null;
  loading: boolean;
}

function formatShutterSpeed(expTime?: number): string {
  if (!expTime) return '—';
  if (expTime >= 1) return `${expTime}s`;
  const denom = Math.round(1 / expTime);
  return `1/${denom}s`;
}

function formatFocalLength(fl?: number, fl35?: number): string {
  if (!fl) return '—';
  if (fl35 && Math.abs(fl35 - fl) > 1) {
    return `${Math.round(fl)}mm (${Math.round(fl35)}mm eq.)`;
  }
  return `${Math.round(fl)}mm`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatGPS(lat?: number, lon?: number): string {
  if (lat == null || lon == null) return '—';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}°${ns}, ${Math.abs(lon).toFixed(6)}°${ew}`;
}

export default function ExifLens() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePhoto = photos.find(p => p.id === activeId) || photos[0] || null;

  const openFilePicker = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const processFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2);
    const previewUrl = URL.createObjectURL(file);
    const item: PhotoItem = { id, file, previewUrl, exif: null, error: null, loading: true };
    setPhotos(prev => {
      const next = [item, ...prev];
      if (!activeId) setActiveId(id);
      return next;
    });

    try {
      const exif = await exifr.parse(file, { exif: true, gps: true, iptc: true, icc: true, jfif: true, tiff: true, xmp: true, ihdr: true });
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, exif: exif || {}, loading: false } : p));
    } catch (err: any) {
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, error: err?.message || 'Failed to read EXIF', loading: false } : p));
    }
  }, [activeId]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(f => {
      if (f.type.startsWith('image/')) processFile(f);
    });
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p) URL.revokeObjectURL(p.previewUrl);
      const next = prev.filter(x => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
  };

  const stripExif = async () => {
    if (!activePhoto) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = activePhoto.file.name.split('.').pop() || 'jpg';
        const base = activePhoto.file.name.replace(/\.[^.]+$/, '');
        a.download = `${base}_clean.${ext === 'png' ? 'png' : 'jpg'}`;
        a.click();
        URL.revokeObjectURL(url);
      }, activePhoto.file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.95);
    };
    img.src = activePhoto.previewUrl;
  };

  const copyExifJson = async () => {
    if (!activePhoto?.exif) return;
    await navigator.clipboard.writeText(JSON.stringify(activePhoto.exif, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exif = activePhoto?.exif || {};
  const lat = exif.latitude ?? exif.GPSLatitude;
  const lon = exif.longitude ?? exif.GPSLongitude;
  const hasGps = typeof lat === 'number' && typeof lon === 'number';

  const allTags = exif ? Object.entries(exif).sort(([a],[b]) => a.localeCompare(b)) : [];

  return (
    <div className="min-h-screen bg-[#0e0e10] text-zinc-100" onPaste={handlePaste}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Fragment+Mono:ital@0;1&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-mono2 { font-family: 'Fragment Mono', ui-monospace, SFMono-Regular, monospace; }
        * { font-variant-ligatures: none; }
      `}</style>

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#d4ff4d] flex items-center justify-center">
              <Aperture className="w-5 h-5 text-zinc-950" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight">EXIF Lens</div>
              <div className="text-[11px] text-zinc-500 -mt-0.5">by DaCameraGirl</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Private</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Fast</span>
            <a href="https://github.com/DaCameraGirl/exif-lens" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">GitHub →</a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
        {photos.length === 0 ? (
          /* Empty state – big drop zone */
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={openFilePicker}
            className={`rounded-[28px] border-2 border-dashed transition-all cursor-pointer ${
              dragOver ? 'border-[#d4ff4d] bg-[#d4ff4d]/5' : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/70'
            }`}
          >
            <div className="py-24 sm:py-32 px-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800 flex items-center justify-center mb-6">
                <Upload className="w-7 h-7 text-zinc-400" />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-3 tracking-tight">Drop a photo here</h1>
              <p className="text-zinc-400 max-w-md mx-auto mb-6">
                See every camera setting, GPS location, and hidden metadata — instantly.
                No nonsense.
              </p>
              <p className="text-xs text-zinc-500 mb-8">
                Supports JPEG, HEIC, PNG, TIFF, WebP, AVIF
              </p>
              <button
                type="button"
                onClick={openFilePicker}
                className="px-6 py-3 rounded-full bg-[#d4ff4d] text-zinc-950 font-semibold text-sm hover:bg-[#c8f03a] transition-colors"
              >
                Choose files
              </button>
              <p className="text-[11px] text-zinc-600 mt-4">or paste from clipboard • drag multiple</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 lg:gap-12 items-start">
            {/* Left column – image + filmstrip */}
            <div className="lg:sticky lg:top-[88px] space-y-4">
              {activePhoto && (
                <div className="rounded-[20px] bg-zinc-900 border border-zinc-800 overflow-hidden">
                  <div className="relative bg-zinc-950 aspect-[4/3] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activePhoto.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                    <button
                      onClick={() => removePhoto(activePhoto.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-zinc-950/80 hover:bg-zinc-950 flex items-center justify-center backdrop-blur transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-3 text-xs font-mono2 text-zinc-500 flex items-center justify-between border-t border-zinc-800">
                    <span className="truncate">{activePhoto.file.name}</span>
                    <span>{formatFileSize(activePhoto.file.size)}</span>
                  </div>
                </div>
              )}

              {/* Filmstrip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      p.id === activeId ? 'border-[#d4ff4d]' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-600 bg-zinc-900/40 flex items-center justify-center text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                </button>
              </div>

              {/* Actions */}
              {activePhoto?.exif && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={stripExif}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Strip EXIF &amp; save
                  </button>
                  <button
                    onClick={copyExifJson}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
              )}
            </div>

            {/* Right column – EXIF details */}
            <div className="space-y-8 min-w-0">
              {!activePhoto ? (
                <div className="text-zinc-500">Select a photo</div>
              ) : activePhoto.loading ? (
                <div className="text-zinc-400">Reading EXIF…</div>
              ) : activePhoto.error ? (
                <div className="rounded-2xl bg-red-950/30 border border-red-900/50 px-5 py-4 text-sm text-red-300">
                  {activePhoto.error}
                </div>
              ) : !activePhoto.exif || Object.keys(activePhoto.exif).length === 0 ? (
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm text-zinc-400">
                  No EXIF metadata found in this image. It may have been stripped by a social media platform or editor.
                </div>
              ) : (
                <>
                  {/* Hero exposure card */}
                  <div className="rounded-[24px] bg-zinc-900 border border-zinc-800 px-7 sm:px-10 py-8 sm:py-10">
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">Exposure</div>
                    <div className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
                      {exif.FNumber ? `ƒ/${exif.FNumber}` : '—'}
                      <span className="text-zinc-600 mx-3">·</span>
                      {formatShutterSpeed(exif.ExposureTime)}
                      <span className="text-zinc-600 mx-3">·</span>
                      ISO {exif.ISO || '—'}
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-400">
                      <span><span className="text-zinc-600">Camera</span> <span className="text-zinc-200 ml-2">{[exif.Make, exif.Model].filter(Boolean).join(' ') || '—'}</span></span>
                      <span><span className="text-zinc-600">Lens</span> <span className="text-zinc-200 ml-2">{exif.LensModel || '—'}</span></span>
                      <span><span className="text-zinc-600">Focal</span> <span className="text-zinc-200 ml-2">{formatFocalLength(exif.FocalLength, exif.FocalLengthIn35mmFilm)}</span></span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Aperture', value: exif.FNumber ? `ƒ/${exif.FNumber}` : '—', sub: exif.MaxApertureValue ? `max ƒ/${exif.MaxApertureValue}` : '' },
                      { label: 'Shutter', value: formatShutterSpeed(exif.ExposureTime), sub: exif.ExposureProgram ? `Pgm ${exif.ExposureProgram}` : '' },
                      { label: 'ISO', value: exif.ISO ? String(exif.ISO) : '—', sub: '' },
                      { label: 'Focal Length', value: exif.FocalLength ? `${Math.round(exif.FocalLength)}mm` : '—', sub: exif.FocalLengthIn35mmFilm ? `${Math.round(exif.FocalLengthIn35mmFilm)}mm eq.` : '' },
                      { label: 'Flash', value: exif.Flash ? 'Fired' : 'No flash', sub: '' },
                      { label: 'White Balance', value: exif.WhiteBalance === 0 ? 'Auto' : exif.WhiteBalance === 1 ? 'Manual' : '—', sub: '' },
                      { label: 'Metering', value: exif.MeteringMode ? String(exif.MeteringMode) : '—', sub: '' },
                      { label: 'Exposure Comp.', value: exif.ExposureCompensation != null ? `${exif.ExposureCompensation >= 0 ? '+' : ''}${exif.ExposureCompensation}` : '—', sub: '' },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-4">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{s.label}</div>
                        <div className="font-semibold text-zinc-100">{s.value}</div>
                        {s.sub && <div className="text-[11px] text-zinc-500 mt-0.5">{s.sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* GPS / Map */}
                  {hasGps ? (
                    <div className="rounded-[24px] bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="w-4 h-4 text-zinc-400" /> Location</div>
                        <div className="text-xs font-mono2 text-zinc-500">{formatGPS(lat, lon)}</div>
                      </div>
                      <div className="h-[280px]">
                        <ExifMap lat={lat!} lon={lon!} />
                      </div>
                      <div className="px-6 py-3 text-[11px] text-zinc-500 border-t border-zinc-800">
                        Alt: {exif.GPSAltitude != null ? `${Math.round(exif.GPSAltitude)}m` : '—'}
                        {exif.GPSImgDirection != null && <> · Heading: {Math.round(exif.GPSImgDirection)}°</>}
                        {' · '}
                        <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-300">Open in Google Maps →</a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] bg-zinc-900 border border-zinc-800 px-6 py-4 text-sm text-zinc-500">
                      <MapPin className="w-4 h-4 inline mr-2 opacity-60" />
                      No GPS coordinates in this photo.
                    </div>
                  )}

                  {/* File info */}
                  <div className="rounded-[24px] bg-zinc-900 border border-zinc-800 px-6 py-5">
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">File Info</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><div className="text-zinc-500 text-xs">Dimensions</div><div className="font-mono2 text-xs mt-0.5">{exif.ExifImageWidth && exif.ExifImageHeight ? `${exif.ExifImageWidth} × ${exif.ExifImageHeight}` : '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">File Size</div><div className="font-mono2 text-xs mt-0.5">{activePhoto ? formatFileSize(activePhoto.file.size) : '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">MIME</div><div className="font-mono2 text-xs mt-0.5">{activePhoto?.file.type || '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">Date Taken</div><div className="font-mono2 text-xs mt-0.5">{exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toLocaleString() : '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">Software</div><div className="font-mono2 text-xs mt-0.5 truncate">{exif.Software || '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">Color Space</div><div className="font-mono2 text-xs mt-0.5">{exif.ColorSpace || '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">Orientation</div><div className="font-mono2 text-xs mt-0.5">{exif.Orientation || '—'}</div></div>
                      <div><div className="text-zinc-500 text-xs">X Resolution</div><div className="font-mono2 text-xs mt-0.5">{exif.XResolution ? `${exif.XResolution} dpi` : '—'}</div></div>
                    </div>
                  </div>

                  {/* All tags collapsible */}
                  <div className="rounded-[24px] bg-zinc-900 border border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => setShowAllTags(!showAllTags)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className="text-sm font-semibold">All EXIF Tags <span className="text-zinc-500 font-normal">({allTags.length})</span></span>
                      {showAllTags ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                    </button>
                    {showAllTags && (
                      <div className="border-t border-zinc-800 max-h-[420px] overflow-auto font-mono2 text-[11px]">
                        <table className="w-full">
                          <tbody>
                            {allTags.map(([k, v]) => (
                              <tr key={k} className="border-b border-zinc-800/60 last:border-0">
                                <td className="px-6 py-2 text-zinc-500 w-1/3 align-top">{k}</td>
                                <td className="px-6 py-2 text-zinc-300 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Privacy callout */}
                  <div className="rounded-[20px] bg-[#1a1e0f] border border-[#2a3a0f] px-5 py-4 text-xs text-zinc-400 flex items-start gap-3">
                    <Shield className="w-4 h-4 text-[#a8e635] flex-shrink-0 mt-0.5" />
                    <div>
                      Use the "Strip EXIF &amp; save" button before posting online to remove GPS coordinates and camera metadata.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-xs text-zinc-600">
          <div className="mb-8 flex flex-col items-center gap-3">
            <a
              href="https://dacameragirl.github.io/exif-lens/"
              className="group flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 hover:border-[#d4ff4d]/40 hover:bg-zinc-900 transition-colors"
              aria-label="Open EXIF Lens live demo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/site-qr.svg`}
                alt="QR code for EXIF Lens"
                width={120}
                height={120}
                className="rounded-xl border border-zinc-800 bg-[#070b14] p-2 group-hover:border-[#d4ff4d]/30 transition-colors"
              />
              <span className="text-left">
                <span className="block text-sm font-semibold text-zinc-200">Scan to open on your phone</span>
                <span className="block mt-1 font-mono2 text-[11px] text-zinc-500">dacameragirl.github.io/exif-lens</span>
              </span>
            </a>
          </div>
          <p>Built with 💛 by <a href="https://github.com/DaCameraGirl" className="hover:text-zinc-400 transition-colors">DaCameraGirl</a> • <a href="https://github.com/DaCameraGirl/exif-lens" className="hover:text-zinc-400 transition-colors">Open source on GitHub</a></p>
          <p className="mt-1.5">Powered by exifr • Leaflet / OpenStreetMap • Next.js 15</p>
        </footer>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
