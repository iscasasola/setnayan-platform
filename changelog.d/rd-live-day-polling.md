## 2026-10-18 · perf(day-of): guest phones stop hammering the database on the day

Owner, 2026-10-18: "make sure app will not collapse when a lot of users are … connecting to the event". Measured in a
lab (counting stand-in for Supabase, WebKit iPhone 13): one guest's open hub cost the database 34–50 requests a minute,
and every guest added the same again. After: a guest's polls read the event's SHARED answer, so the database cost is per
EVENT, not per phone — 10 guests on the hub went from ~41 to ~8 requests per guest per minute, and it keeps falling as
guests join.

- `lib/live-day-cache.ts` — `rememberedLiveRead` (rememberedGlobalRead's pattern, per event): one answer per event per
  window, a refusal or an unmeasured answer never shared (`notRemembered`), an expired answer never handed out (that
  caller reads; concurrent callers share the read). `liveEdgeHeaders`: CDN window in `Vercel-CDN-Cache-Control`,
  browser `max-age=0, must-revalidate`. Polls send no request cache directive (`no-store` made `next dev` skip the
  data cache and may make a CDN skip too).
- Photo wall feed `/[slug]/live-wall`: remembered per event, only an OPEN wall shared (a 404 stops the block for good);
  a failed event read is a 503. Block polls 25 s ± 20 %.
- Watch link `/api/live/[slug]/watch`: one event read, broadcast row only when no link, remembered + CDN; a hidden phone
  does not poll.
- NEW `/[slug]/live-pulse` + `useEventPulse`: hub, seat, find-my-table and find-seat re-draw only when the event's
  stamp (or the guest's own arrival / photo tag, by a one-way key) moved — instead of a full render every 45 s. 12 s
  ± 20 %, visible + on the day only, 3 misses → one full refresh, back after 9+ min away → one re-draw. Lab walk: a
  renamed table showed in 10.6 s, the guest's own check-in in 12.1 s, no reload. Hub starts its reads together.
- Run-of-show: a guest's header applies the realtime payload behind the guests' fence (`rowGuestsMaySee`) instead of
  every phone re-reading on every advance; re-reads wait a random moment.
- Announcement: one read per event (the writer clears it before the ping), ping asks spread over 3 s, a pocketed
  phone no longer pulls.
- Guard: `lib/live-day-answers-are-shared.test.ts`.

SPEC IMPACT: None (no product behaviour or copy changed; freshness on the day is ~10–15 s for watched facts; a
purchase / new e-gift destination / venue booking / published album during the event shows at the next watched change
or on return to the tab — named in lib/event-pulse.server.ts).
