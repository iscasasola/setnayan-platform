'use client';

/**
 * FIND-MY-SEAT — scan a guest's card, get their table.
 *
 * Reuses the shipped scanner machinery rather than adding any: `makeQrDetector`
 * (lib/qr-scan.ts — native BarcodeDetector, falling back to jsqr) and
 * `parsePapicTagScan` via `classifyScan`. The camera lifecycle (copied from
 * `patiktok/_components/tag-sheet.tsx`, with the iOS one-camera-at-a-time
 * contract) now lives in `lib/use-live-qr-scan.ts`, shared with the guest
 * door's "Scan QR" (2026-11-03).
 *
 * ALL authorisation is server-side in `coordinator_seat_by_guest_qr` — booked +
 * coordinator tile + the host having SHARED the seat plan + a PUBLISHED plan.
 * This component only asks. It never learns a name: the answer is one table
 * label, and nothing else crosses the wire.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, MapPin, ScanLine } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

import { classifyScan, resolveSeatScan, type SeatScanOutcome } from '@/lib/floor-command';
import { floorSeatByQr } from './actions';
import { useLiveQrScan } from '@/lib/use-live-qr-scan';

export function SeatScanner({
  eventId,
  via = 'floor',
}: {
  eventId: string;
  /**
   * 📱 Whose door asks (owner 2026-10-29, crew passes): `floor` — the booked coordinator, through
   * `coordinator_seat_by_guest_qr`; `crew` — a crew phone the shop Allowed, through `crew_seat_by_guest_qr`, which asks
   * the SAME gates of the shop plus an allowed, unexpired pass. Same scanner, same one-label answer.
   */
  via?: 'floor' | 'crew';
}) {
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SeatScanOutcome | null>(null);
  // Set right below: the camera half is shared (`lib/use-live-qr-scan.ts`) and `handle` needs its `stop`.
  const stopRef = useRef<() => void>(() => undefined);

  const handle = useCallback(
    async (raw: string) => {
      const scan = classifyScan(raw);
      if (scan.kind === 'unreadable') return; // keep looking; not every frame is a code
      stopRef.current();
      setBusy(true);
      setLookupError(null);
      try {
        if (scan.kind === 'table') {
          setOutcome(resolveSeatScan(scan, null));
          return;
        }
        // 📶 NO SIGNAL (EV3): finding a seat asks Setnayan — the host shares one table label per scan, never the list —
        // so with no signal it says so instead of failing as if the code were wrong. Nothing is queued: it is a question,
        // not a change to send later.
        let res: Awaited<ReturnType<typeof floorSeatByQr>>;
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
          res = await floorSeatByQr(eventId, scan.token, via);
        } catch {
          setLookupError('No signal — finding a seat needs signal. The printed seat chart has every table.');
          setOutcome(null);
          return;
        }
        if (!res.ok) {
          setLookupError(res.error);
          setOutcome(null);
          return;
        }
        setOutcome(
          resolveSeatScan(scan, { found: res.found, tableLabel: res.tableLabel }),
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId, via],
  );

  // 📷 THE CAMERA HALF IS SHARED (2026-11-03) with the guest door's "Scan QR": stream before the <video>, released
  // on unmount (iOS: one camera at a time), and it comes back when iOS or a Duo takes it — `lib/use-live-qr-scan.ts`.
  const { scanning, cameraError, videoRef, start: openCamera, stop } = useLiveQrScan(handle);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  const start = useCallback(async () => {
    setLookupError(null);
    setOutcome(null);
    await openCamera();
  }, [openCamera]);

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <ScanLine aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
        Find a guest’s seat
      </h4>

      {scanning ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full rounded-lg bg-ink object-cover"
          />
          <ActionButton tone="neutral" icon={CameraOff} label="Stop" onClick={stop} />
        </div>
      ) : (
        <ActionButton
          tone="brand"
          icon={Camera}
          label="Scan a guest’s card"
          onClick={() => void start()}
          waiting={busy}
          className="w-full"
        />
      )}

      {cameraError ? (
        <p role="alert" className="text-sm font-semibold text-warn-700">
          {cameraError}
        </p>
      ) : null}
      {lookupError ? (
        <p role="alert" className="text-sm font-semibold text-warn-700">
          {lookupError}
        </p>
      ) : null}

      {outcome ? <Answer outcome={outcome} /> : null}
    </section>
  );
}

/**
 * The five answers, each pointing at the person who can fix it. "Not on this
 * event" and "no seat yet" look similar and are not: one is the couple's
 * problem, the other the seating plan's.
 */
function Answer({ outcome }: { outcome: SeatScanOutcome }) {
  if (outcome.kind === 'seated') {
    return (
      <p
        aria-live="polite"
        className="flex min-h-14 items-center gap-2 py-2"
      >
        <MapPin aria-hidden className="h-5 w-5 shrink-0 text-success-700" strokeWidth={1.75} />
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">Seated at</span>
          <span className="block text-lg font-semibold text-ink">{outcome.tableLabel}</span>
        </span>
      </p>
    );
  }

  const copy: Record<Exclude<SeatScanOutcome['kind'], 'seated'>, string> = {
    unseated: 'They’re on the guest list but haven’t been given a table yet — the couple’s seating plan is where that gets fixed.',
    not_this_event: 'That card isn’t for this event. Worth checking with the couple.',
    table_sign: 'That’s a table sign, not a guest card. Scan the card the guest is carrying.',
    unreadable: 'Couldn’t read that code.',
  };

  return (
    <p aria-live="polite" className="py-2 text-sm text-ink">
      {copy[outcome.kind]}
    </p>
  );
}
