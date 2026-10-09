'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image as ImageIcon, Trophy, X } from 'lucide-react';
import { cameraLookTint, type CameraLook } from '@/lib/camera-look';
import { FocusCorners } from '@/app/papic/guest/_components/camera-focus-corners';
import { useMaker } from '../maker-context';

/**
 * 🖼 THE CAMERA'S SCREEN, DRAWN — the camera's own pieces in one of its three looks, for the Maker (owner
 * 2026-10-06, "THE CAMERA HAS ITS OWN THREE LAYOUTS"; 2026-10-09: *"Camera is a full screen design"*).
 *
 * The shipped focus corners (`camera-focus-corners.tsx`, the very component the guest camera draws) in that look's
 * tint (`cameraLookTint`, the theme's accent read off the canvas), the white shutter — with the event's own logo,
 * copied from the canvas, for Your brand — and, for Challenges, the chips row above it. ONE drawing at two sizes:
 * small, filling a look card (`camera-look.tsx`); and at the screen's size, as the Camera's page (`camera-page.tsx`).
 * A drawing only: the live camera is never opened in the Maker (`the-maker-canvas-draws-no-camera.test.ts`).
 *
 * It also holds THE LOOK ON SCREEN — one value for the cards and the page (`useCameraLookShown`).
 * No server action here: the cards' save is `camera-look.tsx`'s.
 */

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** `r g b` → `#rrggbb`, or null. */
function hexOf(channels: string): string | null {
  const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(channels);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/** The event's logo and theme accent, read off the canvas the couple is looking at (again when `again` moves — a canvas that reloaded). */
export function useCanvasBrand(again: unknown = null): { logo: string | null; accent: string | null } {
  const [got, setGot] = useState<{ logo: string | null; accent: string | null }>({ logo: null, accent: null });
  useEffect(() => {
    try {
      const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
      if (!doc?.body) return;
      const mark = doc.querySelector<HTMLElement>('[data-el="mark"]');
      const svg = mark?.querySelector('svg, img');
      const scope = doc.querySelector<HTMLElement>('[data-guest-look]') ?? doc.body;
      const accent = hexOf(getComputedStyle(scope).getPropertyValue('--color-terracotta'));
      const logo = svg ? svg.outerHTML : null;
      setGot((was) => (was.logo === logo && was.accent === accent ? was : { logo, accent }));
    } catch {
      /* a canvas we cannot read: the looks draw without the logo, in white */
    }
  }, [again]);
  return got;
}

/* ── THE LOOK ON SCREEN — ONE VALUE for the cards and the Camera's page: the saved look, with a pick laid over it
      the moment it is tapped (the save runs behind it; a refused save takes the pick back). ── */
let pickedLook: CameraLook | null = null;
const lookSubs = new Set<() => void>();
const subscribeLook = (f: () => void) => {
  lookSubs.add(f);
  return () => {
    lookSubs.delete(f);
  };
};
export function setPickedLook(look: CameraLook | null): void {
  if (look === pickedLook) return;
  pickedLook = look;
  lookSubs.forEach((f) => f());
}
/** The Camera's look as it is drawn NOW (the pick shown at once; else what the last render saved). */
export function useCameraLookShown(): CameraLook {
  const saved = useMaker()?.lookPages?.camera?.look ?? 'classic';
  const picked = useSyncExternalStore<CameraLook | null>(subscribeLook, () => pickedLook, () => null);
  return picked ?? saved;
}

/**
 * The camera's screen in one look. `screen`: the whole screen, at a phone's size (the Camera's page) — the guest
 * camera's own measures (`papic-guest-capture.tsx`: ✕ in a 44 px circle top-left, the corners 28 px inset 32 px, their
 * shots' square beside a 72 px shutter). Without it: the same pieces small, filling a look card.
 */
export function CameraLookFace({ look, logo, accent, screen = false }: { look: CameraLook; logo: string | null; accent: string | null; screen?: boolean }) {
  const tint = cameraLookTint(look, accent);
  if (screen) {
    return (
      <span aria-hidden data-camera-look-face={look} data-camera-look-screen="" className="absolute inset-0 block overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#5a5160,#2a2530_75%)]">
        <span className="absolute left-4 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <X className="h-5 w-5 text-white" strokeWidth={2} />
        </span>
        <FocusCorners tint={tint} inset="inset-x-8 top-[72px] bottom-[150px]" />
        {look === 'challenges' ? (
          <span data-camera-look-chips="" className="absolute inset-x-4 bottom-[112px] flex gap-2 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3">
                <Trophy className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                <span className="block h-[5px] w-16 rounded-full bg-white/60" />
              </span>
            ))}
          </span>
        ) : null}
        <span className="absolute bottom-7 left-6 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white/70 bg-white/10">
          <ImageIcon className="h-5 w-5 text-white/70" strokeWidth={1.75} />
        </span>
        <span data-camera-look-shutter="" className="absolute bottom-4 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-white p-1">
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
            {look === 'brand' && logo ? (
              // The event's own logo, as the canvas drew it (an SVG or image the page already serves).
              <span data-camera-look-logo="" className="block h-12 w-12 [&>*]:h-full [&>*]:w-full" dangerouslySetInnerHTML={{ __html: logo }} />
            ) : null}
          </span>
        </span>
      </span>
    );
  }
  return (
    /* The camera screen FILLS the card's picture: the whole camera, small. */
    <span aria-hidden data-camera-look-face={look} className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#5a5160,#2a2530_75%)]">
      <FocusCorners tint={tint} inset="inset-x-2.5 top-2.5 bottom-[52px]" size="h-3 w-3" />
      {look === 'challenges' ? (
        <span className="absolute inset-x-1.5 bottom-[38px] flex gap-1 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <span key={i} className="inline-flex h-[14px] shrink-0 items-center gap-0.5 rounded-full bg-white/15 px-1.5">
              <Trophy className="h-2 w-2 text-white" strokeWidth={2.4} />
              <span className="block h-[3px] w-6 rounded-full bg-white/60" />
            </span>
          ))}
        </span>
      ) : null}
      <span className="absolute bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white p-[1.5px]">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
          {look === 'brand' && logo ? (
            // The event's own logo, as the canvas drew it (an SVG or image the page already serves).
            <span className="block h-[18px] w-[18px] [&>*]:h-full [&>*]:w-full" dangerouslySetInnerHTML={{ __html: logo }} />
          ) : null}
        </span>
      </span>
    </span>
  );
}
