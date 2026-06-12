'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  CircleCheck,
  Search,
  Undo2,
  UserRound,
  Utensils,
} from 'lucide-react';
import { ROLE_LABELS, type GuestRole, type GuestSide } from '@/lib/guests';
import { parseGuestQrPayload, guestInitials } from '@/lib/checkin';
import { checkInGuest, undoCheckIn } from '../actions';

export type DeskGuest = {
  guestId: string;
  name: string;
  side: GuestSide;
  role: GuestRole;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  photoUrl: string | null;
  plusOneName: string | null;
  qrToken: string;
  tableLabel: string | null;
};

export type DeskCheckin = { guestId: string; checkedInAt: string };

const SIDE_LABELS: Record<GuestSide, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: 'Both sides',
};

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function CheckinDesk({
  eventId,
  guests,
  initialCheckins,
  expected,
}: {
  eventId: string;
  guests: DeskGuest[];
  initialCheckins: DeskCheckin[];
  expected: number;
}) {
  // guestId → checked-in ISO time (optimistically maintained client-side).
  const [checkins, setCheckins] = useState<Map<string, string>>(
    () => new Map(initialCheckins.map((c) => [c.guestId, c.checkedInAt])),
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
      // Debounce repeat frames of the same code held under the camera.
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
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setScanning(false);
        return;
      }
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = (now: number) => {
        if (!streamRef.current) return;
        // ~5 decodes/sec is plenty for a hand-held code and keeps phones cool.
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
    } catch {
      stopScanner();
      setCameraError('Camera unavailable — check permissions, or search by name below.');
    }
  }, [onToken, stopScanner]);

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
  const doCheckIn = useCallback(
    async (guestId: string, method: 'qr_scan' | 'manual_search') => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await checkInGuest(eventId, guestId, method);
        if (result.ok) {
          setCheckins((prev) => new Map(prev).set(guestId, result.checkedInAt));
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
        const result = await undoCheckIn(eventId, guestId);
        if (result.ok) {
          setCheckins((prev) => {
            const next = new Map(prev);
            next.delete(guestId);
            return next;
          });
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

  // ---- derived -----------------------------------------------------------
  const checkedCount = checkins.size;
  const progress = expected > 0 ? Math.min(100, Math.round((checkedCount / expected) * 100)) : 0;
  const selected = selectedId ? (guestById.get(selectedId) ?? null) : null;
  const selectedCheckin = selected ? checkins.get(selected.guestId) : undefined;

  const recent = useMemo(
    () =>
      [...checkins.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : -1))
        .slice(0, 8)
        .map(([guestId, at]) => ({ guest: guestById.get(guestId), at }))
        .filter((r): r is { guest: DeskGuest; at: string } => !!r.guest),
    [checkins, guestById],
  );

  return (
    <div className="mt-6 space-y-4">
      {/* headcount */}
      <section
        aria-label="Arrival headcount"
        className="rounded-xl border border-ink/10 bg-cream px-4 py-3"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink/70">Arrived</p>
          <p className="text-sm tabular-nums text-ink/70">
            <span className="text-xl font-semibold text-ink">{checkedCount}</span>
            {' / '}
            {expected} attending
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" role="presentation">
          <div
            className="h-full rounded-full bg-terracotta transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {/* scanner */}
      <section aria-label="QR scanner" className="overflow-hidden rounded-xl border border-ink/10">
        {scanning ? (
          <div className="relative bg-ink">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent camera viewfinder */}
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-white/70" aria-hidden />
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
            className="flex w-full items-center justify-center gap-2 bg-terracotta px-4 py-4 text-base font-semibold text-white transition-colors hover:bg-terracotta/90"
          >
            <Camera className="h-5 w-5" /> Scan a guest’s QR
          </button>
        )}
        {cameraError ? (
          <p className="border-t border-ink/10 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {cameraError}
          </p>
        ) : null}
      </section>

      {/* manual search */}
      <section aria-label="Find a guest by name">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="No QR on hand? Search their name…"
            className="w-full rounded-xl border border-ink/15 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-ink/40 focus:border-terracotta"
          />
        </div>
        {matches.length > 0 ? (
          <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/10 bg-white">
            {matches.map((g) => {
              const at = checkins.get(g.guestId);
              return (
                <li key={g.guestId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(g.guestId);
                      setQuery('');
                      lastHitRef.current = null;
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink/[0.03]"
                  >
                    <GuestAvatar guest={g} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{g.name}</span>
                      <span className="block truncate text-xs text-ink/50">
                        {g.tableLabel ? `Table · ${g.tableLabel}` : 'No table yet'}
                      </span>
                    </span>
                    {at ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                        <CircleCheck className="h-3.5 w-3.5" /> {timeLabel(at)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {notice ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {notice}
        </p>
      ) : null}

      {/* selected guest card */}
      {selected ? (
        <section
          aria-label="Arriving guest"
          className="rounded-2xl border border-terracotta/30 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <GuestAvatar guest={selected} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-ink">{selected.name}</h2>
              <p className="mt-0.5 text-sm text-ink/60">
                {SIDE_LABELS[selected.side]}
                {selected.role !== 'guest' ? ` · ${ROLE_LABELS[selected.role]}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 font-medium text-ink/80">
                  <Utensils className="h-3.5 w-3.5" />
                  {selected.tableLabel ? `Table · ${selected.tableLabel}` : 'No table assigned'}
                </span>
                {selected.plusOneName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                    <UserRound className="h-3.5 w-3.5" /> +1 · {selected.plusOneName}
                  </span>
                ) : null}
                {selected.rsvpStatus !== 'attending' ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    RSVP&rsquo;d {selected.rsvpStatus}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4">
            {selectedCheckin ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <CircleCheck className="h-5 w-5" /> Checked in at {timeLabel(selectedCheckin)}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doUndo(selected.guestId)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-900/70 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => doCheckIn(selected.guestId, scanning ? 'qr_scan' : 'manual_search')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-terracotta/90 disabled:opacity-60"
              >
                <Check className="h-5 w-5" /> Check in
              </button>
            )}
          </div>
        </section>
      ) : null}

      {/* recent arrivals */}
      {recent.length > 0 ? (
        <section aria-label="Recent arrivals">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">
            Recent arrivals
          </h3>
          <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/10 bg-white">
            {recent.map(({ guest, at }) => (
              <li key={guest.guestId} className="flex items-center gap-3 px-3 py-2">
                <GuestAvatar guest={guest} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{guest.name}</span>
                  <span className="block text-xs text-ink/50">
                    {timeLabel(at)}
                    {guest.tableLabel ? ` · Table ${guest.tableLabel}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doUndo(guest.guestId)}
                  aria-label={`Undo check-in for ${guest.name}`}
                  className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function GuestAvatar({ guest, size }: { guest: DeskGuest; size: 'sm' | 'lg' }) {
  const cls =
    size === 'lg'
      ? 'h-16 w-16 text-lg'
      : 'h-9 w-9 text-xs';
  if (guest.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary R2/OAuth photo hosts; avatar size, no LCP impact
      <img
        src={guest.photoUrl}
        alt=""
        className={`${cls} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-semibold text-terracotta-700`}
    >
      {guestInitials(guest.name)}
    </span>
  );
}
