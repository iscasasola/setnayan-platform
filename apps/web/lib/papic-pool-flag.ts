/**
 * Papic Pool Gallery feature flag.
 *
 * Gates the whole shared-pool-gallery feature — the guest browse page
 * (/papic/pool), the link/unlink routes, the Me-page doorway card, and the
 * couple's PoolGalleryCard toggle on the Papic studio page. Everything is
 * TRIPLE-gated: this env flag AND the 'papic_pool_gallery' Data-Privacy
 * control (/admin/data-privacy — server surfaces read both via
 * lib/papic-pool-gate.ts) AND the per-event couple toggle
 * (events.pool_gallery_open, DEFAULT FALSE) — all must be on before any
 * guest sees anything. Spec: corpus OnTheDay_App_Build_Studies_2026-07-23.md § 7.
 *
 * NEXT_PUBLIC_ so server pages and client widgets agree on one value
 * (the NEXT_PUBLIC_PAPIC_GAMES_V1 pattern). Off by default — nothing ships
 * until the owner sets NEXT_PUBLIC_PAPIC_POOL_GALLERY=true.
 */
export function papicPoolGalleryEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PAPIC_POOL_GALLERY;
  return v === 'true' || v === '1' || v === 'TRUE';
}
