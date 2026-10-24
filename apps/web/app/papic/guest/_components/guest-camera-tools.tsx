'use client';

/**
 * 📷 THE GUEST CAMERA'S VIEWFINDER TOOLS — grid · Selfie ⇄ Main · .5 / 1 / 2×.
 *
 * Owner 2026-10-24 ("Okay build it") on
 * `prototypes/papic_camera_complete_2026-10-24_fable.html`. Drawn exactly there:
 *   · GRID (top-left) — rule-of-thirds lines on/off, remembered on the device;
 *   · FLIP (top-right, only where a second camera exists) — one pill reading
 *     "Selfie Main", the camera in use bright;
 *   · ZOOM (bottom-centre) — `zoomSteps()`: always 1× and 2× (a crop where the
 *     phone has no 2× of its own), 0.5× only on the main camera where an
 *     ultra-wide is reachable. One step per tap.
 *
 * The seat and supplier cameras keep `PapicCameraControls` (flip icon + 0.5/1)
 * — they are different components and this build leaves them as shipped.
 *
 * 👆 Every control presses at ≥ 44 px: the drawings are the prototype's 36 px,
 * and an invisible `after:` halo reaches the floor without growing the drawing.
 *
 * ⚡ NO FLASH, NO TORCH (owner 24 Oct: "ok on no flash"; the 06 Oct ruling).
 */

import { SwitchCamera } from 'lucide-react';
import { cameraInkOn } from '@/lib/camera-look';
import { zoomLabel, type ZoomStep } from '@/lib/papic-camera-steps';

// `min-h-0` drops the global 44-px button floor from the DRAWING (globals.css);
// the halo keeps the PRESS at 44.
const HALO = "relative min-h-0 after:absolute after:-inset-1 after:content-['']";

export function GuestGridLines() {
  return (
    <div aria-hidden data-camera-grid="" className="pointer-events-none absolute inset-0">
      <span className="absolute inset-y-0 left-1/3 w-px bg-cream/55" />
      <span className="absolute inset-y-0 left-2/3 w-px bg-cream/55" />
      <span className="absolute inset-x-0 top-1/3 h-px bg-cream/55" />
      <span className="absolute inset-x-0 top-2/3 h-px bg-cream/55" />
    </div>
  );
}

export function GuestCameraTools({
  grid,
  onGrid,
  canFlip,
  selfie,
  onFlip,
  steps,
  lens,
  onSelectLens,
  disabled = false,
  tint = null,
}: {
  grid: boolean;
  onGrid: () => void;
  canFlip: boolean;
  selfie: boolean;
  onFlip: () => void;
  steps: ZoomStep[];
  lens: number;
  onSelectLens: (step: ZoomStep) => void;
  disabled?: boolean;
  /** Your brand: the chosen zoom step and the grid's "on" wear the theme colour. */
  tint?: string | null;
}) {
  const onStyle = tint ? { backgroundColor: tint, color: cameraInkOn(tint) } : undefined;
  return (
    <>
      <button
        type="button"
        onClick={onGrid}
        aria-label="Grid"
        aria-pressed={grid}
        data-camera-grid-toggle=""
        style={grid ? onStyle : undefined}
        className={`${HALO} absolute left-3 top-3 z-[5] flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition active:scale-95 ${
          grid ? 'bg-cream text-ink' : 'bg-ink/55 text-cream'
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        </svg>
      </button>

      {canFlip ? (
        <button
          type="button"
          onClick={onFlip}
          disabled={disabled}
          aria-label={selfie ? 'Switch to the main camera' : 'Switch to the selfie camera'}
          data-camera-flip={selfie ? 'selfie' : 'main'}
          className={`${HALO} absolute right-3 top-3 z-[5] inline-flex h-9 items-center gap-1.5 rounded-full bg-ink/55 pl-2 pr-2.5 text-[12.5px] text-cream backdrop-blur-sm transition active:scale-95 disabled:opacity-50`}
        >
          <SwitchCamera aria-hidden className="h-4 w-4" strokeWidth={1.8} style={tint ? { color: tint } : undefined} />
          <span className={selfie ? 'font-semibold' : 'font-medium opacity-55'}>Selfie</span>
          <span className={selfie ? 'font-medium opacity-55' : 'font-semibold'}>Main</span>
        </button>
      ) : null}

      <div
        role="group"
        aria-label="Zoom"
        data-camera-zoom={steps.join(',')}
        className="absolute bottom-3 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-ink/55 p-[3px] backdrop-blur-sm"
      >
        {steps.map((step) => {
          const active = step === lens;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onSelectLens(step)}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`${zoomLabel(step)} times zoom`}
              style={active ? onStyle : undefined}
              className={`relative flex h-9 min-h-0 min-w-11 items-center justify-center rounded-full px-2 text-[13px] font-semibold tabular-nums transition after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] disabled:opacity-50 ${
                active ? 'bg-cream text-ink' : 'text-cream/80 active:scale-95'
              }`}
            >
              {zoomLabel(step)}
              <span aria-hidden className="ml-px text-[0.7em]">×</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const FOCUS_KEYFRAMES = `@keyframes papic-focus-in{from{transform:translate(-50%,-50%) scale(1.3)}to{transform:translate(-50%,-50%) scale(1)}}
[data-camera-focus]{animation:papic-focus-in .5s ease}
@media (prefers-reduced-motion: reduce){[data-camera-focus]{animation:none}}`;

/** 🎯 The tap-to-focus square — drawn ONLY where the camera reported it can
 *  focus at a point (`usePapicCamera().canFocus`); a promise nothing keeps is
 *  never drawn. */
export function GuestFocusSquare({ x, y }: { x: number; y: number }) {
  return (
    <>
      <style>{FOCUS_KEYFRAMES}</style>
      <span
        aria-hidden
        data-camera-focus=""
        className="pointer-events-none absolute z-[4] h-[72px] w-[72px] rounded-md border-[1.5px] border-[#ffd978]"
        style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}
      />
    </>
  );
}
