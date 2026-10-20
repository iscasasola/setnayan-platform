/**
 * 🔠 THE APP HONOURS THE IPHONE TEXT SIZE (iOS Dynamic Type).
 *
 * Owner ruling 2026-10-20 (corpus DECISION_LOG): "yes" — when a person sets
 * larger text in iPhone Settings → Display & Brightness → Text Size (or
 * Accessibility → Larger Text), the Setnayan APP's text grows with it. The web
 * and the desktop app are unchanged.
 *
 * WHY THIS SHAPE, NOT `html { font: -apple-system-body }`. That is the textbook
 * answer, but it only moves `rem` text, and this app sets most of its text in
 * px (`text-[13px]` and friends — the iPad/Duo audit 2026-10-19 W5 measured
 * that a root-only change grows 18 % of the text on `/` and 69 % on `/login`),
 * so a root change would give one screen two text sizes. Instead:
 *
 *   1. READ the setting. In WebKit on iPhone/iPad, `font: -apple-system-body`
 *      resolves to the body size of the person's Dynamic Type category — 17 px
 *      at the default ("Large"), 19 px at XL, 40 px at AX3. A hidden probe
 *      element reads it. Anywhere else (the Android shell's Chrome WebView) the
 *      keyword is invalid, the probe's `style.font` stays empty, and NOTHING
 *      changes.
 *   2. SCALE every glyph, px or rem, with `-webkit-text-size-adjust: <n>%` on
 *      <html> — the same lever Capacitor's own TextZoom plugin pulls on iOS.
 *      It scales text only, never boxes, so layouts reflow around bigger words
 *      instead of the whole page zooming.
 *
 * Bounds — `appTextScale`:
 *   · never BELOW 1. A person who chose smaller text keeps the design size: the
 *     16 px input floor (globals.css, `@media (pointer: coarse)`) is what stops
 *     iOS focus-zoom, and shrinking under it would bring that bug back.
 *   · never ABOVE `APP_TEXT_SCALE_MAX`. The largest accessibility sizes (AX3 =
 *     40 px body, 2.35×) would overflow fixed-height bars and 44 px controls
 *     whose labels are set in px. UIKit apps do the same with
 *     `maximumContentSizeCategory`. The cap is the walked size at which the
 *     store-shell screens still hold (simulator walk 2026-10-20, see the PR).
 *
 * ONLY IN THE STORE SHELL. The script runs after `storeShellMarkScript` and
 * returns at once unless that mark is on <html>, so Safari on an iPhone —
 * which has its own "Aa" text size — and the desktop .dmg are never touched.
 *
 * Re-read on `visibilitychange` → visible: a person who changes the size in
 * Settings comes back to the app through exactly that event.
 *
 * Held by lib/the-app-honours-the-iphone-text-size.test.ts, which runs THIS
 * script against a fake document and asks it for the same answers
 * `appTextScale` gives.
 */

/** The iOS body size at the default Dynamic Type category ("Large"), in CSS px. */
export const IOS_DEFAULT_BODY_PX = 17;

/**
 * The largest text scale the app applies. 1.65 ≈ AX1 (28 px body); every larger
 * accessibility size is held here. See the docblock for why there is a cap.
 */
export const APP_TEXT_SCALE_MAX = 1.65;

/** The attribute the script leaves on <html> with the scale it applied. */
export const APP_TEXT_SCALE_ATTR = 'data-text-scale';

/**
 * The text scale for a measured `-apple-system-body` size: the ratio to the
 * default body size, kept within [1, APP_TEXT_SCALE_MAX], rounded to 1/100.
 * A non-number or non-positive reading → 1 (change nothing).
 */
export function appTextScale(bodyPx: number): number {
  if (!Number.isFinite(bodyPx) || bodyPx <= 0) return 1;
  const raw = bodyPx / IOS_DEFAULT_BODY_PX;
  const bounded = Math.min(APP_TEXT_SCALE_MAX, Math.max(1, raw));
  return Math.round(bounded * 100) / 100;
}

/**
 * Inline <head> script (app/layout.tsx, right after `storeShellMarkScript`).
 * Plain ES5, no imports — it runs before React. The arithmetic mirrors
 * `appTextScale` exactly; the test holds the two together.
 */
export const appTextSizeScript = `(function(){try{
  var d=document,h=d.documentElement;
  if(!h.hasAttribute('data-store-shell'))return;
  function apply(){
    var p=d.createElement('div');
    p.style.font='-apple-system-body';
    if(!p.style.font)return;
    p.style.webkitTextSizeAdjust='100%';
    p.style.position='absolute';p.style.visibility='hidden';p.style.pointerEvents='none';
    h.appendChild(p);
    var px=parseFloat(getComputedStyle(p).fontSize);
    h.removeChild(p);
    var s=1;
    if(isFinite(px)&&px>0){s=Math.round(Math.min(${APP_TEXT_SCALE_MAX},Math.max(1,px/${IOS_DEFAULT_BODY_PX}))*100)/100;}
    var pct=Math.round(s*100)+'%';
    h.style.webkitTextSizeAdjust=pct;h.style.textSizeAdjust=pct;
    h.setAttribute('${APP_TEXT_SCALE_ATTR}',String(s));
  }
  apply();
  d.addEventListener('visibilitychange',function(){if(d.visibilityState==='visible')apply();});
}catch(e){}})();`;
