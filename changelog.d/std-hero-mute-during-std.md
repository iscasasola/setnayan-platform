## 2026-06-22 · fix(std): don't render the couple's Hero video during the Save-the-Date film (audio leak for hero-video couples)

A 10+ agent adversarial audit of the Save-the-Date audio state machine found a THIRD audio source that four prior fixes (#2030/#2043/#2049/#2063 — all on the STD clip `videoElRef`) never touched: the couple's **Hero video** (`HeroBackgroundMedia`, `<video autoPlay muted loop>`). It was gated by `hasHeroMedia && !showEditorialPlaceholder` but **NOT** by `!showSaveTheDate`, so for a couple who uploaded a landing-page hero/living-hero video (`events.landing_page_hero_video_r2_key` — a separate upload from the STD clip's `std_media.videoKey`), that hero `<video>` mounts + autoplays + loops *during* the STD film — hidden behind the full-screen film (z-50) — and can play its embedded audio under the soundtrack ("video music while the veil is up"). The film visually covers it anyway, so rendering it during STD has no visual purpose.

**Fix:** gate the hero-media block (and its text-hero fallback) with `&& !showSaveTheDate` in both render paths (PublicLanding ~1683, InvitationSite ~2299 + 2336), mirroring how the floating `BackgroundMusic` player is already gated off during the film (`bgMusicUrl && !showSaveTheDate`). During STD the page renders its own hero via `SaveTheDateView`, so there's no gap.

⚠️ Note: this is NOT the cause on **cale-ice** — that event has no hero video (live page shows only the soundtrack `<audio>` + the STD clip `<video>`; media paths are site-music/std-background/std-video only). cale-ice's residual "video music" is almost certainly the **PWA service worker serving stale pre-#2063 JS** (the audit's Lens 5 confirmed #2063 correctly mutes the STD clip on desktop Chrome) — a hard reload / SW update is the fix there. This PR fixes the real latent bug for couples who DO have a hero video.

`HeroBackgroundMedia` is in a Server Component, so an imperative `el.muted=true` ref-callback isn't possible; the SSR `muted` attribute is present for the phases where the hero is intended to render (editorial/RSVP/event). Gating it off during STD removes the leak there.

No schema changes. No SKU changes.

SPEC IMPACT: `0024_save_the_date/` — the couple's landing-page hero media is suppressed during the Save-the-Date film phase (the film owns the screen + audio there). (Reference/history only.)
