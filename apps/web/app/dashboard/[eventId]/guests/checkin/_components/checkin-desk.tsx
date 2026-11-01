'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  CircleCheck,
  CircleDot,
  Nfc,
  Search,
  Undo2,
  UserRound,
  Utensils,
} from 'lucide-react';
import { guestRoleLabel, type GuestRole, type GuestSide } from '@/lib/guests';
import { useRoleNames } from '../../_components/role-names-context';
import { parseGuestQrPayload, guestInitials } from '@/lib/checkin';
import { guestTokenFromTag, nfcReadFailureCopy } from '@/lib/nfc-tag';
import { useNfcEnabled } from '@/app/_components/use-nfc-enabled';
import { useNfcTagReader } from '@/app/_components/use-nfc-tag-reader';
import { checkInGuest, checkTicketLive, undoCheckIn, type CheckinMethod, type TicketCheck } from '../actions';
import { DOOR_WORDS } from '@/lib/request-key';
import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { tableWords } from '@/lib/table-words';
import { useCameraThatComesBack } from '@/lib/use-camera-that-comes-back';
import type { CheckinNote } from '@/lib/offline/checkin-queue';

/** 🎫 The offline queue (EV3) — loaded on first use, never in the desk's first load. */
const offlineQueue = () => import('@/lib/offline/checkin-queue');
type OfflineQueue = Awaited<ReturnType<typeof offlineQueue>>;

/** True when the browser itself says there is no network. A request can still fail with it true (venue Wi-Fi with no
 *  internet) — every server call below is also caught and falls back to the saved list + the queue. */
