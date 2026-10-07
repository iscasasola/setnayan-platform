'use client';

import { SwitchCamera } from 'lucide-react';
import type { LensFactor } from '@/lib/use-papic-camera';
import { cameraInkOn } from '@/lib/camera-look';

// Papic · on-viewfinder camera controls (shared by seat + guest capture)
//
// Absolutely positioned over a `relative` viewfinder: a flip button (top-right)
// and the lens toggle (bottom-centre). Both are GATED — the flip button only
// shows when a second camera is enumerable, and the lens pills only when the
// active facing genuinely exposes a 0.5× lens (zoom-capable track or a distinct
// ultra-wide device). So a surface that can't honour a control never shows it.

type Props = {
  canFlip: boolean;
  onFlip: () => void;
  lensOptions: LensFactor[];
  lens: LensFactor;
  onSelectLens: (factor: LensFactor) => void;
  /** Re-acquiring (flip / lens swap) or camera not ready → freeze the controls. */
  disabled?: boolean;
  /**
   * 🎛 THE CAMERA'S "YOUR BRAND" LOOK (owner 2026-10-06): the pills in the
   * theme's colour — the chosen lens pill filled with it, the flip icon drawn in
   * it. Absent (Classic, Challenges, and every camera before the looks) = the
   * neutral pills, exactly as shipped.
   */
  tint?: string | null;
};

function lensLabel(factor: LensFactor): string {
  return factor === 0.5 ? '.5' : '1';
}

export function PapicCameraControls({
  canFlip,
  onFlip,
  lensOptions,
  lens,
  onSelectLens,
  disabled = false,
  tint = null,
}: Props) {
  const showLens = lensOptions.length > 1;

  return (
    <>
      {canFlip && (
        <button
          type="button"
          onClick={onFlip}
          disabled={disabled}
          aria-label="Flip camera"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/55 text-cream backdrop-blur-sm transition active:scale-95 disabled:opacity-50"
        >
          <SwitchCamera aria-hidden className="h-5 w-5" strokeWidth={1.75} style={tint ? { color: tint } : undefined} />
        </button>
      )}

      {showLens && (
        <div
          role="group"
          aria-label="Lens"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/55 p-1 backdrop-blur-sm"
        >
          {lensOptions.map((factor) => {
            const active = factor === lens;
            return (
              <button
                key={factor}
                type="button"
                onClick={() => onSelectLens(factor)}
                disabled={disabled}
                aria-pressed={active}
                aria-label={`${lensLabel(factor)} times zoom`}
                style={active && tint ? { backgroundColor: tint, color: cameraInkOn(tint) } : undefined}
                className={[
                  'flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-semibold tabular-nums transition disabled:opacity-50',
                  active
                    ? 'bg-cream text-ink'
                    : 'text-cream/80 hover:text-cream active:scale-95',
                ].join(' ')}
              >
                {lensLabel(factor)}
                <span aria-hidden className="text-[0.7em]">×</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
