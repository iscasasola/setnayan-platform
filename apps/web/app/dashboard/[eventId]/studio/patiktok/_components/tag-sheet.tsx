'use client';

// Iteration 0017 — Patiktok booth tagging sheet (Phase A).
//
// "Who's recording?" — set BEFORE the countdown so a clip is attributed up
// front (the guest sees their own name) and editable at review. Three ways to
// fill the tag, ordered by friction:
//   • Pick from list  — typeahead over the event's guests (no camera).
//   • Scan QR          — place-card (guest) OR table sign (group). Reuses the
//                        shared makeQrDetector + parsePapicTagScan that Papic /
//                        the check-in desk use; resolves the scan to a guest /
//                        table on THIS event's list, client-side.
//   • Just a name      — free text, for non-guests / "Tita Baby's table".
//
// Tagging is always optional — a clip is kept either way (untagged-still-
// delivered). The live FACE pre-fill (when Papic is on) is Phase B and lands on
// top of this same tag slot. The scanner owns the camera only while active; it
// tells the parent via onScanActiveChange so the parent can free / resume the
// recording camera (one camera at a time on iOS Safari).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Camera, CameraOff, Search, Tag, UserRound, Users, X } from 'lucide-react';
import { guestInitials } from '@/lib/checkin';
import { parsePapicTagScan } from '@/lib/papic-tag';
import { makeQrDetector } from '@/lib/qr-scan';
import { useModalA11y } from '@/lib/use-modal-a11y';

export type BoothGuest = {
  guestId: string;
  name: string;
  qrToken: string;
  photoUrl: string | null;
};
export type BoothTable = {
  tableId: string;
  label: string;
  publicId: string;
  qrToken: string;
};
export type BoothTag =
  | { kind: 'guest'; guestId: string; label: string; source: 'guest_select' | 'qr_scan' | 'auto_face' }
  | { kind: 'table'; tableId: string; label: string; source: 'table_qr' }
  | { kind: 'manual'; label: string; source: 'manual_text' };

