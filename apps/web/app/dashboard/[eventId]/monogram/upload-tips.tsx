import { Check, XCircle } from 'lucide-react';

/**
 * <UploadTips> — what actually uploads well, said BEFORE the upload.
 *
 * Every word here is a property of the real decoder, not generic advice. The
 * page previously had none of this: the only guidance was error copy, which by
 * definition arrives after a couple has already failed once — and the failures
 * are not obvious ones. `lib/monogram-studio/trace.ts` finds the mark by its
 * ALPHA channel for transparent art and by LUMINANCE for opaque scans, keeps
 * one path per connected component up to MAX_COMPONENTS = 40, and drops pieces
 * under MIN_COMPONENT_FRAC of the canvas. So:
 *   · a PNG on a white rectangle traces the RECTANGLE (there is no transparency
 *     to find) — the single most common bad upload
 *   · a gradient or a drop shadow has no clean edge to follow
 *   · an SVG with live <text> depends on a font we do not have; outlining it
 *     first is what keeps the designer's exact curves
 *   · piece count is not cosmetic — each piece is what the reveal animates
 *
 * 🔑 If the decoder's thresholds change, THIS COPY IS NOW WRONG. It is the
 * user-facing half of trace.ts; the two must move together.
 */
export function UploadTips({ open }: { open?: boolean }) {
  return (
    <details
      open={open}
      className="overflow-hidden rounded-xl border border-ink/10 bg-cream [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-ink">What uploads best</span>
        <span className="text-xs font-medium text-ink/50">20 seconds · saves a retry</span>
      </summary>

      <ul className="space-y-3 px-4 pb-4">
        <Tip>
          <strong className="font-semibold text-ink">An SVG is perfect.</strong> Ask your designer to
          &ldquo;outline the text&rdquo; before exporting — then we keep their exact curves, crisp at
          any size.
        </Tip>
        <Tip>
          <strong className="font-semibold text-ink">A PNG needs a transparent background.</strong> We
          find your mark by its transparency, so a white box around it becomes part of the artwork.
        </Tip>
        <Tip>
          <strong className="font-semibold text-ink">A photo works.</strong> Dark ink on light paper,
          shot straight on in even light — flatten the page and keep a shadow off it.
        </Tip>
        <Tip>
          <strong className="font-semibold text-ink">Simple and high-contrast traces best.</strong>{' '}
          Soft gradients, drop shadows and photographic fills blur the edges we trace along.
        </Tip>
        <Tip>
          <strong className="font-semibold text-ink">We keep up to 40 separate pieces.</strong> Each
          one animates on its own, so a few clean shapes reveal far more beautifully than hundreds of
          specks.
        </Tip>
        <li className="flex items-start gap-2.5 border-t border-ink/8 pt-3">
          <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          <span className="text-sm leading-relaxed text-ink/70">
            <strong className="font-semibold text-ink">EPS and AI can&rsquo;t be opened by any
            browser.</strong>{' '}
            Export as SVG or PNG first — every design tool and most free converters do it in one step.
          </span>
        </li>
      </ul>
    </details>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-700" strokeWidth={2.2} />
      <span className="text-sm leading-relaxed text-ink/70">{children}</span>
    </li>
  );
}
