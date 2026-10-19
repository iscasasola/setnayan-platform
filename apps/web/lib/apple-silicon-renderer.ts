/**
 * apps/web/lib/apple-silicon-renderer.ts — does this WebGL renderer string say "an Apple-silicon Mac"?
 *
 * Read by `/download`'s `PlatformCompatBanner`, which nudges an older or Intel Mac towards OBS. The renderer string
 * (`WEBGL_debug_renderer_info` → `UNMASKED_RENDERER_WEBGL`) is the one browser signal that still tells the two apart:
 * the user agent says "Intel Mac OS X" and `navigator.platform` says "MacIntel" on EVERY Mac, for compatibility.
 *
 *   Chrome / Edge / Arc on an M-series Mac → "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)"
 *   Firefox on an M-series Mac            → "Apple M1" (or "Apple GPU" with fingerprinting protection on)
 *   Safari on an M-series Mac             → "Apple GPU" — Safari masks the chip name, always
 *   Chrome on an Intel Mac                → "ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, …)" / AMD Radeon …
 *
 * 🪪 "Apple GPU" COUNTS AS APPLE SILICON (sweep B4, 2026-10-19). The check used to want `Apple M<digit>`, so every
 * Safari visitor on an M-series Mac — the commonest visitor this page has — was told "This looks like it might be an
 * older or Intel Mac". Safari reports the same masked string on an Intel Mac too, so for Safari this cannot tell the
 * two apart; it now stays quiet there instead of being wrong for the many. The page still states the requirement in
 * words above the buttons and in "What you need", where an Intel Mac owner reads it either way.
 *
 * Pure: no DOM, so `apple-silicon-renderer.test.ts` runs every string above.
 */
export function rendererLooksAppleSilicon(renderer: string): boolean {
  return /\bApple M\d/i.test(renderer) || /\bApple GPU\b/i.test(renderer);
}