function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export type DeskGuest = {
  guestId: string;
  name: string;
  side: GuestSide;
  role: GuestRole;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  photoUrl: string | null;
  /** Who they bring, by name — every named seat (`companionNames`); `[]` when none is named. */
  plusOneNames: readonly string[];
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
  viewer,
  guests,
  initialCheckins,
  expected,
  hasSides = true,
  queue = offlineQueue,
}: {
  eventId: string;
  /** The signed-in account — whose scans the offline queue holds and sends (EV3). */
  viewer: string;
  /** The offline queue — the daemon-backed `lib/offline/checkin-queue.ts`. Only `/dev/home-lab?view=offline` passes a
   *  stand-in (a lab has no database to send to); every real desk uses the default. */
  queue?: () => Promise<OfflineQueue>;
  guests: DeskGuest[];
  initialCheckins: DeskCheckin[];
  expected: number;
  /** False on a sideless event (`eventHasSides`): the guest line names the
   *  role only. */
  hasSides?: boolean;
}) {
  // The couple's own words for roles (owner 2026-09-30).
  const roleNames = useRoleNames();
  // guestId → checked-in ISO time (optimistically maintained client-side).
  const [checkins, setCheckins] = useState<Map<string, string>>(
    () => new Map(initialCheckins.map((c) => [c.guestId, c.checkedInAt])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // HOW the selected guest was found — the audit trail's `method`. Set by the
  // path that selected them, never inferred from whether the camera is on.
  const [selectedVia, setSelectedVia] = useState<CheckinMethod>('manual_search');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // 🎟 The door's LIVE answer for the last scanned code (frames H1–H3) — asked
  // of the server at the moment of scanning, never of the list loaded earlier.
  const [live, setLive] = useState<TicketCheck | null>(null);
  // A guest accepted AFTER this desk loaded still admits — held here once the
  // live check has named them.
  const [lateGuests, setLateGuests] = useState<Map<string, DeskGuest>>(() => new Map());

  // ---- no signal (EV3, owner 2026-10-28: "scans … QUEUE offline and sync later; double claims surfaced, never lost") --
  // `online` is what the desk last learned — the browser's word, or a request that failed on the way. `queued` holds
  // this account's scans still waiting on this phone (guestId → item id in the offline daemon's `checkin` store).
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<Map<string, string>>(() => new Map());
  const [sent, setSent] = useState<number | null>(null);
  const [notes, setNotes] = useState<CheckinNote[]>([]);
  /** The selected guest was found on THIS PHONE'S saved list — the live check could not run. */
  const [savedListPick, setSavedListPick] = useState(false);
  const sending = useRef(false);

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
    const m = new Map<string, DeskGuest>(lateGuests);
    for (const g of guests) m.set(g.guestId, g);
    return m;
  }, [guests, lateGuests]);

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const onToken = useCallback(
    async (token: string, via: 'qr_scan' | 'nfc_tap' = 'qr_scan') => {
      // Debounce repeat frames of the same code held under the camera.
      if (lastHitRef.current === token) return;
      lastHitRef.current = token;
      // 🎟 LIVE, EVERY SCAN (owner 2026-09-29): a saved "Request pending"
      // picture, a screenshot, or a code the couple has since declined — the
      // row decides, now. The desk's own list is only the fast path's names.
      let check: TicketCheck | null = null;
      if (!browserOffline()) {
        try {
          check = await checkTicketLive(eventId, token);
        } catch {
          setOnline(false); // the request did not get through — no signal, whatever the browser says
        }
      } else {
        setOnline(false);
      }
      if (!check) {
        // 📶 NO SIGNAL: the list saved on this phone decides who it is; the live check (a declined request, a
        // screenshot) runs when the queued check-in is sent — and if it refuses then, the desk says so.
        const known = guestByToken.get(token);
        setLive(null);
        if (!known) {
          setNotice(
            via === 'nfc_tap'
              ? 'That tag isn’t on this phone’s saved list — check again when the signal is back.'
              : 'That QR isn’t on this phone’s saved list — check again when the signal is back.',
          );
          return;
        }
        if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
        setNotice(null);
        setQuery('');
        setSelectedVia(via);
        setSavedListPick(true);
        setSelectedId(known.guestId);
        return;
      }
      setOnline(true);
      setSavedListPick(false);
      setLive(check);
      if (check.verdict === 'pending' || check.verdict === 'declined') {
        setSelectedId(null);
        setNotice(null);
        if (typeof navigator !== 'undefined') navigator.vibrate?.([60, 60, 60]);
        return;
      }
      if (check.verdict !== 'valid') {
        setNotice(
          via === 'nfc_tap'
            ? 'That tag isn’t a guest on this event’s list.'
            : 'That QR isn’t a guest on this event’s list.',
        );
        return;
      }
      const known = guestByToken.get(token) ?? guestById.get(check.guestId);
      if (!known) {
        setLateGuests((prev) =>
          new Map(prev).set(check.guestId, {
            guestId: check.guestId,
            name: check.name,
            side: 'both',
            role: 'guest',
            rsvpStatus: 'attending',
            photoUrl: null,
            plusOneNames: [],
            qrToken: token,
            tableLabel: null,
          }),
        );
      }
      if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
      setNotice(null);
      setQuery('');
      setSelectedVia(via);
      setSelectedId(check.guestId);
    },
    [eventId, guestByToken, guestById],
  );

  // ---- NFC tag reader (the guest's tag holds the same link as their QR) ----
  const nfcDesk = useNfcEnabled();
  const nfc = useNfcTagReader(
    useCallback(
      (urls: string[]) => {
        const hit = guestTokenFromTag(urls, parseGuestQrPayload);
        if (hit.token !== null) {
          lastHitRef.current = null; // a deliberate tap is never a repeat frame
          void onToken(hit.token, 'nfc_tap');
        } else {
          setNotice(
            hit.reason === 'empty'
              ? 'That tag is blank — it holds no link.'
              : 'That tag isn’t a Setnayan guest tag.',
          );
        }
      },
      [onToken],
    ),
  );

  // Acquire the decoder + camera, then flip into scanning mode. The stream is
  // wired into the <video> by the effect below — NOT here — because the
  // <video> element only mounts once `scanning` is true, so `videoRef.current`
  // is still null at this point.
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

  // THE CAMERA COMES BACK (Duo + iPad audit 2026-10-19, W4): when iOS, a Duo
  // or a dead track takes the scanner's camera, reopen it through the same
  // start path (same rear camera) instead of leaving a frozen viewfinder.
  useCameraThatComesBack({
    streamRef,
    live: scanning,
    restart: () => {
      stopScanner();
      void startScanner();
    },
  });

  // Once the <video> has mounted (scanning === true), bind the live stream and
  // run the decode loop. Runs after commit, so videoRef.current is populated.
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
          if (token) void onToken(token);
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
          g.plusOneNames.some((n) => n.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [guests, query]);

  // ---- actions -----------------------------------------------------------
  const doCheckIn = useCallback(
    async (guestId: string, method: CheckinMethod) => {
      setBusy(true);
      setNotice(null);
      try {
        if (!browserOffline()) {
          try {
            const result = await checkInGuest(eventId, guestId, method);
            setOnline(true);
            if (result.ok) {
              setCheckins((prev) => new Map(prev).set(guestId, result.checkedInAt));
            } else {
              setNotice(result.error);
            }
            return;
          } catch {
            // The request never reached Setnayan — keep the scan on this phone instead of losing it.
          }
        }
        setOnline(false);
        try {
          const q = await (await queue()).queueCheckin({
            viewer,
            eventId,
            guestId,
            name: guestById.get(guestId)?.name ?? 'A guest',
            method,
          });
          setQueued((prev) => new Map(prev).set(guestId, q.itemId));
          setCheckins((prev) => new Map(prev).set(guestId, q.scannedAt));
          setSent(null);
        } catch {
          // 🔑 Never a silent loss: if this phone cannot even keep it (private mode, storage full), say so.
          setNotice('No signal, and this phone couldn’t keep the scan — check them in on paper and again when you’re back online.');
        }
      } finally {
        setBusy(false);
        lastHitRef.current = null;
      }
    },
    [eventId, viewer, guestById, queue],
  );

  const doUndo = useCallback(
    async (guestId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        // An unsent scan is undone on this phone: it leaves the queue and is never sent.
        const itemId = queued.get(guestId);
        if (itemId) {
          await (await queue()).unqueueCheckin(itemId);
          setQueued((prev) => {
            const next = new Map(prev);
            next.delete(guestId);
            return next;
          });
          setCheckins((prev) => {
            const next = new Map(prev);
            next.delete(guestId);
            return next;
          });
          return;
        }
        if (browserOffline()) {
          setOnline(false);
          setNotice('Undo needs signal — try again when you’re back online.');
          return;
        }
        let result: Awaited<ReturnType<typeof undoCheckIn>>;
        try {
          result = await undoCheckIn(eventId, guestId);
        } catch {
          setOnline(false);
          setNotice('Undo needs signal — try again when you’re back online.');
          return;
        }
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
    [eventId, queued, queue],
  );

  // ---- the queue: load it, and send it whenever the signal is back ----------------------------------------------
  const refreshQueue = useCallback(async () => {
    const q = await queue();
    const items = await q.queuedCheckins(viewer, eventId);
    setQueued(new Map(items.map((i) => [i.guestId, i.itemId])));
    setCheckins((prev) => {
      const next = new Map(prev);
      for (const i of items) if (!next.has(i.guestId)) next.set(i.guestId, i.scannedAt);
      return next;
    });
    setNotes(q.readCheckinNotes(viewer, eventId));
    return items.length;
  }, [viewer, eventId, queue]);

  const sendQueued = useCallback(async () => {
    if (sending.current || browserOffline()) return;
    sending.current = true;
    try {
      const q = await queue();
      const waiting = (await q.queuedCheckins(viewer, eventId)).length;
      if (waiting === 0) return;
      const n = await q.sendQueuedCheckins(viewer);
      const left = await refreshQueue();
      if (left < waiting) {
        setOnline(true);
        setSent(n);
      }
    } catch {
      // Still no way through — the scans stay on this phone for the next try.
    } finally {
      sending.current = false;
    }
  }, [viewer, eventId, refreshQueue, queue]);

  useEffect(() => {
    setOnline(!browserOffline());
    void refreshQueue()
      .then((n) => (n > 0 ? sendQueued() : undefined))
      .catch(() => undefined);
    const back = () => {
      setOnline(true);
      void sendQueued();
    };
    const gone = () => setOnline(false);
    window.addEventListener('online', back);
    window.addEventListener('offline', gone);
    return () => {
      window.removeEventListener('online', back);
      window.removeEventListener('offline', gone);
    };
  }, [refreshQueue, sendQueued]);

  const dismissNote = useCallback(
    async (guestId: string) => {
      const q = await queue();
      q.dismissCheckinNote(viewer, eventId, guestId);
      setNotes(q.readCheckinNotes(viewer, eventId));
    },
    [viewer, eventId, queue],
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
      {/* 📶 THE QUEUE LINE (EV3, prototype frame "Supplier · Hub › Scan"): "● No signal · N scans saved on this phone"
          → "✓ Back online · N sent". Shown only when there is something to say. */}
      {!online ? (
        <p role="status" data-desk-queue="offline" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-warn-800">
          <CircleDot aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          No signal · {queued.size === 0 ? 'scans will be saved on this phone' : `${formatCount(queued.size)} scan${queued.size === 1 ? '' : 's'} saved on this phone`}
        </p>
      ) : queued.size > 0 ? (
        <p role="status" data-desk-queue="waiting" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-warn-800">
          <CircleDot aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          {formatCount(queued.size)} scan{queued.size === 1 ? '' : 's'} saved on this phone · sending when Setnayan answers
        </p>
      ) : sent !== null ? (
        <p role="status" data-desk-queue="sent" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-success-700">
          <CircleCheck aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          Back online · {formatCount(sent)} sent
        </p>
      ) : null}

      {/* 🔎 NEEDS A LOOK — what came back when the saved scans were sent: a guest another phone had already checked in
          (the earlier time stands), or a scan the live check refused. Never dropped silently. */}
      {notes.length > 0 ? (
        <section aria-label="Needs a look" data-desk-notes="" className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Needs a look</h3>
          <ul className="divide-y divide-ink/10">
            {notes.map((n) => (
              <li key={n.guestId} className="flex items-start gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{n.name}</span>
                  <span className="block text-xs text-ink/65">{n.detail}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void dismissNote(n.guestId)}
                  className="min-h-11 shrink-0 rounded-lg border border-ink/15 px-3 text-sm font-medium text-ink/75"
                >
                  OK
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* headcount */}
      <section
        aria-label="Arrival headcount"
        className="rounded-xl border border-ink/10 bg-cream px-4 py-3"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink/70">Arrived</p>
          <p className="text-sm tabular-nums text-ink/70">
            <span className="text-xl font-semibold text-ink">{formatCount(checkedCount)}</span>
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
            className="flex w-full items-center justify-center gap-2 bg-terracotta-700 px-4 py-4 text-base font-semibold text-cream transition-colors hover:bg-terracotta-800"
          >
            <Camera className="h-5 w-5" /> Scan a guest’s QR
          </button>
        )}
        {cameraError ? (
          <p className="border-t border-ink/10 bg-warn-50 px-4 py-2 text-sm text-warn-800">
            {cameraError}
          </p>
        ) : null}
      </section>

      {/* NFC tag reader — shown only where this device can read tags */}
      {nfcDesk && nfc.supported ? (
        <section aria-label="NFC tag reader" className="overflow-hidden rounded-xl border border-ink/10">
          {nfc.listening ? (
            <div className="flex items-center justify-between gap-3 bg-cream px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-ink/80">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 animate-pulse rounded-full bg-terracotta"
                />
                Listening — tap a guest&rsquo;s tag on this phone
              </p>
              <button
                type="button"
                onClick={nfc.stop}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void nfc.start()}
              className="flex w-full items-center justify-center gap-2 bg-white dark:bg-raised px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.03]"
            >
              <Nfc className="h-5 w-5" /> Read a guest&rsquo;s tag
            </button>
          )}
          {nfc.failure ? (
            <p role="alert" className="border-t border-ink/10 bg-warn-50 px-4 py-2 text-sm text-warn-800">
              {nfcReadFailureCopy(nfc.failure)}
            </p>
          ) : null}
        </section>
      ) : null}

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
                      setSelectedVia('manual_search');
                      setSavedListPick(false);
                      setSelectedId(g.guestId);
                      setLive(null);
                      setQuery('');
                      lastHitRef.current = null;
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink/[0.03]"
                  >
                    <GuestAvatar guest={g} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{g.name}</span>
                      <span className="block truncate text-xs text-ink/50">
                        {g.tableLabel ? tableWords(g.tableLabel) : 'No table yet'}
                      </span>
                    </span>
                    {at ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success-700">
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
        <p role="status" className="rounded-xl bg-warn-50 px-4 py-2.5 text-sm text-warn-800">
          {notice}
        </p>
      ) : null}

      {/* 🎟 THE LIVE VERDICT for a code that must NOT admit (frames H2 · H3) —
          amber "Not confirmed yet", red "Not approved". Nothing here lets them in. */}
      {live && (live.verdict === 'pending' || live.verdict === 'declined') ? (
        <section
          aria-label="Scanned code"
          data-door-verdict={live.verdict}
          className={`rounded-2xl p-4 ${live.verdict === 'pending' ? 'bg-warn-50' : 'bg-danger-50'}`}
        >
          <p className={`text-sm font-semibold ${live.verdict === 'pending' ? 'text-warn-800' : 'text-danger-800'}`}>
            {live.verdict === 'pending' ? DOOR_WORDS.pending : DOOR_WORDS.declined}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-ink">{live.name}</h2>
          <p className="mt-1 text-sm text-ink/75">
            {live.verdict === 'pending' ? DOOR_WORDS.pendingWhy : DOOR_WORDS.declinedWhy}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {live.verdict === 'pending' ? (
              <>
                <Link
                  href={`/dashboard/${eventId}/guests/claims`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-700 px-4 text-base font-semibold text-cream hover:bg-terracotta-800"
                >
                  {DOOR_WORDS.pendingOpen}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setLive(null);
                    lastHitRef.current = null;
                  }}
                  className="min-h-[44px] text-sm font-medium text-ink/70"
                >
                  Not now
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLive(null);
                  lastHitRef.current = null;
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white dark:bg-raised px-4 text-base font-semibold text-ink shadow-sm"
              >
                {DOOR_WORDS.next}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-ink/60" data-checked-live="">
            {DOOR_WORDS.checkedLive(timeLabel(live.checkedAt), checkedCount, expected)}
          </p>
        </section>
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
              {live?.verdict === 'valid' && live.guestId === selected.guestId ? (
                <p className="inline-flex items-center gap-1 text-sm font-semibold text-success-700" data-door-verdict="valid">
                  <CircleCheck className="h-4 w-4" /> {DOOR_WORDS.valid}
                </p>
              ) : savedListPick ? (
                <p className="inline-flex items-center gap-1 text-sm font-semibold text-warn-800" data-door-verdict="saved-list">
                  <CircleDot className="h-4 w-4" /> On this phone’s saved list · checked live when the signal is back
                </p>
              ) : null}
              <h2 className="truncate text-lg font-semibold text-ink">{selected.name}</h2>
              <p className="mt-0.5 text-sm text-ink/60">
                {[
                  hasSides ? SIDE_LABELS[selected.side] : null,
                  selected.role !== 'guest' ? guestRoleLabel(selected.role, roleNames) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || guestRoleLabel(selected.role, roleNames)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 font-medium text-ink/80">
                  <Utensils className="h-3.5 w-3.5" />
                  {selected.tableLabel ? tableWords(selected.tableLabel) : 'No table assigned'}
                </span>
                {selected.plusOneNames.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-ink/70">
                    <UserRound className="h-3.5 w-3.5" /> +{selected.plusOneNames.length} · {selected.plusOneNames.join(', ')}
                  </span>
                ) : null}
                {selected.rsvpStatus !== 'attending' ? (
                  <span className="rounded-full bg-warn-100 px-2.5 py-1 text-xs font-medium text-warn-800">
                    RSVP&rsquo;d {selected.rsvpStatus}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4">
            {selectedCheckin ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-success-50 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
                  <CircleCheck className="h-5 w-5" />{' '}
                  {queued.has(selected.guestId) ? 'Checked in · saved on this phone' : `Checked in at ${timeLabel(selectedCheckin)}`}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doUndo(selected.guestId)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-success-900/70 hover:bg-success-100 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => doCheckIn(selected.guestId, selectedVia)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-700 px-4 py-3 text-base font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
              >
                <Check className="h-5 w-5" /> Mark arrived
              </button>
            )}
          </div>
          {live?.verdict === 'valid' && live.guestId === selected.guestId ? (
            <p className="mt-3 text-xs text-ink/60" data-checked-live="">
              {DOOR_WORDS.checkedLive(timeLabel(live.checkedAt), checkedCount, expected)}
            </p>
          ) : null}
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
                    {guest.tableLabel ? ` · ${tableWords(guest.tableLabel)}` : ''}
                    {queued.has(guest.guestId) ? ' · saved on this phone' : ''}
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
        width={size === 'lg' ? 64 : 36}
        height={size === 'lg' ? 64 : 36}
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
