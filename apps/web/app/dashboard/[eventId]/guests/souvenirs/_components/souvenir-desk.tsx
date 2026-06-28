'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Check, Gift, Search, Undo2 } from 'lucide-react';
import { parseGuestQrPayload, guestInitials } from '@/lib/checkin';
import { markSouvenirReceived, undoSouvenirReceived } from '../actions';

// Souvenir-table desk (owner 2026-06-28). Same scan-or-search → confirm flow as
// the check-in desk, pointed at guest_souvenir_claims: staff scan a guest's
// personal QR (or search by name) at the giveaway table to confirm they got
// their souvenir. Optimistic client state; the server actions are the source of
// truth. The scanner mirrors the check-in desk's jsQR loop intentionally —
// kept self-contained so the two stations stay independent.

export type DeskGuest = {
  guestId: string;
  name: string;
  photoUrl: string | null;
  plusOneName: string | null;
  qrToken: string;
  tableLabel: string | null;
};

export type DeskClaim = { guestId: string; claimedAt: string };

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function SouvenirDesk({
  eventId,
  guests,
  initialClaims,
}: {
  eventId: string;
  guests: DeskGuest[];
  initialClaims: DeskClaim[];
}) {
  const [claims, setClaims] = useState<Map<string, string>>(
    () => new Map(initialClaims.map((c) => [c.guestId, c.claimedAt])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ---- scanner ------------------------------------------------------------
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsqrRef = useRef<typeof import('jsqr').default | null>(null);
  const rafRef = useRef<number>(0);
  const lastDecodeRef = useRef(0);
  const lastHitRef = useRef<string | null>(null);

  const guestByToken = useMemo(() => {
    const m = new Map<string, DeskGuest>();
    for (const g of guests) m.set(g.qrToken, g);
    return m;
  }, [guests]);
  const guestById = useMemo(() => {
    const m = new Map<string, DeskGuest>();
    for (const g of guests) m.set(g.guestId, g);
    return m;
  }, [guests]);

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const onToken = useCallback(
    (token: string) => {
      const guest = guestByToken.get(token);
      if (!guest) {
        setNotice('That QR isn’t a guest on this event’s list.');
        return;
      }
      if (lastHitRef.current === guest.guestId) return;
      lastHitRef.current = guest.guestId;
      if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
      setNotice(null);
      setQuery('');
      setSelectedId(guest.guestId);
    },
    [guestByToken],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setNotice(null);
    try {
      const [{ default: jsQR }, stream] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        }),
      ]);
      jsqrRef.current = jsQR;
      streamRef.current = stream;
      setScanning(true);
    } catch {
      stopScanner();
      setCameraError('Camera unavailable — check permissions, or search by name below.');
    }
  }, [stopScanner]);

  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const jsQR = jsqrRef.current;
    if (!video || !stream || !jsQR) return;

    let active = true;
    video.srcObject = stream;
    void video.play().catch(() => {});

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = (now: number) => {
      if (!active || !streamRef.current) return;
      if (now - lastDecodeRef.current > 200 && ctx && video.readyState >= 2) {
        lastDecodeRef.current = now;
        const scale = Math.min(1, 640 / (video.videoWidth || 640));
        canvas.width = Math.round((video.videoWidth || 640) * scale);
        canvas.height = Math.round((video.videoHeight || 480) * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const token = parseGuestQrPayload(code.data);
          if (token) onToken(token);
          else setNotice('That QR isn’t a Setnayan guest code.');
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, onToken]);

  useEffect(() => stopScanner, [stopScanner]);

  // ---- search ------------------------------------------------------------
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return guests
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.plusOneName ? g.plusOneName.toLowerCase().includes(q) : false),
      )
      .slice(0, 12);
  }, [guests, query]);

  // ---- actions -----------------------------------------------------------
  const doMark = useCallback(
    async (guestId: string, method: 'qr_scan' | 'manual_search') => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await markSouvenirReceived(eventId, guestId, method);
        if (result.ok) {
          setClaims((prev) => new Map(prev).set(guestId, result.claimedAt));
        } else {
          setNotice(result.error);
        }
      } finally {
        setBusy(false);
        lastHitRef.current = null;
      }
    },
    [eventId],
  );

  const doUndo = useCallback(
    async (guestId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await undoSouvenirReceived(eventId, guestId);
        if (result.ok) {
          setClaims((prev) => {
            const next = new Map(prev);
            next.delete(guestId);
            return next;
          });
          setSelectedId(null);
        } else {
          setNotice(result.error);
        }
      } finally {
        setBusy(false);
      }
    },
    [eventId],
  );

  const received = claims.size;
  const total = guests.length;
  const selected = selectedId ? guestById.get(selectedId) ?? null : null;
  const selectedClaimedAt = selectedId ? claims.get(selectedId) ?? null : null;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-cream px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <Gift aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Souvenirs given
        </p>
        <p className="font-mono text-sm tabular-nums text-ink/70">
          {received} <span className="text-ink/40">/ {total}</span>
        </p>
      </div>

      {/* Scanner */}
      <section aria-label="QR scanner" className="overflow-hidden rounded-xl border border-ink/10">
        {scanning ? (
          <div className="relative bg-ink">
            <video
              ref={videoRef}
              playsInline
              muted
              className="mx-auto block max-h-[46vh] w-full object-cover"
            />
            <button
              type="button"
              onClick={stopScanner}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cream/95 px-4 py-2 text-sm font-medium text-ink shadow-lg"
            >
              <CameraOff className="h-4 w-4" strokeWidth={1.75} /> Stop scanning
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 bg-mulberry px-4 py-4 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
          >
            <Camera className="h-5 w-5" strokeWidth={1.75} /> Scan a guest QR
          </button>
        )}
        {cameraError ? (
          <p className="bg-terracotta/10 px-4 py-2 text-xs text-terracotta-700">{cameraError}</p>
        ) : null}
      </section>

      {/* Search */}
      <div>
        <label className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            placeholder="…or find a guest by name"
            className="w-full rounded-xl border border-ink/15 bg-cream py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          />
        </label>
        {matches.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {matches.map((g) => (
              <li key={g.guestId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(g.guestId)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream px-3 py-2 text-left text-sm hover:border-terracotta"
                >
                  <span className="truncate text-ink">{g.name}</span>
                  {claims.has(g.guestId) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success-700">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Given
                    </span>
                  ) : g.tableLabel ? (
                    <span className="shrink-0 text-xs text-ink/45">{g.tableLabel}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {notice ? (
        <p className="rounded-lg border border-warn-300 bg-warn-50 px-3 py-2 text-sm text-warn-900">
          {notice}
        </p>
      ) : null}

      {/* Selected guest action card */}
      {selected ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {selected.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photoUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-sm font-semibold text-mulberry">
                {guestInitials(selected.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{selected.name}</p>
              {selected.tableLabel ? (
                <p className="text-xs text-ink/55">{selected.tableLabel}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            {selectedClaimedAt ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="inline-flex items-center gap-1.5 text-sm text-success-700">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Souvenir given{selectedClaimedAt ? ` · ${timeLabel(selectedClaimedAt)}` : ''}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doUndo(selected.guestId)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 hover:text-ink/80 disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" strokeWidth={2} /> Undo
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => doMark(selected.guestId, scanning ? 'qr_scan' : 'manual_search')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-3 text-sm font-semibold text-cream transition hover:bg-mulberry-600 disabled:opacity-50"
              >
                <Gift className="h-4 w-4" strokeWidth={1.75} />
                Confirm souvenir given
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
