## 2026-10-21 · feat(supplier): the bar is Today · Customers · Shop · Hub — More leaves; a helper gets the Hub on the day; the empty-day Hub lists the next events with their fee locks

Owner, verbatim, 21 Oct: *"Yes to all"* — items 5–6 of the supplier-dashboard audit
(`shots-2026-10-21/supplier-dash-audit/AUDIT.md`). Part 2 of 2 (stacked on part 1). **Supersedes
DECISION_LOG 2026-10-01 answer 1 (the bar ends in More) and 2026-10-08 answer 1 (More = Event Hub ·
Settings · More tools).**

- **5 · The supplier bar is Today · Customers · Shop · Hub** — no More, the couple's four (#6725), on the
  phone, in the iPhone app (store shell — no tab is a web-only door) and on the laptop rail (same four words).
  Hub = the Event Hub, under its old keys (`onday` on the bar, `on-the-day` on the rail) so the admin registry
  slots name it again; both slots' default word is now **Hub** (the room keeps its title, Event Hub).
  `vendor.sidebar.more` and `vendor.bottom-nav.more` slots removed. Settings lives under the profile picture
  (already there). `/vendor-dashboard/more` is a redirect stub to Settings; `lib/vendor-more-rows.ts` is gone.
- **On a day with no event the Hub lists the next booked events first ("Your next events")**, each LOCKED until
  its booking fee is paid: the row says Locked, carries the gate's own sentence (`feeLockCopy`) and the bill's pay
  link, and offers no Set up. One read for the list through the shipped `resolveEventFeeGates` (it had no caller
  until now); no price in code. Past days keep their own list below ("Earlier").
- **6 · A helper (agent / viewer) gets the Hub on an event day**, beside Today and Customers — bar and rail. It adds
  the door, not access: `/on-the-day` was already open to a teammate (Today's "Run the day" card). The layout reads
  "is one of this shop's days today" for a helper only, with the Hub's own reader, and FAILS CLOSED.
- Pure lifts for the guards: `vendorBarItems` (the bar's resolver), `vendorScopedBarKeys` / `vendorScopedRailKeys`,
  `hasDayToday` / `phTodayIso`. The stale five-tab docblock on `vendor-bottom-nav.tsx` is replaced (audit item 9).
- Guards: `vendor-bar-is-four.test.ts` (the four on the bar, in the app shell, with the registry's words, on the
  rail; the helper's bar on and off the day; the layout's wiring; **every route the old More reached is still
  reachable** from the new shape — the old map frozen in the test); `the-empty-hub-lists-the-next-events.test.ts`
  (rendered rows: locked = gate words + pay link + no Set up). The two tests that pinned the old bar —
  `vendor-nav-boundary.test.ts` and `vendor-rail-context.test.ts` — were updated ON PURPOSE, the ruling cited, as
  strict as before. 13 sabotage runs, each red (one found a hole in the first cut of the reachability guard, fixed).
- Baselines regenerated: port-control, ugat screens.

SPEC IMPACT: DECISION_LOG row 2026-10-21 "SUPPLIER BAR — TODAY · CUSTOMERS · SHOP · HUB" (owner "Yes to all").
