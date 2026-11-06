'use client';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { HUB_FOCAL_POINTS, HUB_ZOOMS } from '@/lib/hub-canvas';
import { LOGO_ZOOM_LABEL, logoFrameStyle, type LogoFrame } from '@/lib/open-shop-logo';

/**
 * A shop logo's align + zoom (owner, the 2026-11-06 /open-shop gate walk: *"zoom and align"* — the Event Hub Maker
 * photo's control, reused as-is). The keypad is the Maker's "In frame" row from
 * `website/editor/_components/scene-background-row.tsx`, unchanged: the photo behind a 3 × 3 grid, one tap keeps
 * that area in frame (`HUB_FOCAL_POINTS`, "Keep area N of 9 in frame"), and "How close" is the same ONE dropdown
 * over `HUB_ZOOMS` with the same words. Beside it, the round frame couples see, drawn through `logoFrameStyle` —
 * the one style every logo surface uses.
 *
 * Posts `logo_focal` + `logo_zoom` (hidden inputs) for the form it sits in.
 */
export function LogoFrameControl({
  imageUrl,
  frame,
  onChange,
}: {
  /** The display URL of the logo (presigned), or null before one is uploaded — then nothing is offered. */
  imageUrl: string | null;
  frame: LogoFrame;
  onChange: (frame: LogoFrame) => void;
}) {
  return (
    <div className="space-y-2" data-logo-frame="">
      <input type="hidden" name="logo_focal" value={frame.focal} />
      <input type="hidden" name="logo_zoom" value={frame.zoom} />
      {imageUrl ? (
        <div className="flex items-center gap-4">
          {/* The round frame, as couples will see it. */}
          <span
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
            data-logo-frame-preview=""
          >
            {/* Presigned R2 URL — next/image can't optimise short-lived signed URLs (FileUpload's pattern). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Your logo, as couples see it" className="h-full w-full object-cover" style={logoFrameStyle(frame)} />
          </span>
          <div className="min-w-0 space-y-2">
            <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
              What to keep in frame
            </span>
            <div className="flex items-center gap-3">
              <div
                className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md border bg-cover"
                style={{ borderColor: 'var(--m-line)', backgroundImage: `url("${imageUrl}")`, backgroundPosition: 'center' }}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {HUB_FOCAL_POINTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={frame.focal === f}
                      aria-label={`Keep area ${f} of 9 in frame`}
                      onClick={() => onChange({ ...frame, focal: f })}
                      className={`border border-white/35 ${frame.focal === f ? 'bg-white/70' : 'hover:bg-white/25'}`}
                    />
                  ))}
                </div>
              </div>
              {/* One of three VALUES → the dropdown, never a row of segments (`INTERACTION_RULES.md` § 2, § 9). */}
              <PickMenu
                label="How close"
                dataAttr="data-logo-zoom"
                value={String(frame.zoom)}
                options={HUB_ZOOMS.map((z) => ({ key: String(z), label: LOGO_ZOOM_LABEL[z] }))}
                onPick={(k) => {
                  const z = HUB_ZOOMS.find((x) => String(x) === k);
                  if (z) onChange({ ...frame, zoom: z });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
