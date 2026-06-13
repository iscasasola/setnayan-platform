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
 *   2. paid ANIMATED_MONOGRAM SKU   → AnimatedMonogramHero (animates the TEXT)
 *   3. chosen type-only lockup      → MonogramMark (bar/duo/script/infinity)   ← NEW
 *   4. chosen framed lockup         → gold frame webp + initials               ← NEW
 *   5. legacy / single-name event   → the original bordered cream initials circle
 *
 * SCOPE NOTE (flagged, owner 2026-06-14): branch 2 still animates the typographic
 * text, not the lockup — bringing the Motion Library onto MonogramMark needs
 * animated lockup variants and is a deliberate follow-up. So a couple who owns
 * the paid animation keeps animated text; everyone else now gets their real
 * static lockup here. Decorative throughout (aria-hidden) — the name + date
 * below carry the meaning, same as the circle this replaces.
 */

const HERO_PX = 80; // matches the h-20 w-20 circle + AnimatedMonogramHero size="md"

export function HeroMonogram({
  event,
  monogram,
  animatedMonogram,
  bespokeSvg,
  shadow,
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
}) {
  // 1 · bespoke / Cipher custom mark wins over everything.
  if (bespokeSvg) {
    return (
      <BespokeMonogramMark
        svg={bespokeSvg}
        color={monogram.color}
        size="md"
        shadow={shadow}
        entrance={Boolean(animatedMonogram)}
      />
    );
  }

  // 2 · paid animation — animates the typographic text (lockup animation = TODO).
  if (animatedMonogram) {
    return (
      <AnimatedMonogramHero
        text={monogram.text}
        color={monogram.color}
        fontFamily={monogram.fontFamily}
        fontStyle={monogram.fontStyle}
        size="md"
        shadow={shadow}
        motion={animatedMonogram}
      />
    );
  }

  const design = resolveMonogramDesign(event);
  const ink = design?.color ?? monogram.color;

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
          className="inline-flex"
          style={shadow ? { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' } : undefined}
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
        className={`relative inline-flex items-center justify-center${shadow ? ' drop-shadow-sm' : ''}`}
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
        borderColor: monogram.color,
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
