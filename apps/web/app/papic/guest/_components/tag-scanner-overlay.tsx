/**
 * 🏷 "TAG WHO'S IN IT" — the scanner as a framed window over the viewfinder.
 *
 * Owner 2026-10-24 ("Okay build it", prototype
 * `papic_camera_complete_2026-10-24_fable.html`, states 5 · 6): the button sits
 * right of the shutter; while it is on, the viewfinder dims around a framed
 * window with a sweeping line, the caption says what to point at, the count
 * sits bottom-right, and each scan shows a confirmation chip at the top
 * ("✓ Ana Reyes tagged" · "✓ Table 4 · 8 added").
 *
 * Presentation only. The decode loop runs on the WHOLE live frame (the window
 * is a guide, not a crop) and the tag is written by `/api/papic/guest-tag` —
 * both unchanged in `papic-guest-capture.tsx`.
 */

import { Check } from 'lucide-react';
import { formatCount } from '@/lib/format-number';

const SCAN_KEYFRAMES = `@keyframes papic-tag-sweep{from{transform:translateY(-100px)}to{transform:translateY(100px)}}
[data-tag-sweep]{animation:papic-tag-sweep 1.6s ease-in-out infinite alternate}
@media (prefers-reduced-motion: reduce){[data-tag-sweep]{animation:none}}`;

const CORNER = 'absolute h-[26px] w-[26px] border-[#ffd978]';

export function TagScannerOverlay({ tagCount, confirmation }: { tagCount: number; confirmation: string | null }) {
  return (
    <div data-tag-scanner="" className="pointer-events-none absolute inset-0 z-[9]">
      <style>{SCAN_KEYFRAMES}</style>
      {/* The shade with a 220 × 220 window, 20 px above the middle. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[calc(50%-20px)] h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-[14px]"
        style={{ boxShadow: '0 0 0 100vmax rgba(31,29,26,.6)' }}
      >
        <span className={`${CORNER} -left-0.5 -top-0.5 rounded-tl-[10px] border-l-[3px] border-t-[3px]`} />
        <span className={`${CORNER} -right-0.5 -top-0.5 rounded-tr-[10px] border-r-[3px] border-t-[3px]`} />
        <span className={`${CORNER} -bottom-0.5 -left-0.5 rounded-bl-[10px] border-b-[3px] border-l-[3px]`} />
        <span className={`${CORNER} -bottom-0.5 -right-0.5 rounded-br-[10px] border-b-[3px] border-r-[3px]`} />
        <span
          data-tag-sweep=""
          className="absolute left-[10px] right-[10px] top-1/2 h-0.5 bg-[#ffd978]"
          style={{ boxShadow: '0 0 12px #ffd978' }}
        />
      </div>

      <p className="absolute inset-x-0 top-3 px-5 text-center text-[12.5px] text-cream/90">
        <b className="block text-sm font-semibold">Tag who&rsquo;s in it</b>
        Point at a guest&rsquo;s invite QR or a table sign
      </p>

      {confirmation ? (
        <p
          role="status"
          data-tag-confirmation=""
          className="absolute left-1/2 top-[60px] inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/75 px-3 py-[7px] text-[12.5px] font-medium text-cream"
        >
          <Check aria-hidden className="h-3.5 w-3.5 text-[#9fd8b3]" strokeWidth={2.5} />
          {confirmation}
        </p>
      ) : null}

      <span className="absolute bottom-3 right-3.5 font-mono text-[11px] text-cream/60">
        {formatCount(tagCount)} tagged
      </span>
    </div>
  );
}
