/**
 * SetnayanMark — the official Setnayan brand mark as an INLINE SVG icon for the
 * customer accordion bottom nav. It is the ACTUAL logo (the solid filled glyph,
 * geometry byte-identical to /brand/setnayan-mark.svg · owner-supplied
 * 2026-05-31) — NOT an outlined redraw — but it paints in `currentColor` so it
 * carries the SAME color as the lucide tabs beside it instead of the fixed
 * champagne-gold (owner 2026-06-15: "keep the actual logo and keep it the same
 * color as the other icons"). The nav passes `color` via `style`
 * (active ? --m-orange : --m-slate) → drives `currentColor`, and the press-grow
 * `transform: scale()` rides through `style` too, so the mark tints + animates
 * exactly like Home / Studio / Explore.
 *
 * It accepts `className` (used for sizing — e.g. `h-[22px] w-[22px]`) and
 * `style`. `strokeWidth` is destructured off and ignored — this is a FILLED
 * glyph, not a stroked one, so a stroke width is meaningless here (the nav
 * passes 1.75 to every icon uniformly).
 *
 * WHY INLINE (not `<img src="/brand/setnayan-mark.svg">` like <Logo>): an <img>
 * can't be recolored by parent CSS (the asset carries its own gold fill), and
 * the <Logo>/<LogoMark> path goes through `useBrandMark()` which needs the
 * client BrandProvider context. This icon is referenced from the NEUTRAL
 * (non-'use client') `customer-nav-config` roster, so a pure SVG-returning
 * function (no hooks, no context) is required.
 *
 * Only the paint changed vs the canonical asset (gold fill → currentColor); the
 * clipPath id is namespaced (`setnayan-nav-mark-clip`) so multiple instances
 * mounting at once never collide with the asset's id in another document.
 */

import type { SVGProps } from 'react';

export function SetnayanMark({
  className,
  style,
  // FILLED glyph — a stroke width is meaningless; swallow the nav's uniform
  // strokeWidth so it doesn't land as a dead attribute on the <svg>.
  strokeWidth: _strokeWidth,
  ...rest
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 5333.3335 5333.3335"
      role="img"
      aria-label="Setnayan"
      className={className}
      style={style}
      {...rest}
    >
      <defs>
        <clipPath id="setnayan-nav-mark-clip" clipPathUnits="userSpaceOnUse">
          <path d="M 0,0 H 4000 V 4000 H 0 Z" />
        </clipPath>
      </defs>
      <path
        d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
        fill="currentColor"
        fillRule="nonzero"
        transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
        clipPath="url(#setnayan-nav-mark-clip)"
      />
    </svg>
  );
}
