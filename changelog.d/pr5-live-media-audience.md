## 2026-07-24 · feat(website): open-browse PR5 — live-media public gate + audience column

Open-browse PR5 privacy, parts (e) + (c). Migration `20270920050000`:

1. **`events.live_media_public BOOLEAN NOT NULL DEFAULT FALSE`** — livestream +
   Live Photo Wall are **guests-only by default**; the couple opts in to public
   (owner decision 2026-07-23). `resolveSiteBodyPlan` gains `liveMediaVisible`
   (`identity === 'guest' || live_media_public`), and `site-body.tsx` ANDs it
   onto the **two anonymous** live-render gates (`WatchLiveBlock` + `LiveWallBlock`
   — the cookie-less remote-relatives path). **LIVE on merge, not flag-dark:**
   every existing event defaults FALSE, so anonymous viewers stop seeing live
   media during the live window until the couple opts in. Guests (cookie holders)
   are unaffected; the guest tree never rendered these blocks. Toggle UI → PR9.
2. **`invitation_widgets.audience TEXT NOT NULL DEFAULT 'public'`**
   `CHECK (audience IN ('public','guests_only'))` — the per-widget who-can-see
   dial. **Inert** (zero readers until PR7 ANDs it with PR4's `mode`); **no
   backfill** (owner: public for everyone, per-couple dial).

Threaded `live_media_public` through `loadEventShell`'s SELECT + `EventRow`.
Golden matrix updated: `liveMediaVisible` proven guests-always / anonymous-opt-in
across all 4 phases (`site-body-plan.test.ts`, 12/12); the existing 11 goldens
are byte-unchanged (named-field asserts).

SPEC IMPACT: None — schema + a per-couple visibility gate; no SKU/pricing/feature
change. Live-media default-guests-only is the owner-decided posture.
