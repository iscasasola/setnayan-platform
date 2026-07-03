## 2026-07-03 · feat(vendor-website): Enterprise "Films" video portfolio (YouTube)

Gives Enterprise a distinct 4th-tier output (owner 2026-07-03). Enterprise vendors
paste YouTube links in My Shop → Website; the public `/v/[slug]` embeds them
(youtube-nocookie, lazy) as a playable "Films" rack.

- Migration `20270505905788` adds additive `vendor_profiles.microsite_video_ids text[]`
  (inherits the table's RLS — no new policy).
- `lib/vendor-microsite.ts`: `videoIds` on the microsite + `parseYouTubeId()`
  (watch/youtu.be/embed/shorts/live/bare-id → canonical 11-char id · 10/10 unit-tested),
  `youTubeEmbedUrl()` / `youTubeThumb()`, `MICROSITE_VIDEOS_MAX = 6`. Fetched in a
  SEPARATE defensive query so a not-yet-applied migration only empties the rack —
  never blanks the rest of the microsite.
- `updateVendorWebsiteField`: `microsite_videos` field + a new ENTERPRISE gate
  (`micrositeCan().isEnterprise`); normalizes/dedupes/caps server-side.
- Editor: a "Films" control (paste-link + thumbnail grid + remove) for Enterprise;
  a quiet "Enterprise" upgrade teaser for Pro.
- Public page: Enterprise-gated Films section (reverts on downgrade, data kept;
  auto-hidden when empty). CSP unaffected (only `frame-ancestors 'self'`).

SPEC IMPACT: new Enterprise-only website feature (video portfolio) — makes Enterprise
a real 4th output. Tier assignment (Enterprise-only) is owner-adjustable. Logged in
DECISION_LOG.md.
