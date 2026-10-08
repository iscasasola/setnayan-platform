'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { CAMERA_LOOKS, CAMERA_LOOK_LABEL, CAMERA_LOOK_PREF_KEY, cameraLookTint, type CameraLook } from '@/lib/camera-look';
import { SP_LOOK_CARD, SP_LOOK_NAME, SP_PHONE_PICTURE } from '@/lib/maker-stage-room';
import { makerSave } from '@/lib/maker-refresh';
import { FocusCorners } from '@/app/papic/guest/_components/camera-focus-corners';
import { hubDraftAction } from '../../../website/hub-draft-actions';
import { useMaker } from '../maker-context';
import { StageStyle } from './stage-style';

/**
 * 🎛 THE CAMERA PART'S STYLE › LOOK — Classic · Your brand · Challenges (owner
 * 2026-10-06, DECISION_LOG "THE CAMERA HAS ITS OWN THREE LAYOUTS"; 2026-10-07 "THREE
 * FOLLOW-UPS AS ONE STEP": *"the Camera part's three looks … saved through the hub
 * draft"*).
 *
 * The pick is `events.style_preferences.camera_look` (`lib/camera-look.ts`), which the
 * guest camera already reads (`app/papic/guest/page.tsx`). Here it goes into the DRAFT
 * (`hubDraftAction` intent=save, `{ events: { style_preferences: { camera_look } } }` —
 * the draft keeps it beside a drafted QR look, never over it, `lib/hub-draft.ts`),
 * is counted on ✓ and written by Apply. Free — a style pick.
 *
 * 🖼 EACH CARD IS THE CAMERA'S OWN PIECES: the shipped focus corners
 * (`camera-focus-corners.tsx`, the very component the guest camera draws) in that
 * look's tint (`cameraLookTint`, the theme's accent read off the canvas), the white
 * shutter — with the event's own logo, copied from the canvas, for Your brand — and,
 * for Challenges, the chips row above it. The live camera is never opened in the
 * Maker (`the-maker-canvas-draws-no-camera.test.ts`).
 */

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** `r g b` → `#rrggbb`, or null. */
function hexOf(channels: string): string | null {
  const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(channels);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/** The event's logo and theme accent, read off the canvas the couple is looking at. */
function useCanvasBrand(): { logo: string | null; accent: string | null } {
  const [got, setGot] = useState<{ logo: string | null; accent: string | null }>({ logo: null, accent: null });
  useEffect(() => {
    try {
      const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
      if (!doc?.body) return;
      const mark = doc.querySelector<HTMLElement>('[data-el="mark"]');
      const svg = mark?.querySelector('svg, img');
      const scope = doc.querySelector<HTMLElement>('[data-guest-look]') ?? doc.body;
      const accent = hexOf(getComputedStyle(scope).getPropertyValue('--color-terracotta'));
      setGot({ logo: svg ? svg.outerHTML : null, accent });
    } catch {
      /* a canvas we cannot read: the looks draw without the logo, in white */
    }
  }, []);
  return got;
}

function CameraLookFace({ look, logo, accent }: { look: CameraLook; logo: string | null; accent: string | null }) {
  const tint = cameraLookTint(look, accent);
  return (
    /* The camera screen FILLS the phone-shaped frame (`.sn-phone-card`, 3 : 4 — owner 2026-10-08): the whole camera, small. */
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

export function CameraPartTools() {
  const maker = useMaker();
  const router = useRouter();
  const saved = maker?.lookPages?.camera?.look ?? 'classic';
  const eventId = maker?.eventId ?? null;
  const [shown, setShown] = useState<CameraLook>(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setShown(saved), [saved]);
  const brand = useCanvasBrand();
  const car = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = car.current;
    const on = c?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (c && on) c.scrollLeft = on.offsetLeft - (c.clientWidth - on.offsetWidth) / 2;
  }, [shown]);

  const pick = (look: CameraLook) => {
    if (!eventId || pending || look === shown) return;
    const was = shown;
    setShown(look);
    setError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { style_preferences: { [CAMERA_LOOK_PREF_KEY]: look } } }));
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          setShown(was);
          setError(r.error);
        }
      } catch {
        setShown(was);
        setError('That change could not be saved. Please try again — nothing was lost.');
      }
    });
  };

  return (
    <div className="-mx-[10px] mt-2 flex min-h-0 flex-1 flex-col" data-camera-part-tools="">
      <StageStyle
        look={
          <>
            <div
              ref={car}
              role="radiogroup"
              aria-label="Camera look"
              data-style-carousel=""
              className="-mx-[2px] flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden px-[2px] pb-1 pt-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {CAMERA_LOOKS.map((look) => {
                const on = look === shown;
                return (
                  <button key={look} type="button" role="radio" aria-checked={on} data-style-card={look} onClick={() => pick(look)} className={SP_LOOK_CARD}>
                    <span
                      data-style-card-preview=""
                      className={`${SP_PHONE_PICTURE} ${
                        on ? 'border-2 border-[var(--sp-cta)] shadow-[0_0_0_3px_var(--sp-cta-wash)]' : 'border border-[var(--sp-line)]'
                      }`}
                    >
                      <span data-style-preview="render" className="absolute inset-0">
                        <CameraLookFace look={look} logo={brand.logo} accent={brand.accent} />
                      </span>
                    </span>
                    <span className={`${SP_LOOK_NAME} ${on ? 'text-[var(--sp-ink)]' : 'text-[var(--sp-ink2)]'}`}>
                      {CAMERA_LOOK_LABEL[look]}
                    </span>
                  </button>
                );
              })}
            </div>
            {error ? (
              <p role="alert" className="shrink-0 py-1 text-[12.5px] font-semibold text-terracotta-700">
                {error}
              </p>
            ) : null}
          </>
        }
        background={null}
        arrange={null}
      />
    </div>
  );
}
