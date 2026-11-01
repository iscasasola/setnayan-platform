'use client';

/**
 * 📶 useOfflineCopy — the page half of THE SAVED COPY FOR A NO-SIGNAL VENUE (EV3, owner 2026-10-28; the worker half is
 * `public/sw.js` "THE SAVED COPY FOR A NO-SIGNAL VENUE", the rules are `lib/offline-copies.ts`).
 *
 * ALWAYS ON: opened with signal inside the event's window (T-3 days → the day after), the page asks the worker to keep
 * this viewer's copies of its event's pages (`OFFLINE_SAVE`, not forced — the worker re-renders only copies older than
 * 30 min). "Update now" forces it. The hook reads what is kept straight from Cache Storage, so the mark is the truth of
 * the phone, not of this page's memory — and a save that did not land is said (`failed`), never drawn as saved.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  OFFLINE_COPIES_CACHE,
  OFFLINE_REGISTRY_PATH,
  offlineCopiesUntil,
  offlineSavingOpen,
  parseOfflineRegistry,
  savedAtFor,
  savedCopyOnScreen,
  type SavedPhase,
} from '@/lib/offline-copies';

type SaveAnswer = { ok: boolean; savedAt: number | null; failed: string[]; dev?: boolean; refused?: boolean };

/** Rendering four pages on venue Wi-Fi can be slow; past this the save is reported as not landed. */
const SAVE_TIMEOUT_MS = 90_000;

function workerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && typeof caches !== 'undefined';
}

/** This phone keeps a copy beyond Safari's 7-day purge: the installed app / Home Screen / the native shell. */
export function runsAsInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
    return Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

async function readSavedAt(viewer: string, eventId: string, paths: readonly string[]): Promise<number | null> {
  try {
    if (!(await caches.has(OFFLINE_COPIES_CACHE))) return null;
    const cache = await caches.open(OFFLINE_COPIES_CACHE);
    const res = await cache.match(OFFLINE_REGISTRY_PATH);
    if (!res) return null;
    return savedAtFor(parseOfflineRegistry(await res.json()), viewer, eventId, paths, Date.now());
  } catch {
    return null;
  }
}

async function askWorker(data: Record<string, unknown>): Promise<SaveAnswer | null> {
  if (!workerSupported()) return null;
  const sw = navigator.serviceWorker;
  const ready = await Promise.race([
    sw.ready.then((r) => r.active ?? null),
    new Promise<null>((r) => window.setTimeout(() => r(null), 8_000)),
  ]);
  const target = sw.controller ?? ready;
  if (!target) return null;
  return new Promise<SaveAnswer | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), SAVE_TIMEOUT_MS);
    channel.port1.onmessage = (e: MessageEvent) => {
      window.clearTimeout(timer);
      resolve((e.data ?? null) as SaveAnswer | null);
    };
    try {
      target.postMessage(data, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

export type OfflineCopy = {
  phase: SavedPhase;
  savedAt: number | null;
  online: boolean;
  now: number;
  /** Inside the event's window (T-3 days → the day after). Outside it nothing is kept or offered. */
  open: boolean;
  installed: boolean;
  /** The page on screen is the saved copy (saved at this time) — the worker opened it with no signal. */
  onCopy: number | null;
  /** "Update now" — forces a fresh copy of every page. Resolves true only when every page landed. On the saved copy it
   *  loads the page again instead (network-first: the latest with signal, the copy without). */
  update: () => Promise<boolean>;
};

export function useOfflineCopy({
  viewer,
  eventId,
  eventDate,
  eventEndDate = null,
  paths,
  auto = true,
}: {
  viewer: string;
  eventId: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  paths: readonly string[];
  auto?: boolean;
}): OfflineCopy {
  const [phase, setPhase] = useState<SavedPhase>('checking');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [installed, setInstalled] = useState(false);
  const [onCopy, setOnCopy] = useState<number | null>(null);
  const busy = useRef(false);
  const key = paths.join('|');
  const open = offlineSavingOpen(eventDate, now, eventEndDate);

  const save = useCallback(
    async (force: boolean): Promise<boolean> => {
      if (busy.current) return false;
      const until = offlineCopiesUntil(eventDate, eventEndDate);
      if (until === null || !offlineSavingOpen(eventDate, Date.now(), eventEndDate)) return false;
      busy.current = true;
      setPhase('saving');
      try {
        const answer = await askWorker({ type: 'OFFLINE_SAVE', viewer, eventId, until, paths: key.split('|'), force });
        const kept = await readSavedAt(viewer, eventId, key.split('|'));
        setSavedAt(kept);
        setNow(Date.now());
        // 🔑 Only the worker's own "every page landed" is saved. No answer, a refusal, a dev host, a page that failed:
        // failed — the older copy (if any) is named, never presented as fresh.
        const ok = Boolean(answer?.ok) && kept !== null;
        setPhase(ok ? 'saved' : 'failed');
        return ok;
      } finally {
        busy.current = false;
      }
    },
    [viewer, eventId, eventDate, eventEndDate, key],
  );

  useEffect(() => {
    let alive = true;
    setInstalled(runsAsInstalledApp());
    const copyAt = savedCopyOnScreen();
    setOnCopy(copyAt);
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    setOnline(isOnline);
    if (!workerSupported()) {
      setPhase('unsupported');
      return;
    }
    void readSavedAt(viewer, eventId, key.split('|')).then((kept) => {
      if (!alive) return;
      setSavedAt(kept);
      setPhase(kept !== null ? 'saved' : 'none');
      // ALWAYS ON: every open with signal refreshes the copy (the worker skips pages it saved < 30 min ago). Not from
      // the copy itself: it was opened because the network failed — a save now would only fail too.
      if (auto && isOnline && copyAt === null) void save(false);
    });
    const goOnline = () => {
      setOnline(true);
      setNow(Date.now());
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // The age in the mark moves on while the page stays open ("Saved 3 hours ago" turns amber on its own).
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      alive = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(tick);
    };
  }, [viewer, eventId, key, auto, save]);

  const update = useCallback(async () => {
    if (onCopy !== null) {
      window.location.reload();
      return false;
    }
    return save(true);
  }, [save, onCopy]);
  return { phase, savedAt, online, now, open, installed, onCopy, update };
}
