## 2026-07-01 · fix(repost-watch/realstory/sitemap): re-match runs at current threshold · seed sets Pro · samples kept out of sitemap

Three correctness gaps from a gap-audit, fix-forward (no new migrations):

- **Reverse-image re-match was inert once images were hashed.**
  `lib/vendor-image-repost-watch.ts` only ran the MATCH-and-flag block INSIDE the
  per-NEW-ref loop and early-returned when every ref was already hashed — so an
  admin WIDENING the Hamming threshold had zero effect on already-hashed images
  and "Rescan all" was a matching no-op once everything was hashed. Decoupled
  matching from hashing: extracted the match/flag rule into a shared
  `flagMatchesForHash()` and added a standalone `rematchAllVendorImages()` that
  re-queries EVERY non-demo hashed ref (straight from `vendor_image_hashes`, no
  R2 GET / re-decode) and re-matches it against the whole non-demo hash set at
  the CURRENT threshold, upserting flags. `rescanAllVendorImages()` now runs this
  re-match pass after hashing, and the admin "Rescan all" action + page banner
  surface the re-match count. The `(flagged_r2_ref, source_r2_ref)` dedup is
  preserved, so re-runs/widening only ADD newly-qualifying pairs — never
  duplicate a flag.

- **Sample-event seed re-introduced the zero-Pro gap on re-seed.**
  `scripts/seed-sample-event-maria-jose.sql` set visibility + linked vendor IDs
  but never `tier_state`, so the ~38 demo vendor_profiles inserted at the default
  `tier_state='free'` and a fresh re-seed lost the style-twin chips + editorial
  credits (both Pro/Enterprise-gated). Appended the same `UPDATE … SET
  tier_state='pro' WHERE business_name IN (…)` block migration 20270331300000
  uses (5 picks · one per key category · demo-only · idempotent) so the seed
  alone fully provisions the Real Story.

- **Sample leaked into the public weddings sitemap.**
  `app/sitemap-weddings.xml/route.ts` looped ALL showcases and emitted `s.href`,
  which now includes the Maria & Jose SAMPLE (a future-dated 2026-12-12 demo
  `/[slug]`) to search engines. Filtered samples out of the real-editorial loop
  (`!s.isSample`); the sample is surfaced only via the curated `/realstories/
  [slug]` fallback path, and only when no real consented editorial exists. Added
  a `clampLastmod()` so no `<lastmod>` is ever a future date. Updated the
  now-stale header comment.

SPEC IMPACT: None — fix-forward correctness on already-merged code (admin
re-match, demo seed provisioning, sitemap honesty). No schema, SKU, pricing, or
flow change; thresholds remain admin-managed.
