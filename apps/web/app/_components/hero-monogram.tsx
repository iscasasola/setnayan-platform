import type { MonogramMotionKey } from '@/lib/monogram-motion';
import {
  resolveMonogramDesign,
  monogramFrameAssetUrl,
  splitInitials,
  type MonogramConfig,
} from '@/lib/monogram';
import { MonogramMark, type MonogramMarkStyle } from '@/app/_components/monogram-mark';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { GoldMonogramReveal } from '@/app/_components/gold-monogram-reveal';
import { MoltenMonogramInline } from '@/app/_components/molten-monogram-inline';

/**
 * HeroMonogram — the couple's mark on their PUBLIC landing page hero.
 *
 * WHY (owner 2026-06-13/14): the dashboard switcher already renders the couple's
 * REAL chosen lockup (EventMonogram → MonogramMark), but the public wedding-site
 * hero still showed plain initials in a circle — so the marquee surface didn't
 * match the mark they designed in onboarding. This centralizes the three
 * identical hero cascades that lived inline in app/[slug]/page.tsx and adds the
 * missing lockup + framed branches.
 *
 * Render precedence (highest first):
 *   1. bespoke / Cipher custom SVG  → BespokeMonogramMark (their own AI mark)
 *   2. paid ANIMATED_MONOGRAM SKU   → AnimatedMonogramHero — animates the couple's
 *                                     real LOCKUP (bar/duo/script/infinity) when
 *                                     they chose one, else the text circle
 *   3. chosen type-only lockup      → MonogramMark (bar/duo/script/infinity · static)
 *   4. chosen framed lockup         → gold frame webp + initials
 *   5. legacy / single-name event   → the original bordered cream initials circle
 *
 * MONOGRAM CONSISTENCY (owner 2026-06-14): branch 2 now threads the event's
 * resolved design into AnimatedMonogramHero, so the six motion signatures play
 * on the SAME lockup geometry the static branches (3) + the chrome + QR center
 * render. framed / single-initial / legacy events keep animating the text
 * circle (AnimatedMonogramHero falls back internally). Decorative throughout
 * (aria-hidden) — the name + date below carry the meaning, same as the circle.
 */

const HERO_PX = 80; // matches the h-20 w-20 circle + AnimatedMonogramHero size="md"

