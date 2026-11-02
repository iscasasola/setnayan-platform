## 2026-07-09 · feat(overview): Setnayan-AI decision cockpit behind a dormant flag

Item R4 — adds the Setnayan-AI DECISION COCKPIT to the couple Overview
(`apps/web/app/dashboard/[eventId]/page.tsx`), gated behind a DORMANT rollout
flag so prod is untouched until go-live.

- New `apps/web/lib/setnayan-ai-cockpit-flag.ts` — `cockpitEnabled()` reads
  `NEXT_PUBLIC_SETNAYAN_AI_COCKPIT === '1'`, DEFAULT OFF (life-story-flag.ts
  pattern). The cockpit renders ONLY when true; with the flag off the Overview
  is byte-identical to the R3 status board (built on origin/claude/overview-density).
- New `apps/web/lib/setnayan-ai-cockpit.ts` — pure, I/O-free `buildCockpitModel`
  turning already-loaded Overview data into `{ briefing, decisions[], upcoming[] }`.
  Decisions = quotes-awaiting-pick (options saved, none locked) + the single
  most-urgent unbooked category (reuses `pickTodaysOneThing`) + unconfirmed
  principal sponsors. Unpaid-orders decisions are OMITTED (the Overview loads
  only paid/fulfilled orders — no new query added). Upcoming = wedding day + top
  task's hard-floor + paperwork due/expiry, time-ordered. Unit-tested
  (`setnayan-ai-cockpit.test.ts`, 9 cases, node:test).
- New `apps/web/app/dashboard/[eventId]/_components/suri-cockpit.tsx` — the
  presentational hero + two rails (wine/champagne, matches OverviewAtAGlance).
- No new DB round-trips; no change to `event-countdown-header.tsx` or R3's
  `overview-at-a-glance.tsx`.

SPEC IMPACT: None. Dormant flag (default OFF) — no live-surface, pricing, SKU, or
schema change. The Setnayan-AI product taxonomy (Suri briefing / Decisions /
What's-next) was owner-approved 2026-07-09; the code stays inert until the env
flag is flipped after preview QA.
