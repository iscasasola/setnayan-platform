/**
 * optimizable-image-url.ts — may `next/image` be handed this URL?
 *
 * ── WHY IT IS A SHARED RULE AND NOT A LOCAL HELPER ─────────────────────────
 * `next/image` only accepts an absolute URL whose host is in `next.config.ts`'s
 * `images.remotePatterns`. Anything else answers **HTTP 400
 * INVALID_IMAGE_OPTIMIZE_REQUEST** from `/_next/image?url=…` — and the symptom
 * is a picture that is simply not there. Nothing throws. That has already cost
 * this codebase a measured day: on 2026-08-08 the presigned R2 URL itself
 * answered `200 image/png 34478 bytes` while the optimizer answered `400`, and
 * the shop logo was still missing after the fix that was meant to show it.
 *
 * 🪤 THE CASE THIS EXISTS FOR IS THE **LEGACY** ONE. `vendor_profiles.logo_url`
 * holds either an `r2://` ref (resolved to a whitelisted R2 host — fine) or a
 * URL the vendor PASTED into the old text input years ago, which can be any
 * host on the internet. The R2 case works and hides the other one.
 *
 * Extracted from `app/(shell)/explore/_components/vendor-card.tsx`, which had
 * the rule right and kept it private, so the marketplace's service cards would
 * have had to copy it. Behaviour is unchanged — this is a move.
 *
 * Callers render their own fallback (an initials tile, a placeholder) rather
 * than passing an unlisted host through: a missing image must degrade to a
 * designed state, never to broken `next/image` markup.
 *
 * Pure: no React, no I/O, no environment.
 */
export function isOptimizableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // A same-origin path is always served by our own host.
  if (url.startsWith('/')) return true;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    host.endsWith('.r2.dev') ||
    host.endsWith('.r2.cloudflarestorage.com') ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.in') ||
    // Demo/seed placeholder host. Already whitelisted in next.config.ts
    // remotePatterns + used by the moodboard library seed; aligning this guard
    // lets synthetic demo-vendor logos render instead of falling back to
    // initials. Real vendors never store picsum URLs.
    host === 'picsum.photos' ||
    host === 'fastly.picsum.photos'
  );
}
