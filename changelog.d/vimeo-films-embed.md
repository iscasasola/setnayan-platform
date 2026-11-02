## 2026-07-03 · feat(vendor-website): Films rack accepts Vimeo links alongside YouTube

The Enterprise "Films" video rack on the public vendor microsite (`/v/[slug]`)
and its My-Shop editor now accept **Vimeo** links in addition to YouTube.
Owner-decided 2026-07-03: providers are **YouTube + Vimeo ONLY** — Google Drive
was explicitly declined and is rejected via the existing invalid-link path.

- `lib/vendor-microsite.ts` — new `parseVideoRef()` returns a structured
  `{ provider: 'youtube' | 'vimeo', id, hash? } | null`. YouTube parsing is
  delegated to the existing `parseYouTubeId()` (bare 11-char ids + all URL
  forms, unchanged). Vimeo forms handled: `vimeo.com/{id}`,
  `vimeo.com/{id}/{hash}` (unlisted share), `vimeo.com/video/{id}`,
  `player.vimeo.com/video/{id}[?h={hash}]`, `vimeo.com/channels/{x}/{id}`,
  `vimeo.com/groups/{x}/videos/{id}`, and bare numeric ids. Host is matched at a
  strict boundary so look-alikes (`evilvimeo.com`, `vimeo.com.evil.io`) and
  Drive links are rejected. Backward-compat: a bare 11-char token still resolves
  to YouTube. New `serializeVideoRef`/`deserializeVideoRef` store Vimeo as
  provider-prefixed `vimeo:{id}[:{hash}]` and treat bare 11-char legacy rows as
  YouTube — **no schema migration** (reuses `vendor_profiles.microsite_video_ids`
  from migration `20270505905788`). `videoEmbedUrl` emits youtube-nocookie for
  YouTube and `player.vimeo.com/video/{id}?dnt=1[&h={hash}]` for Vimeo.
  `videoThumb` returns YouTube's deterministic thumb and `null` for Vimeo;
  `fetchVimeoThumb` resolves the Vimeo poster via Vimeo's own oEmbed endpoint
  with a 7-day Next fetch cache, degrading to `null` on any failure (an outage
  never breaks the page). `VendorMicrosite.videoIds: string[]` became
  `videos: VideoRef[]`.
- Cap raised **6 → 30** (`MICROSITE_VIDEOS_MAX`, owner 2026-07-03: "up to 30
  different video links from YouTube and Vimeo"). Flows through the action cap +
  editor limits/copy automatically.
- `app/vendor-dashboard/actions.ts` — the `microsite_videos` case (unchanged
  `ENTERPRISE_WEBSITE_FIELDS` / `micrositeCan().isEnterprise` gate, now cap 30)
  normalizes each submitted value through `parseVideoRef`, serializes
  provider-prefixed, and dedupes across providers by the serialized key.
- `app/v/[slug]/page.tsx` + new `_components/films-rack.tsx` — at up to 30 items
  the public rack renders **click-to-play thumbnail facades**, NOT live iframes:
  a poster + play glyph per card, injecting the real youtube-nocookie /
  player.vimeo.com iframe only when the visitor clicks. It shows the first ~6
  (two rows) with a quiet "Show all films (N)" expander that reveals the rest
  client-side. Server resolves each card's poster (YouTube deterministic; Vimeo
  via 7-day-cached oEmbed) **concurrently** (`Promise.all`) so 30 Vimeo links add
  no serial latency, degrading to a poster-less facade on failure. All
  Enterprise / downgrade-revert / auto-hide gating is untouched.
- `app/vendor-dashboard/shop/page.tsx` + `_components/website-editor.tsx` — the
  editor paste field accepts both providers; helper/error/teaser copy now reads
  "YouTube or Vimeo". The thumb grid renders Vimeo entries with a tasteful
  poster-less fallback tile (dark tile, centered play glyph, "Vimeo" label) when
  no oEmbed poster is available; Vimeo posters are prefetched server-side in the
  shop page (Enterprise only).
- CSP unchanged: `next.config.ts` ships only `frame-ancestors 'self'` (no
  `frame-src`/host allowlist), so no allowlist edit is needed for
  `player.vimeo.com` — verified, not assumed.
- Tests: new `lib/vendor-microsite.test.ts` (34 cases) — the 10 original YouTube
  cases stay green, plus ≥8 Vimeo forms, bare-11-char backward-compat, Google
  Drive + look-alike-host + arbitrary-URL rejections, and serialize/deserialize
  round-trips. Full unit suite 898/898 green; typecheck + lint clean.

SPEC IMPACT: None in iteration specs — provider decision (YouTube+Vimeo; Google Drive declined) logged in corpus DECISION_LOG.md by the orchestrating session.
