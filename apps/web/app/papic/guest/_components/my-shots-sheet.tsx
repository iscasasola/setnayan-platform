'use client';

/**
 * 🖼 MY SHOTS — this phone's shots, as a sheet OVER the camera.
 *
 * Owner 2026-10-24 ("Okay build it", prototype
 * `papic_camera_complete_2026-10-24_fable.html`, state 7; the owner's pick 3:
 * "this phone's shots only, as a sheet over the camera (not a new page)").
 * The thumbnail beside the shutter used to LEAVE the camera for the Event Hub's
 * Memories; it now opens this, in place — no navigation. ✕, Esc or a swipe
 * down brings the live viewfinder back.
 *
 * What it lists: the shots taken on this camera this visit (newest first, a
 * clip with its length, a shot still on the phone marked "waiting"), then the
 * guest's earlier shots already in this event's Memories (server-read). Not
 * "Photos of you" — the owner chose this phone's shots only.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { usePapicUploads } from '@/app/papic/_components/upload-chip';
import { formatCount } from '@/lib/format-number';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { UploaderSnapshot } from '@/lib/papic-upload/replayer';

export type MyShot = {
  id: string;
  url: string;
  media: 'photo' | 'clip';
  durationMs?: number | null;
  /** Still on this phone, not yet in the event's Memories. */
  waiting?: boolean;
};

/** This event's guest shots still on the phone, not yet recorded by the event. */
function unsentIds(snap: UploaderSnapshot | null, eventId: string): Set<string> {
  return new Set(
    (snap?.shots ?? [])
      .filter((q) => q.lane === 'guest' && q.eventId === eventId && !q.settled.record)
      .map((q) => q.id),
  );
}

/** The chip states in which a shot is STUCK on the phone (not merely mid-send). */
const STUCK = new Set(['offline', 'credits', 'kept', 'memory']);

/**
 * The count on the thumbnail — shots kept on this phone while they cannot
 * send (offline, credits ran out, kept). Its own component, so the uploader's
 * progress re-renders this badge and not the whole camera.
 */
export function MyShotsWaitingBadge({ eventId }: { eventId: string }) {
  const snap = usePapicUploads();
  const n = snap && STUCK.has(snap.chip.kind) ? unsentIds(snap, eventId).size : 0;
  if (n === 0) return null;
  return (
    <span
      data-camera-thumb-waiting=""
      className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terracotta-700 px-[5px] text-[10px] font-semibold text-cream"
    >
      {formatCount(n)}
    </span>
  );
}

function clipLength(ms: number | null | undefined): string {
  const s = Math.max(1, Math.round((ms ?? 0) / 1000));
  return `0:${String(s).padStart(2, '0')}`;
}

export function MyShotsSheet({
  open,
  onClose,
  shots: given,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  shots: MyShot[];
  eventId: string;
}) {
  const snap = usePapicUploads();
  const waiting = unsentIds(snap, eventId);
  const shots = given.map((s) => (waiting.has(s.id) ? { ...s, waiting: true } : s));
  const [viewing, setViewing] = useState<MyShot | null>(null);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The house modal: focus in (on ✕), Tab held inside, Esc closes, focus handed back, the page behind held still.
  useModalA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: closeRef });

  useEffect(() => {
    if (open) return;
    setViewing(null);
    setDrag(0);
  }, [open]);

  const n = shots.length;
  return (
    <div
      data-my-shots={open ? 'open' : 'closed'}
      // Closed = not focusable and not read, once the slide-out has finished.
      className={open ? 'visible' : 'pointer-events-none invisible'}
      style={{ transition: `visibility 0s linear ${open ? 0 : 300}ms` }}
    >
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[45] bg-black/45 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="My shots"
        // Full width: the house rule pads it by the left and right safe areas (globals.css `[data-safe-x]`).
        data-safe-x=""
        className="fixed inset-x-0 bottom-0 z-[46] flex h-[72%] flex-col rounded-t-2xl bg-[#1f1d1a] text-cream"
        style={{
          transform: open ? `translateY(${drag}px)` : 'translateY(100%)',
          transition: startY.current === null ? 'transform 300ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      >
        {/* The grab and the header take a swipe down. */}
        <div
          className="touch-none"
          onPointerDown={(e) => {
            startY.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={() => {
            const d = drag;
            startY.current = null;
            setDrag(0);
            if (d > 80) onClose();
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDrag(0);
          }}
        >
          <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-10 rounded-full bg-cream/30" />
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1">
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-medium leading-tight">My shots</h2>
              <InfoTip
                label={`${formatCount(n)} from this phone · in this event’s Memories`}
                labelClassName="truncate"
                className="mt-0.5 max-w-full text-xs text-cream/60 [&_button]:border-cream/50 [&_button]:text-cream/80"
                align="start"
              >
                Everything this phone shot for this event, from its Memories. Shots still waiting to send
                are marked. Tap one to see it bigger; ✕ or swipe down brings the camera back.
              </InfoTip>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Back to the camera"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream/10 text-cream"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {n === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-cream/60">Your shots land here as you take them.</p>
        ) : (
          <ul className="grid flex-1 grid-cols-3 content-start gap-0.5 overflow-y-auto pb-5" aria-label="Shots">
            {shots.map((s, i) => (
              <li key={s.id} className="aspect-square">
                <button
                  type="button"
                  onClick={() => setViewing(s)}
                  aria-label={`${s.media === 'clip' ? 'Clip' : 'Photo'} ${i + 1}${s.waiting ? ', waiting to send' : ''}`}
                  className="relative block h-full w-full overflow-hidden bg-[#2a201b]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {s.media === 'clip' ? (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/50 px-1.5 py-px text-[10px] font-semibold">
                      {clipLength(s.durationMs)}
                    </span>
                  ) : null}
                  {s.waiting ? (
                    <span className="absolute inset-x-0 bottom-0 bg-terracotta-700/90 py-0.5 text-center text-[9.5px]">
                      waiting
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {viewing ? (
          <div className="absolute inset-0 z-10 flex flex-col rounded-t-2xl bg-[#1f1d1a]">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Back to my shots"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-cream"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewing.url} alt="" className="min-h-0 flex-1 object-contain px-2 pb-6" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
