import Link from 'next/link';
import { PenLine, UploadCloud } from 'lucide-react';

/**
 * <MarkToggle> — the one control at the top of the Monogram Maker.
 *
 * Owner 2026-09-20, asked where the "Both ways to make it" link and the
 * "Vector Studio · Design your mark from scratch" heading should move: *"make a
 * toggle. what will switch which editor or uploader will show under. under it
 * is the animate."*
 *
 * So the page is four rows, top to bottom: this toggle, the editor OR the
 * uploader it selects, the effects, and the two save buttons. It replaces a chooser SCREEN (two large
 * door cards you had to pass through), a "Both ways to make it" link back to
 * that screen, and a separate heading-plus-paragraph inside each door — four
 * pieces of navigation for one binary choice.
 *
 * Labels are the owner's own: *"Create your own or Upload your monogram"* — a
 * toggle "with labels on which editor will show", so each side names what opens
 * beneath it rather than a verb like "Design it" that says nothing about where
 * you end up.
 *
 * Links, not client state: each side carries `?mode=`, so Back and refresh keep
 * the side you were on, a deep link can open either one, and the choice works
 * before any JavaScript has loaded. `aria-current` marks the active side for
 * screen readers; both targets are ≥44px.
 *
 * ⚠ THE TWO HREFS ARE WRITTEN OUT LITERALLY, ON PURPOSE. `lint-port-no-lost-
 * controls` reads destinations statically and cannot follow a URL built by a
 * helper call. Measured, not assumed: the chooser this replaces built its
 * `?mode=` links through `href(mode)`, and they were NEVER in the guard's
 * baseline — the page's only recorded destination was the plain `…/monogram`
 * link. Written literally, both sides of this toggle are now recorded, so
 * deleting either one turns the guard red. (The guard also keeps the query as
 * part of the key, so `?mode=design` and the bare path are different
 * destinations to it — which is why removing the bare "Both ways to make it"
 * link is a real, deliberate removal and its baseline is regenerated.)
 */
const ON = 'bg-cream text-ink shadow-sm';
const OFF = 'text-ink/60 hover:text-ink';
const SIDE =
  'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors';

export function MarkToggle({ eventId, mode }: { eventId: string; mode: 'design' | 'upload' }) {
  return (
    <nav aria-label="How to make your mark" className="flex w-full max-w-lg gap-1 rounded-xl bg-ink/5 p-1">
      <Link
        href={`/dashboard/${eventId}/monogram?mode=design`}
        aria-current={mode === 'design' ? 'page' : undefined}
        className={`${SIDE} ${mode === 'design' ? ON : OFF}`}
      >
        <PenLine aria-hidden className="h-4 w-4" strokeWidth={2} />
        Create your own
      </Link>
      <Link
        href={`/dashboard/${eventId}/monogram?mode=upload`}
        aria-current={mode === 'upload' ? 'page' : undefined}
        className={`${SIDE} ${mode === 'upload' ? ON : OFF}`}
      >
        <UploadCloud aria-hidden className="h-4 w-4" strokeWidth={2} />
        Upload your monogram
      </Link>
    </nav>
  );
}
