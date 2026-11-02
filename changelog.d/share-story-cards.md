# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-16 · feat(sharing): story-sized recap share card + Save-to-Stories button (IG/TikTok file share)

Instagram feed, IG/FB Stories, and TikTok don't accept web-URL shares — they need an actual FILE pushed through the mobile native share sheet. The couple's Auto-Recap page (`/[slug]/recap`) only offered URL shares (Facebook / Pinterest / copy). This gives the recap a postable file-asset so the couple can drop the day straight into a story.

- **Recap OG route now format-aware** (`app/api/og/recap/[slug]/route.ts`): mirrors `app/api/og/manifesto/route.ts` — accepts `?format=og|square|story` (`og` 1200×630 unchanged default · `square` 1080×1080 feed · `story` 1080×1920 9:16). Unknown/absent format → `og`. Same publish gate reused untouched (`isRecapPublished`) — an unknown slug or unpublished recap still 302s to the static brand card, never a 500, never a leak. Same public-safe data (curated / wall-safe hero + wall-approved voice count).
- **Recap card renderer parametrized** (`lib/social/recap-card.tsx`): `renderRecapOgJpeg(input, format = 'og')` — a per-format `DIMS` map scales both the branded (no-photo) `cardTree` and the photo-overlay `photoOverlayTree`; the hero is `sharp`-resized to the target w×h. `og` reproduces the original 1200×630 byte-for-byte (default arg → callers unchanged besides the route).
- **Watermark (sign-off #4)**: the story/square photo cards are Setnayan-COMPOSED artifacts (our frame, type and lockup around a public-safe hero), so the photo-overlay variant carries a subtle "made with Setnayan" maker mark. On-policy — the mark rides the Setnayan card chrome, never stamped onto the couple's raw photo. The branded card is Setnayan chrome top-to-bottom already, so its existing SETNAYAN wordmark IS the lockup (no redundant second mark). `og` is unchanged.
- **"Save story card" button** (`app/[slug]/recap/_components/save-story-card-button.tsx`, new): fetches `…/api/og/recap/[slug]?format=story` and hands it to `lib/save-to-device.ts` `saveImageToDevice` → native share sheet on mobile (Instagram / TikTok / Stories), download on desktop. Placed alongside the existing FB / Pinterest / copy pills in `RecapClosing` (`app/[slug]/recap/page.tsx`) without disrupting them — URL-share/copy still lead; this adds the file-asset path.

Verified: `tsc --noEmit` + `next lint` clean; the manifesto pipeline and the actual recap renderer both produce valid 1080×1920 / 1080×1080 JPEGs (satori + sharp, bundled static fonts). No migration, no schema, no new deps.

SPEC IMPACT: Implements `Social_Share_Settings_Council_Verdict_2026-07-16.md` sign-offs #3 (story asset) + #4 (watermark on Setnayan-rendered cards only). DECISION_LOG note added.