export function HeroMonogram({
  event,
  monogram,
  animatedMonogram,
  bespokeSvg,
  shadow,
  inkOverride,
  plate,
  allowWebgl = false,
}: {
  // Only the design columns are needed; a narrow shape keeps this reusable.
  event: {
    monogram_style?: string | null;
    monogram_font_key?: string | null;
    monogram_frame_key?: string | null;
  };
  monogram: MonogramConfig;
  animatedMonogram: MonogramMotionKey | false;
  bespokeSvg: string | null;
  shadow?: boolean;
  /** Permit the WebGL 'molten' motion to render LIVE here. Only large, never
   *  co-mounted surfaces (the STD film monogram beat · the editor preview) pass
   *  true — one WebGL context at a time. Everywhere else (default false) a
   *  'molten' pick degrades to the CSS Gold Turn so chrome/thumbnails never spin
   *  up shaders or exhaust the browser's WebGL context cap. */
  allowWebgl?: boolean;
  /** Force the mark INK to this colour, overriding the design's curated ink AND
   *  the monogram colour (e.g. the STD film forces the couple's CTA-button accent
   *  — owner 2026-06-22). The infinity ∞ gold gradient is independent and stays.
   *  The marketing hero omits this, so it's unchanged. */
  inkOverride?: string | null;
  /** Render on a DARK surface (recap photo-hero overlay · the venue Live Wall).
   *  Adds a cream backing to ONLY the otherwise-bare branches — the lockup (3)
   *  and framed (4) marks — so they read on dark. The self-backing branches
   *  (bespoke · animated · legacy circle) already carry their own cream disc, so
   *  they ignore this — which is why callers pass `plate` instead of wrapping the
   *  whole component in a cream lozenge (that double-backed the self-disc
   *  branches into a faint cream-on-cream ring). Default off → light surfaces
   *  (public hero · editorial · recap cream body) are unchanged. */
  plate?: boolean;
}) {
  // The mark ink: an explicit override wins over the design's curated ink + the
  // monogram colour, so a caller can force e.g. the button accent.
  const markColor = inkOverride ?? monogram.color;

  // The whole-mark gold animations (Gold Turn · Molten Gold) render the couple's
  // mark — bespoke silhouette OR lettered glyphs — in flowing gold, so they cover
  // both in ONE component and must run BEFORE the bespoke short-circuit below.
  const goldMotion = animatedMonogram === 'gold' || animatedMonogram === 'molten';

  // 1 · bespoke / Cipher custom mark wins over everything — EXCEPT gold/molten,
  // which consume the same bespoke SVG (as their gold silhouette) in branch 2.
  if (bespokeSvg && !goldMotion) {
    return (
      <BespokeMonogramMark
        svg={bespokeSvg}
        color={markColor}
        size="md"
        shadow={shadow}
        entrance={Boolean(animatedMonogram)}
      />
    );
  }

  // 2a · Gold Turn (CSS) / Molten Gold (WebGL) — the whole-mark premium motions.
  // Molten renders live only where allowWebgl (one context at a time); otherwise
  // it degrades to the CSS Gold Turn — still gold + animated, safe everywhere.
  if (goldMotion) {
    const useMolten = animatedMonogram === 'molten' && allowWebgl;
    return (
      <span aria-hidden className="inline-flex" style={{ width: HERO_PX, height: HERO_PX }}>
        {useMolten ? (
          <MoltenMonogramInline markSvg={bespokeSvg} monogram={monogram.text} lowRes />
        ) : (
          <GoldMonogramReveal markSvg={bespokeSvg} monogram={monogram.text} inline />
        )}
      </span>
    );
  }

  const design = resolveMonogramDesign(event);
  const ink = inkOverride ?? design?.color ?? monogram.color;

  // 2 · paid animation — plays the chosen motion on the couple's real lockup
  // (bar/duo/script/infinity). For those four, ink = the lockup color (mulberry)
  // and the face comes from the resolved design; framed / single-initial /
  // legacy events fall through to AnimatedMonogramHero's text-circle render
  // using the legacy monogram color + face.
  if (animatedMonogram) {
    const lockupStyle =
      design?.style === 'bar' ||
      design?.style === 'duo' ||
      design?.style === 'script' ||
      design?.style === 'infinity'
        ? design.style
        : null;
    return (
      <AnimatedMonogramHero
        text={monogram.text}
        color={lockupStyle ? ink : markColor}
        fontFamily={design?.fontFamily ?? monogram.fontFamily}
        fontStyle={design?.fontStyle ?? monogram.fontStyle}
        lockupStyle={lockupStyle}
        letterSpacing={design?.letterSpacing}
        size="md"
        shadow={shadow}
        motion={animatedMonogram}
      />
    );
  }

  // 3 · the couple's REAL chosen lockup, drawn frameless at hero scale.
  const markStyle: MonogramMarkStyle | null =
    design?.style === 'bar' ||
    design?.style === 'duo' ||
    design?.style === 'script' ||
    design?.style === 'infinity'
      ? design.style
      : null;
  if (markStyle && design) {
    const [a, b] = splitInitials(monogram.text);
    if (a && b) {
      return (
        <span
          aria-hidden
          className={
            plate ? 'inline-flex items-center justify-center rounded-full bg-cream px-5 py-4 shadow-lg' : 'inline-flex'
          }
          style={!plate && shadow ? { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' } : undefined}
        >
          <MonogramMark
            style={markStyle}
            a={a}
            b={b}
            fontFamily={design.fontFamily}
            fontStyle={design.fontStyle}
            letterSpacing={design.letterSpacing}
            color={ink}
            px={HERO_PX}
            title={monogram.text}
          />
        </span>
      );
    }
  }

  // 4 · framed lockup — the ornate gold frame reads at hero scale (unlike chrome).
  if (design?.frameKey) {
    return (
      <span
        aria-hidden
        className={`relative inline-flex items-center justify-center${shadow ? ' drop-shadow-sm' : ''}${
          plate ? ' rounded-full bg-cream' : ''
        }`}
        style={{
          width: HERO_PX,
          height: HERO_PX,
          backgroundImage: `url(${monogramFrameAssetUrl(design.frameKey)})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <span
          style={{
            color: ink,
            fontFamily: design.fontFamily,
            fontStyle: design.fontStyle,
            letterSpacing: design.letterSpacing,
            fontSize: `${Math.round(HERO_PX * 0.28)}px`,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {monogram.text}
        </span>
      </span>
    );
  }

  // 5 · legacy / single-name fallback — the original bordered cream circle. Uses
  // the couple's chosen face when a design is present, else the generic serif.
  return (
    <span
      aria-hidden
      className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream text-2xl${
        design ? '' : ' font-serif italic'
      }${shadow ? ' shadow-sm' : ''}`}
      style={{
        borderColor: markColor,
        color: ink,
        ...(design
          ? {
              fontFamily: design.fontFamily,
              fontStyle: design.fontStyle,
              letterSpacing: design.letterSpacing,
            }
          : {}),
      }}
    >
      {monogram.text}
    </span>
  );
}
