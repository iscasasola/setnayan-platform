import type { AdaptiveTheme } from '@/lib/adaptive-theme';

/**
 * THE COUPLE'S OWN MAIN BACKGROUND — their clip or photo in place of the
 * theme's loop, behind every scene (Event Hub Maker Phase 10).
 *
 * Drawn by the PAGE (`site-body.tsx`), never by `[slug]/layout.tsx`: the layout
 * wraps the private landing, and a couple's own footage must not reach a
 * stranger there (the same reason `GuestGround` carries no couple photo). The
 * layout's theme ground stays underneath; this layer is laid over it, and the
 * theme's own loop is switched off below so a guest's phone does not decode two
 * videos for one background.
 *
 * ── WHAT IT WEARS ──────────────────────────────────────────────────────────
 *   · the still (a photo, or a clip's frame) — first paint, reduced motion, and
 *     what a guest sees while an unscreened clip may not play for them;
 *   · the clip, muted, inline and looping — only where the caller let it through;
 *   · THE SCRIM: the page's own paper (`--color-cream`) at the strength
 *     `mainGroundLegibility` measured over THEIR frame, so body text clears AA
 *     whatever they uploaded. Free — it is drawn whatever the toggle says;
 *   · THE TINT: the theme's accent, button and ornament moved toward their
 *     footage (`adaptiveThemeVars`), only when "Match my video's colours" is on.
 *
 * 🔑 THE TINT RIDES A STYLESHEET WITH `!important`, ON THE LAYOUT'S SCOPE. The
 * scope (`[data-guest-look]`) holds the couple's palette and Pro colours INLINE,
 * and inline beats any ordinary rule — so an ordinary rule here would lose to
 * the very colours it is meant to replace, silently. An `!important` author
 * declaration beats a normal inline one. It never beats a scene frame's own
 * legibility vars (those sit on a deeper element, closer to the words), which is
 * right: a scene on its own ground keeps its own readable colours.
 *
 * Every value in the stylesheet is a hex or an `r g b` triplet computed by
 * `lib/adaptive-theme.ts` from a sanitised frame — never a string a couple typed.
 *
 * No client JavaScript. Decorative only: hidden from assistive tech, deaf to the
 * pointer.
 */
export function MainGround({
  still,
  clip,
  adaptive,
  vars,
}: {
  /** The photo, or the clip's still — a signed URL. */
  still: string | null;
  /** The clip — a signed URL, or null when it may not play for this viewer. */
  clip: string | null;
  adaptive: AdaptiveTheme;
  /** `adaptiveThemeVars(adaptive, …)` — `{}` when the couple keeps the theme's colours. */
  vars: Record<string, string>;
}) {
  if (!still && !clip) return null;
  const declarations = Object.entries(vars)
    .map(([k, v]) => `${k}:${v} !important;`)
    .join('');
  const css =
    '[data-guest-ground] [data-theme-loop],[data-guest-ground] [data-theme-poster]{display:none}' +
    (declarations ? `[data-guest-look]{${declarations}}` : '');
  return (
    <>
      <style data-main-ground-style="">{css}</style>
      <div
        aria-hidden
        data-main-ground=""
        data-main-ground-tint={adaptive.tint ? 'match' : 'theme'}
        className="pointer-events-none fixed inset-0 -z-10"
      >
        {still ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(still)})` }}
          />
        ) : null}
        {clip ? (
          <video
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            src={clip}
            poster={still ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : null}
        <div
          data-main-ground-scrim=""
          className="absolute inset-0"
          style={{ backgroundColor: `rgb(var(--color-cream) / ${adaptive.scrim.toFixed(2)})` }}
        />
      </div>
    </>
  );
}
