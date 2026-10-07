import type { AdaptiveTheme } from '@/lib/adaptive-theme';
import type { HubMainBlur, HubMainFocus, HubMainPatternKey } from '@/lib/hub-canvas';
import { SceneClip } from './scene-clip';

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
 *   · the still (a photo, or a clip's frame) — first paint, and what stays
 *     whenever the clip does not play (reduced motion, Save-Data, Low Power
 *     Mode, a closed switch, a dead link);
 *   · the clip — the shipped `SceneClip` loop: muted, inline, no controls,
 *     playing only while on screen and in front, invisible until it moves.
 *     Guests get it too since the owner's *"make it move"* (2026-09-29); only
 *     where the caller let it through (`lib/guest-hero-video.ts`);
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
 * The only client JavaScript is the clip's (`SceneClip`, already on the guest
 * page for scene clips). Decorative only: hidden from assistive tech, deaf to
 * the pointer.
 */
export function MainGround({
  still,
  clip,
  adaptive,
  vars,
  parallax = false,
  veil = null,
  blur = null,
  focus = null,
}: {
  /** The photo, or the clip's still — a signed URL. */
  still: string | null;
  /** The clip — a signed URL, or null when it may not play for this viewer. */
  clip: string | null;
  adaptive: AdaptiveTheme;
  /** `adaptiveThemeVars(adaptive, …)` — `{}` when the couple keeps the theme's colours. */
  vars: Record<string, string>;
  /**
   * 🌄 Parallax on the couple's own photo — the SHIPPED hero parallax: the
   * layer wears `data-pahina-parallax="page"` and `PahinaCoverParallax` drifts
   * it with the PAGE's scroll (this layer is fixed, so its own box never moves).
   */
  parallax?: boolean;
  /**
   * 🌗 Shade ▾ (owner 2026-10-06/07) — the veil `mainGroundShade` measured: the
   * page's ink (Darker · Dark) or paper (Light · Lighter) at a strength never
   * below what readability needs. Null = As is: the measured paper scrim.
   */
  veil?: { color: string; opacity: number } | null;
  /** 🌫 Blur ▾ — Soft · Strong; null = sharp. */
  blur?: HubMainBlur | null;
  /** 🎯 Focus ▾ — which part of a photo stays in view; null = the centre. */
  focus?: HubMainFocus | null;
}) {
  if (!still && !clip) return null;
  const position = focus === 'top' ? 'center top' : focus === 'bottom' ? 'center bottom' : 'center';
  /* A blur's soft edge would show the page through it — the footage is drawn a
     little larger, so the edge falls outside the screen. */
  const blurStyle = blur ? { filter: `blur(${blur === 'strong' ? 14 : 5}px)`, transform: 'scale(1.08)' } : {};
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
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {still ? (
          <div
            className="absolute inset-0 bg-cover"
            style={{ backgroundImage: `url(${JSON.stringify(still)})`, backgroundPosition: position, ...blurStyle }}
            {...(parallax && !clip ? { 'data-pahina-parallax': 'page' } : {})}
          />
        ) : null}
        {clip ? (
          /* 🎞 The shipped scene loop (muted · inline · no controls · only while
             on screen and in front), held invisible until it is MOVING, so the
             still above is the first paint and stays whenever the clip cannot
             play — reduced motion, Save-Data, iOS Low Power Mode, a dead link. */
          <div className="absolute inset-0" style={blurStyle}>
            <SceneClip
            src={clip}
            poster={still}
            play="loop"
            open="inplace"
            label=""
            className={`absolute inset-0 h-full w-full object-cover ${focus === 'top' ? 'object-top' : focus === 'bottom' ? 'object-bottom' : ''}`}
              revealOnPlay
            />
          </div>
        ) : null}
        {veil ? (
          <div
            data-main-ground-scrim=""
            data-main-ground-shade=""
            className="absolute inset-0"
            style={{ backgroundColor: veil.color, opacity: Number(veil.opacity.toFixed(2)) }}
          />
        ) : (
          <div
            data-main-ground-scrim=""
            className="absolute inset-0"
            style={{ backgroundColor: `rgb(var(--color-cream) / ${adaptive.scrim.toFixed(2)})` }}
          />
        )}
      </div>
    </>
  );
}

/**
 * 🖼 "NONE — JUST THE COLOUR" — the couple switched the theme's own loop off
 * (owner 2026-09-29: *"the background animated video cannot be unpicked"*).
 * The SAME switch `MainGround` uses to hide the loop under a hero, and nothing
 * laid over the page: the Background colour (the layout's paper) is all there is.
 */
export function MainGroundNone() {
  return (
    <style data-main-ground-none="">
      {'[data-guest-ground] [data-theme-loop],[data-guest-ground] [data-theme-poster]{display:none}'}
    </style>
  );
}

/**
 * 🧵 A PATTERN ON THE BACKGROUND COLOUR (owner 2026-10-06/07, Studio › Look ›
 * Pattern ▾): Fine lines · Dots · Lace · Grid, drawn in the page's ink at a
 * whisper over the colour (the layout's paper shows through) — never a picture,
 * so nothing to sign and nothing to measure: the words sit on the colour as
 * they always did. The theme's loop is switched off, as for "Just the colour".
 */
const PATTERN_CSS: Readonly<Record<HubMainPatternKey, { image: string; size: string }>> = {
  lines: { image: 'repeating-linear-gradient(135deg, rgb(var(--color-ink) / 0.07) 0 1px, transparent 1px 9px)', size: 'auto' },
  dots: { image: 'radial-gradient(rgb(var(--color-ink) / 0.10) 1.2px, transparent 1.6px)', size: '16px 16px' },
  lace: {
    image:
      'radial-gradient(circle at 50% 0, transparent 7px, rgb(var(--color-ink) / 0.08) 7.5px 8.5px, transparent 9px), radial-gradient(rgb(var(--color-ink) / 0.08) 1px, transparent 1.5px)',
    size: '18px 12px, 18px 12px',
  },
  grid: {
    image: 'linear-gradient(rgb(var(--color-ink) / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-ink) / 0.06) 1px, transparent 1px)',
    size: '22px 22px',
  },
};

export function PatternGround({ pattern, hideLoop }: { pattern: HubMainPatternKey; hideLoop: boolean }) {
  const p = PATTERN_CSS[pattern];
  return (
    <>
      {hideLoop ? (
        <style data-main-ground-none="">
          {'[data-guest-ground] [data-theme-loop],[data-guest-ground] [data-theme-poster]{display:none}'}
        </style>
      ) : null}
      <div
        aria-hidden
        data-main-ground-pattern={pattern}
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundImage: p.image, backgroundSize: p.size }}
      />
    </>
  );
}
