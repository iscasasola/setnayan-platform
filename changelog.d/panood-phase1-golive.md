## 2026-06-26 · feat(panood): Phase 1 — FREE single-cam livestream (one-tap Go live)

Panood Phase 1 + the free-vs-paid packaging the owner locked 2026-06-26:
**single-cam livestream = FREE · multi-cam controller + overlays = PAID (future).**

- **One-tap "Go live"** — a `goLivePanood` server action resurrects the dead
  `lib/panood-youtube.ts` lifecycle (createBroadcast → createStream → bind),
  persists via a new `createPanoodBroadcast`, writes `events.panood_watch_url`,
  and surfaces the OBS RTMP server + stream key (server-side, host-gated). The
  existing event-page embed lights up. `endPanoodBroadcast` stops it. The couple
  still streams in from OBS / the YouTube app (multi-cam done in OBS for now).
- **FREE single-cam** — removed the `eventSkuActive(PANOOD_SYSTEM)` paywall from
  the go-live action, the public `app/[slug]` Watch-Live embed (now shows on any
  `panood_watch_url`), and the setup Go-live card; the Studio catalog entry is
  `tier:'free'`. `PANOOD_SYSTEM` (serviceKey kept) is **reserved for the future
  paid multicam + overlays tier** — those surfaces stay framed "coming/paid".
  Host-only auth (`requireHostMembership`) is preserved; LIVE_WALL / PAPIC_GUEST /
  SDE paywalls untouched; no stream_key leaks to any public path.
- **Migration hygiene** — moved the real `panood_broadcasts` DDL from a stray
  `apps/supabase/migrations/` dir (never read by `db push`, from PR #2106) into
  the canonical `supabase/migrations/` path, fully idempotent. The table already
  exists in prod (verified via the live DB), so this is a no-op there — it fixes
  fresh-DB reproducibility only.

Owner external action to unlock one-tap auto-create for all couples: file the
Google YouTube OAuth verified-app review (1–4wk). The paste-your-watch-URL path
works free today without it.

SPEC IMPACT: DECISION_LOG.md (free single-cam / paid multicam packaging lock,
2026-06-26); Panood_Multicam_Architecture_2026-06-26.md.
