/* eslint-disable @next/next/no-img-element */
'use client';
/**
 * v2.1 brand marks · Setnayan Vendor Keynote template package.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption". The
 * template's components/marks.jsx ships 4 brand-mark React components used
 * across every marketing surface (hero, nav, footer, keynote slides). This
 * file ports them faithfully into the production codebase, matching the
 * canonical "SET NA 'YAN" wordmark with the orange apostrophe accent.
 *
 * SCOPE: marketing surfaces only (/, /for-vendors, /keynote*, /signup,
 * /login, /pricing, /privacy, etc.). The existing `Logo` in `./logo.tsx` is
 * used in app-chrome surfaces (dashboard, admin, vendor-dashboard); both
 * coexist intentionally and now share the same canonical mark asset
 * (/brand/setnayan-mark.svg · official gold mark, owner-supplied 2026-05-31).
 *
 * USAGE:
 *   import { Wordmark } from '@/app/_components/brand-marks';
 *   <Wordmark size={28} />        // standard nav-bar size
 *   <Wordmark size={40} />        // hero / footer size
 *   <WordmarkLarge size={88} />   // display moments
 *   <LogoMark size={48} />        // icon-only (favicons, avatars)
 *   <LogoFull height={48} />      // full lockup wrapper for header use
 *
 * IMG STRATEGY: raw `<img>` with eslint-disable to skip next/image — the
 * SVG is tiny (~2.5 KB), already optimized, and serving it through next/image
 * would add a presigning round-trip per render with zero payload win. Same
 * approach the existing `Logo` component takes.
 *
 * The mark image resolves via `useBrandMark()` so the admin-uploaded default
 * brand icon (owner 2026-06-10) flows through here too — falling back to the
 * canonical gold SVG when none is set. Only the IMAGE switches; the
 * "SET NA 'YAN" text wordmark below is unaffected.
 */

import { useBrandMark } from './brand-provider';

/**
 * Just the icon mark (no text). Use for favicons, avatar slots, monogram
 * stamps in keynote slides. SVG renders at 1:1 aspect ratio.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const markSrc = useBrandMark();
  return (
    <img
      src={markSrc}
      alt=""
      width={size}
      height={size}
      className={`block ${className ?? ''}`.trim()}
      style={{ flexShrink: 0 }}
    />
  );
}

/**
 * Standard wordmark — icon + "SET NA 'YAN" wordmark in display font. The
 * apostrophe (`'`) is rendered in burnt sienna (var(--m-orange)) — that's
 * the brand-origin accent that maps back to the phrase "Set na 'yan."
 * (Tagalog: "that's all set"). Default size 22 matches nav-bar use.
 */
export function Wordmark({
  size = 22,
  color = 'var(--m-ink)',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center ${className ?? ''}`.trim()}
      style={{ gap: size * 0.42, lineHeight: 1, color }}
    >
      <LogoMark size={Math.round(size * 1.25)} />
      <span
        style={{
          fontFamily: 'var(--font-condensed), "Saira Condensed", sans-serif',
          fontSize: size * 1.04,
          fontWeight: 800,
          letterSpacing: '0.005em',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        SET NA <span style={{ color: 'var(--m-orange)' }}>&lsquo;</span>YAN
      </span>
    </span>
  );
}

/**
 * Larger display version — same composition, sized for hero moments and
 * keynote-slide opening titles. Default size 64.
 */
export function WordmarkLarge({
  size = 64,
  color = 'var(--m-ink)',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center ${className ?? ''}`.trim()}
      style={{ gap: size * 0.28 }}
    >
      <LogoMark size={Math.round(size * 1.18)} />
      <div
        style={{
          fontFamily: 'var(--font-condensed), "Saira Condensed", sans-serif',
          fontSize: size,
          fontWeight: 800,
          letterSpacing: '0.01em',
          color,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        SET NA <span style={{ color: 'var(--m-orange)' }}>&lsquo;</span>YAN
      </div>
    </div>
  );
}

/**
 * Full-lockup wrapper — wraps Wordmark at a height-based scale so it can
 * stand in for a single SVG asset. Use when a parent layout reserves a
 * specific height (e.g., a 36px nav bar header with `height={36}`).
 */
export function LogoFull({ height = 36 }: { height?: number }) {
  return <Wordmark size={Math.round(height * 0.7)} />;
}
