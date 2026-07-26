## 2026-07-26 · feat(live-studio): dual-stream — YouTube + Facebook watch links + setup guide

Owner-approved 2026-07-26. A couple can now stream to **YouTube and Facebook at
the same time** and show both doors on their event page.

**Zero streaming engineering.** OBS already window-captures the program output;
the free `obs-multi-rtmp` plugin fans that same output out to a second RTMP
destination. Setnayan sends no video bytes to either service, so this ships as a
pasted URL plus honest instructions — **no Meta API, no OAuth, no app review**.

- **New column `events.panood_watch_url_facebook`** (migration
  `20271006100000_events_facebook_watch_url.sql`), the exact mirror of
  `panood_watch_url`. Carries the **`GRANT UPDATE/INSERT … TO authenticated`**
  that PR #3715's computed allow-list requires for any column added after it —
  without it a host's save is a silent 42501 no-op. Granted to `authenticated`
  only (not `anon`, unlike its sibling): every write policy on `events` is
  `TO authenticated`, so an anon grant would be surface for zero capability. The
  migration self-verifies both halves in a post-condition.
- **`lib/facebook-watch.ts`** — a separate module from `lib/panood-watch.ts` so
  the YouTube validator's diff stays empty. Accepts `watch/?v=` · `video.php?v=`
  · `/<page>/videos/<id>` · `/reel/<id>` · `/share/v/<code>` · `fb.watch/<code>`
  on `facebook.com` / `www.` / `m.` / `web.`; rebuilds the canonical URL from
  validated parts, so query tails, fragments, userinfo and look-alike hosts
  cannot survive. Rejects everything else.
- **`lib/watch-live-links.ts`** — one reduction shared by `/[slug]` and
  `/[slug]/hub`: YouTube only → unchanged · both → embed + both links · Facebook
  only → link, no embed · neither → nothing. Both values are **re-validated on
  read**, so a value PATCHed straight into the column through PostgREST renders
  nothing instead of reaching an href.
- **Facebook is a LINK, never an iframe.** The only Meta embed is a third-party
  Meta frame with Meta cookies on a public wedding page, and `facebook.com` is
  deliberately absent from `next.config.ts` `frame-src`. A test pins all three:
  the component, the whole app tree, and the CSP.
- **Mandatory honesty:** `FACEBOOK_REPLAY_WARNING` — "Facebook deletes live
  replays after about 30 days; your YouTube stream is the copy that lasts" —
  renders unconditionally on both couple-facing setup surfaces, never behind a
  disclosure. Guests get no warning by design: their Facebook link only exists
  during the live window, and the surfaces that outlive the day (recap, editorial
  "Watch the Film") stay YouTube-only.
- **Setup guide** (collapsed, five steps) on both surfaces: install
  `obs-multi-rtmp`, leave YouTube where it is, paste Facebook's server URL +
  stream key into a second target, start both — and plan for roughly double the
  upload, so test at the venue on the venue's connection first.
- Wired into BOTH setup surfaces — the Wave 8 controller `SetupSheet`
  (`/panood/control/[eventId]`) and the legacy `/studio/panood/setup` — through
  one shared `FacebookDualStreamCard`, so the copy cannot drift.
- The guest hub now reuses `/[slug]`'s `WatchLiveBlock` instead of a near-copy of
  its markup, and reads the watch URLs through a tolerant helper rather than the
  big event `select` (a not-yet-migrated column would otherwise 42703 that select
  and 404 the whole hub).

Tests: `lib/facebook-watch.test.ts` (accept/reject/canonicalisation, warning
copy, guide content) · `lib/watch-live-links.test.ts` (both / one / neither /
forged) · `app/[slug]/_components/watch-live-block.test.ts` (no Facebook iframe
anywhere, CSP pinned) · `tests/db/facebook-watch-url-grant.db.test.ts` (the
#3715 grant trap, with an un-granted probe column as the differential control).

SPEC IMPACT: `09_Panood_Feature_Specification.md` + `Live_Studio_Unified_Spec_2026-07-25.md`
— Live Studio delivery gains an optional second destination (Facebook), documented
as an OBS-side fan-out with a ~30-day Meta replay-retention caveat; YouTube remains
the archival copy. `DECISION_LOG.md` row 2026-07-26.
