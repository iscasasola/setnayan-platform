/**
 * THE ONE STRING BOTH MARKERS MARK WITH (MB27).
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 * 🛑 THE TWO WATERMARK PATHS DISAGREED IN PRODUCTION, AND NOTHING WENT RED.
 * Measured on `origin/main` 2026-09-05:
 *
 *   lib/watermark-server.ts   WATERMARK_TEXT = 'WWW.SETNAYAN.COM'   (MB20)
 *   lib/watermark.ts          default text   = 'SETNAYAN'           (2026-05-21)
 *
 * So a Mood Board render carried the URL and a vendor's marketplace photograph
 * — the pool most likely to be scraped and reposted — carried a bare word that
 * tells a stranger nothing they can type into a browser. Both paths "worked".
 * Every test on both sides was green. The divergence was invisible because
 * NOTHING IN THE CODEBASE COMPARED THE TWO.
 *
 * Owner ruling 2026-09-05: **one mark everywhere, and it is the web address.**
 * The point of the mark is that someone who sees the photo outside the app
 * knows where to go.
 *
 * ── WHY THE CONSTANT COULD NOT SIMPLY BE IMPORTED FROM THE SERVER ─────────
 * The obvious fix — `import { WATERMARK_TEXT } from './watermark-server'` in
 * `watermark.ts` — CANNOT SHIP. That module's first import is `sharp`, a
 * native Node addon, and `watermark.ts` runs in the browser inside a
 * `'use client'` upload component. The import would drag sharp into the client
 * bundle; at best the build fails, at worst a bundler stubs it and the mark
 * silently stops happening.
 *
 * So the string lives HERE, in a module with NO imports of any kind — nothing
 * to tree-shake, nothing platform-specific, safe on both sides of the wire.
 * Both markers import it, and `one-mark-everywhere.test.ts` reads both modules'
 * SOURCE to assert neither has quietly re-introduced a literal of its own.
 * That guard is the part that matters: a shared constant that one side stops
 * using is exactly the state this file was created to end.
 *
 * ⚠ CHANGING THIS STRING CHANGES EVERY MARKED PHOTOGRAPH ON THE PLATFORM —
 * marketplace uploads, admin library assets, gallery renders, and the small
 * URL line on the seal. It is a brand lock (the full spelling, never abbreviated), and `mark-fits-
 * and-marks.test.ts` asserts the plate still FITS at whatever length it has.
 * A longer string is not a text change; it is a geometry change.
 */

/**
 * The URL every marked photograph carries. Owner directive 2026-09-04 (the
 * URL, not the bare word), extended to every path by ruling 2026-09-05.
 */
export const WATERMARK_TEXT = 'WWW.SETNAYAN.COM';

/**
 * THE SEAL-AND-PLATE LINES (owner-approved 2026-11-04, supplier_photo_mark
 * direction A). The address strings live HERE for the same MB27 reason as
 * `WATERMARK_TEXT`: the browser painter, the server painter and the geometry
 * that sizes them must not each carry their own copy of the address a viewer
 * types into a browser. Slugs are drawn as stored (lowercase).
 */
export const MARK_CAPS = 'SETNAYAN';
export const MARK_CAPS_VERIFIED = 'SETNAYAN VERIFIED';
export const MARK_ADDRESS = 'setnayan.com';
export function markVerifiedAddress(slug: string): string {
  return `${MARK_ADDRESS}/v/${slug}`;
}
