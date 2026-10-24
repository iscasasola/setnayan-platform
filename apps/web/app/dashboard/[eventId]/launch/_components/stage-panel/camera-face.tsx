'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Camera, Image as ImageIcon, ScanLine, SwitchCamera, X } from 'lucide-react';
import { cameraDressTint, cameraInkOn } from '@/lib/camera-dress';
import { FocusCorners } from '@/app/papic/guest/_components/camera-focus-corners';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * 🖼 THE CAMERA'S SCREEN, DRAWN — the ONE guest camera, for the Maker's Camera page (owner 2026-10-24, verbatim:
 * *"place this as a style template for the camera. remove the other style template"* · final: *"Free: plain camera
 * with a small Setnayan mark on saved photos. Pro: their logo on the shutter, theme colours, and their monogram on
 * saved photos. No frames."*). Drawn from the approved prototype `papic_camera_complete_2026-10-24_fable.html`,
 * state "Photo": ✕ · the status and credits chips · grid · Selfie Main · .5 1 2× · the four corners · Photo | Snippet ·
 * the thumbnail · the shutter · Tag who's in it · the one-line share row.
 *
 * There is no look to pick any more (the three of 06 Oct are gone). `pro` — the event's Logo & QR part or Full Pro,
 * as the Maker is shown it — dresses it: the theme's colour on the corners and the chosen zoom step
 * (`cameraDressTint`), and the event's logo on a white shutter. Free: white corners, the plain shutter.
 *
 * A drawing only: the live camera is never opened in the Maker (`the-maker-canvas-draws-no-camera.test.ts`).
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
      /* a canvas we cannot read: the camera draws without the logo, in white */
    }
  }, [again]);
  return got;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/12 px-2.5 text-[12px] font-medium text-white">
      {children}
    </span>
  );
}

function InfoDot() {
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-white/55 text-[10.5px] font-semibold text-white/85">i</span>
  );
}

/** The camera's whole screen, at the size of the Camera page it fills. */
export function CameraFace({ pro, logo, accent }: { pro: boolean; logo: string | null; accent: string | null }) {
  const tint = cameraDressTint(pro, accent);
  const dressed = pro && Boolean(logo);
  return (
    <span aria-hidden data-camera-face={pro ? 'pro' : 'free'} data-camera-face-screen="" className="absolute inset-0 flex flex-col overflow-hidden bg-[#1f1d1a] text-white">
      {/* ✕ · the status chip · the credits chip */}
      <span className="flex h-[60px] shrink-0 items-center justify-between gap-2 px-3.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
          <X className="h-[18px] w-[18px] text-white" strokeWidth={2} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Chip>
            <span className="h-2 w-2 rounded-full border-2 border-white" />
            Ready
            <InfoDot />
          </Chip>
          <Chip>
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
            150 credits left
          </Chip>
        </span>
      </span>
      {/* The viewfinder: the four corners, grid · Selfie Main · .5 1 2× */}
      <span className="relative block min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_40%,#5a5160,#2a2530_75%)]">
        <FocusCorners tint={tint} inset="inset-x-8 top-[56px] bottom-[60px]" />
        <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
        </span>
        <span className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/45 pl-2 pr-2.5 text-[12.5px]">
          <SwitchCamera className="h-4 w-4" strokeWidth={1.8} style={pro ? { color: tint } : undefined} />
          <span className="font-medium opacity-55">Selfie</span>
          <span className="font-semibold">Main</span>
        </span>
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/45 p-[3px]">
          {(['.5', '1', '2'] as const).map((z) => (
            <span
              key={z}
              className={`flex h-9 min-w-11 items-center justify-center rounded-full px-2 text-[13px] font-semibold tabular-nums ${z === '1' ? '' : 'text-white/80'}`}
              style={z === '1' ? { backgroundColor: tint, color: cameraInkOn(tint) } : undefined}
            >
              {z}
              <span className="ml-px text-[0.7em]">×</span>
            </span>
          ))}
        </span>
      </span>
      {/* The lower third: Photo | Snippet · thumbnail · shutter · Tag who's in it · the share line */}
      <span className="flex shrink-0 flex-col gap-2 px-4 pb-4 pt-2.5">
        <span className="flex justify-end">
          <span className="flex gap-0.5 rounded-full bg-white/12 p-[3px] text-[12.5px] font-semibold">
            <span className="rounded-full bg-[#f5f0e8] px-3 py-1.5 text-[#1f1d1a]">Photo</span>
            <span className="px-3 py-1.5 text-white/75">Snippet</span>
          </span>
        </span>
        <span className="relative flex h-[84px] items-center justify-center">
          <span className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-white/70 bg-white/10">
            <ImageIcon className="h-5 w-5 text-white/70" strokeWidth={1.75} />
          </span>
          {dressed ? (
            <span data-camera-face-shutter="logo" className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white p-1">
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                {/* The event's own logo, as the canvas drew it (an SVG or image the page already serves). */}
                <span data-camera-face-logo="" className="block h-12 w-12 [&>*]:h-full [&>*]:w-full" dangerouslySetInnerHTML={{ __html: logo as string }} />
              </span>
            </span>
          ) : (
            <span data-camera-face-shutter="plain" className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/85 bg-white/10">
              <Camera className="h-7 w-7 text-white" strokeWidth={1.75} />
            </span>
          )}
          <span className="absolute right-0 top-1/2 flex w-16 -translate-y-1/2 flex-col items-center gap-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12">
              <ScanLine className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-center text-[10px] font-medium leading-tight text-white/85">Tag who’s in it</span>
          </span>
        </span>
        <span className="text-center text-[12px] text-white/60">Tap for a photo · press and hold to record (up to 10s).</span>
        <span /* no-card-ok: a drawing of the camera's share toggle — a pressable line on the real camera */ className="flex h-10 items-center gap-2.5 rounded-xl border border-white/15 px-2.5 text-[12.5px]">
          <span className="h-[18px] w-[18px] shrink-0 rounded border-[1.5px] border-white/75" />
          <span className="min-w-0 flex-1 truncate">Let the host feature my clips on their event page</span>
          <InfoDot />
        </span>
      </span>
    </span>
  );
}

/**
 * 📷 THE CAMERA PART'S ROWS — no tool left to set (owner 2026-10-24: one camera, no style to pick). The part keeps its
 * one live tool so a tap on it still says what it is: one line, the detail in the ⓘ (owner 23 Oct, "details go
 * inside the ⓘ"). Nothing here saves anything.
 */
export function CameraPartNote({ pro }: { pro: boolean }) {
  return (
    <div data-camera-part-note="" className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-1 py-2 text-[13px] text-ink/75">
      <InfoTip label="One camera for every guest" labelClassName="font-semibold text-ink" align="start">
        Every guest gets the same camera. Free events: a plain camera, and a small Setnayan mark on the saved photos. With
        Logo &amp; QR or Full Pro: your logo on the shutter, your colours, and your monogram on the saved photos.
      </InfoTip>
      <p className="text-[12.5px] text-ink/60">{pro ? 'Wearing your logo and colours.' : 'Plain — your logo and colours come with Logo & QR.'}</p>
    </div>
  );
}