export function TagSheet({
  guests,
  tables,
  allowScan,
  onApply,
  onClose,
  onScanActiveChange,
}: {
  guests: BoothGuest[];
  tables: BoothTable[];
  allowScan: boolean;
  onApply: (tag: BoothTag) => void;
  onClose: () => void;
  onScanActiveChange: (active: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });

  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // ---- scanner -----------------------------------------------------------
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef<Awaited<ReturnType<typeof makeQrDetector>> | null>(null);
  const rafRef = useRef<number>(0);
  const lastDecodeRef = useRef(0);
  const lastHitRef = useRef<string | null>(null);

  const guestByToken = useMemo(() => {
    const m = new Map<string, BoothGuest>();
    for (const g of guests) m.set(g.qrToken, g);
    return m;
  }, [guests]);
  // Table refs come back from parseTableQrPayload as either an UPPER public_id
  // (S89T-…) or a LOWER 32-hex qr_token — key the map on both.
  const tableByRef = useMemo(() => {
    const m = new Map<string, BoothTable>();
    for (const t of tables) {
      m.set(t.publicId.toUpperCase(), t);
      m.set(t.qrToken.toLowerCase(), t);
    }
    return m;
  }, [tables]);

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectRef.current = null;
    setScanning(false);
    onScanActiveChange(false);
  }, [onScanActiveChange]);

  const onScanResult = useCallback(
    (raw: string) => {
      const parsed = parsePapicTagScan(raw);
      if (!parsed) {
        setNotice('That QR isn’t a Setnayan guest or table code.');
        return;
      }
      if (parsed.kind === 'guest') {
        const g = guestByToken.get(parsed.token);
        if (!g) {
          setNotice('That place card isn’t a guest on this event’s list.');
          return;
        }
        if (lastHitRef.current === g.guestId) return;
        lastHitRef.current = g.guestId;
        if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
        stopScanner();
        onApply({ kind: 'guest', guestId: g.guestId, label: g.name, source: 'qr_scan' });
        onClose();
        return;
      }
      const t = tableByRef.get(parsed.ref);
      if (!t) {
        setNotice('That table sign isn’t on this event’s seating chart.');
        return;
      }
      if (lastHitRef.current === t.tableId) return;
      lastHitRef.current = t.tableId;
      if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
      stopScanner();
      onApply({ kind: 'table', tableId: t.tableId, label: `Table · ${t.label}`, source: 'table_qr' });
      onClose();
    },
    [guestByToken, tableByRef, onApply, onClose, stopScanner],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setNotice(null);
    lastHitRef.current = null;
    try {
      // Tell the parent FIRST so it can free the recording camera before we
      // grab one (iOS Safari runs a single camera at a time).
      onScanActiveChange(true);
      const [detect, stream] = await Promise.all([
        makeQrDetector(),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        }),
      ]);
      detectRef.current = detect;
      streamRef.current = stream;
      setScanning(true);
    } catch {
      onScanActiveChange(false);
      setCameraError('Camera unavailable — check permissions, or search by name below.');
    }
  }, [onScanActiveChange]);

  // Bind the stream + run the decode loop once the <video> mounts.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const detect = detectRef.current;
    if (!video || !stream || !detect) return;

    let active = true;
    video.srcObject = stream;
    void video.play().catch(() => {});

    const tick = async (now: number) => {
      if (!active || !streamRef.current) return;
      // ~5 decodes/sec — plenty for a hand-held code, keeps phones cool.
      if (now - lastDecodeRef.current > 200) {
        lastDecodeRef.current = now;
        try {
          const raw = await detect(video);
          if (raw) onScanResult(raw);
        } catch {
          // transient decode error — keep looping
        }
      }
      if (active) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, onScanResult]);

  // Release the camera on unmount.
  useEffect(() => stopScanner, [stopScanner]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return guests.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 12);
  }, [guests, query]);

  const applyManual = useCallback(() => {
    const label = manual.trim();
    if (!label) return;
    onApply({ kind: 'manual', label, source: 'manual_text' });
    onClose();
  }, [manual, onApply, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patiktok-tag-title"
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2
              id="patiktok-tag-title"
              className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight"
            >
              <Tag aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Who’s recording?
            </h2>
            <p className="mt-0.5 text-sm text-ink/60">
              Optional — clips are kept either way. Pick, scan a place card, or
              tag a whole table.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scan */}
        {allowScan ? (
          <section className="mb-3 overflow-hidden rounded-xl border border-ink/10">
            {scanning ? (
              <div className="relative bg-ink">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent viewfinder */}
                <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-2xl border-2 border-white/70" aria-hidden />
                </div>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow"
                >
                  <CameraOff className="h-4 w-4" /> Stop scanning
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startScanner}
                className="flex w-full items-center justify-center gap-2 bg-terracotta px-4 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700"
              >
                <Camera className="h-5 w-5" /> Scan place card or table QR
              </button>
            )}
            {cameraError ? (
              <p className="border-t border-ink/10 bg-warn-50 px-4 py-2 text-sm text-warn-800">
                {cameraError}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Pick from list */}
        <section className="mb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a guest’s name…"
              className="w-full rounded-xl border border-ink/15 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-ink/40 focus:border-terracotta/50"
            />
          </div>
          {matches.length > 0 ? (
            <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/10 bg-white">
              {matches.map((g) => (
                <li key={g.guestId}>
                  <button
                    type="button"
                    onClick={() => {
                      onApply({ kind: 'guest', guestId: g.guestId, label: g.name, source: 'guest_select' });
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink/[0.03]"
                  >
                    {g.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary R2/OAuth host; avatar size, no LCP impact
                      <img src={g.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        aria-hidden
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700"
                      >
                        {guestInitials(g.name)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{g.name}</span>
                    <UserRound aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="mt-2 text-sm text-ink/55">No guest matches “{query.trim()}”.</p>
          ) : guests.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">
              No guests on this event yet — scan a place card or type a name below.
            </p>
          ) : null}
        </section>

        {/* Just a name */}
        <section>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Or just a name
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyManual();
                  }
                }}
                placeholder="e.g. Tita Baby’s barkada"
                maxLength={80}
                className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50"
              />
              <button
                type="button"
                onClick={applyManual}
                disabled={!manual.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/85 disabled:opacity-40"
              >
                <Users className="h-4 w-4" strokeWidth={1.75} /> Use
              </button>
            </div>
          </label>
        </section>

        {notice ? (
          <p role="status" className="mt-3 rounded-xl bg-warn-50 px-4 py-2.5 text-sm text-warn-800">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
