'use client';

import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { FADE_INFO, fadeAtPointer, fadeClamp, fadeFlipsWords, fadeKey, fadePercent, fadeSettled, fadeWords } from '@/lib/background-fade';
import { STUDIO_ROW } from '@/lib/studio-skin';

/**
 * 🎚 THE FADE BAR — black ← as is → white, on one line (owner 2026-10-08, DECISION_LOG "LOOK › BACKGROUND, AMENDED":
 * *"a line bar where it can fade to white or fade to black … snap to center"*; approved prototype frames A04–A06).
 *
 *   Fade ⓘ ……………………………… Lighter 60%  [↶ As is]
 *   ●━━━━━━━━━━━━┃━━━━━━━◯━━━━○
 *
 * A slider, because the value is continuous (a set of words would be a dropdown). Its thumb is a 44-px target
 * around a 28-px circle; the circle's ring turns terracotta when it sits on the centre.
 *
 * ⚡ WHAT A DRAG COSTS: nothing until it ends. While the thumb moves, every position is handed to `onMove` — the
 * panel shows it on the sample screen, in the browser. The ONE write is `onCommit`, called once when the finger
 * lifts (or a key is released), with the position the release settles on (within ±8 of the centre it IS the
 * centre). A release back on the value it started from writes nothing. No timer, no write per frame.
 *
 * Double-tap, or "As is", returns to the centre. ← → move one step, Page Up / Down ten, Home / End the ends.
 */
const LINE_PAD = 22; // the thumb's half-width: the line's ends sit under the thumb's centre at −100 and +100

export function BgFadeBar({
  value,
  onMove,
  onCommit,
  disabled = false,
}: {
  /** The position the stored background reads at, −100…100 (0 = as is). */
  value: number;
  /** The thumb is at `at` — show it (the sample screen); nothing is saved. */
  onMove: (at: number) => void;
  /** The drag ended on `at` (already settled): save it. Called once per drag, and only when `at` differs from `value`. */
  onCommit: (at: number) => void;
  disabled?: boolean;
}) {
  /** The position while a drag or a held key is under way; null = the stored value shows. */
  const [live, setLive] = useState<number | null>(null);
  const liveRef = useRef<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  /* The stored value moved (the save landed, Undo, a refusal) — the bar follows it. */
  useEffect(() => {
    if (!dragging.current) {
      liveRef.current = null;
      setLive(null);
    }
  }, [value]);
  const at = live ?? fadeClamp(value);

  const move = (next: number) => {
    if (next === liveRef.current) return;
    liveRef.current = next;
    setLive(next);
    onMove(next);
  };
  /** The drag is over: settle (the snap), show where it settled, and save — once, if anything changed. */
  const end = () => {
    if (liveRef.current === null) return;
    const settled = fadeSettled(liveRef.current);
    dragging.current = false;
    liveRef.current = settled;
    setLive(settled);
    onMove(settled);
    if (settled !== fadeClamp(value)) onCommit(settled);
    else {
      liveRef.current = null;
      setLive(null);
    }
  };
  const pointerAt = (clientX: number): number => {
    const box = track.current?.getBoundingClientRect();
    return box ? fadeAtPointer(clientX, box.left, box.width, LINE_PAD) : at;
  };
  const toCentre = () => {
    if (disabled || at === 0) return;
    liveRef.current = 0;
    setLive(0);
    onMove(0);
    if (fadeClamp(value) !== 0) onCommit(0);
  };

  return (
    <div data-bg-fade={at} className="flex flex-col border-t border-ink/10 pb-1 pt-1.5 first:border-t-0">
      <div className={`${STUDIO_ROW} !border-t-0 !py-0 justify-between`}>
        <span className="flex shrink-0 items-center text-[14px] text-ink">
          <InfoTip label="Fade" align="start">
            {FADE_INFO}
          </InfoTip>
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span data-bg-fade-words="" aria-live="polite" className={`truncate text-[13px] font-semibold ${fadeFlipsWords(at) ? 'text-ink/70' : 'text-ink'}`}>
            {fadeWords(at)}
          </span>
          {at !== 0 ? (
            <button
              type="button"
              data-bg-fade-as-is=""
              disabled={disabled}
              onClick={toCentre}
              className="sn-press relative inline-flex h-8 min-h-0 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-semibold text-ink ring-1 ring-ink/15 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] disabled:opacity-40"
            >
              <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              As is
            </button>
          ) : null}
        </span>
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Fade"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={at}
        aria-valuetext={fadeWords(at)}
        aria-disabled={disabled || undefined}
        data-bg-fade-track=""
        className="relative flex h-11 touch-none select-none items-center outline-none focus-visible:ring-2 focus-visible:ring-mulberry/60 focus-visible:ring-offset-2"
        onPointerDown={(e) => {
          if (disabled) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          move(pointerAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) move(pointerAt(e.clientX));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={toCentre}
        onKeyDown={(e) => {
          if (disabled) return;
          const next = fadeKey(e.key, at);
          if (next === null) return;
          e.preventDefault();
          dragging.current = true;
          move(next);
        }}
        /* A held arrow moves the thumb many times and saves ONCE — when the key is let go (the keyboard's "release"). No snap:
           a key lands exactly where it was pressed to. */
        onKeyUp={(e) => {
          if (fadeKey(e.key, 0) === null || liveRef.current === null) return;
          dragging.current = false;
          const landed = liveRef.current;
          if (landed !== fadeClamp(value)) onCommit(landed);
          else {
            liveRef.current = null;
            setLive(null);
          }
        }}
        onBlur={() => {
          if (dragging.current) end();
        }}
      >
        {/* The line: black at the left, the picture's own middle, white at the right. */}
        <span aria-hidden className="absolute inset-x-[14px] h-1.5 rounded-full bg-[linear-gradient(90deg,#141210_0%,#8e8880_50%,#ffffff_100%)] ring-1 ring-black/10" />
        <span aria-hidden data-bg-fade-centre="" className="absolute left-1/2 top-1.5 bottom-1.5 w-0.5 -translate-x-1/2 rounded-full bg-ink/70" />
        <span aria-hidden className="absolute left-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#141210] ring-1 ring-black/20" />
        <span aria-hidden className="absolute right-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/20" />
        {/* The thumb: a 44-px target around the 28-px circle, riding the line between its two ends. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[22px] inset-y-0">
          <span
            data-bg-fade-thumb={at === 0 ? 'centre' : ''}
            className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${fadePercent(at)}%` }}
          >
            <i className={`block h-7 w-7 rounded-full border-2 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${at === 0 ? 'border-terracotta-700' : 'border-ink'}`} />
          </span>
        </span>
      </div>
    </div>
  );
}
