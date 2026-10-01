## 2026-10-01 · fix(home): each thing once under the new first screen

Owner, 2026-10-01 (DECISION_LOG "HOME ON DESKTOP SHOWS EACH THING ONCE"): *"you
updated the Home of that event but instead of changing it I see dupes on the
event."* The first screen had been added on top of the old tiles, so days to go,
coming / no reply and Paid / Still owing each rendered twice, and the Next card
sat beside "Needs you this week". When `<HomeFirstScreen>` is drawn directly above
`<EventDashboard>` (the Home's plan branch only), the dashboard no longer renders:
the wedding-day card's days-to-go numeral and the Sai briefing's "N days to go"
chip; the Guests tile; the "N guests haven't replied yet" row; the Budget tile
(when the first screen drew the money line); and the whole "Needs you this week"
tile when it would only say "nothing needs you" against the Next card's "You are
on track" (with open decisions it carries a count the first screen lacks, and
stays). Removed, not hidden behind a breakpoint; phone and desktop show the same
Home. The day-of and after-the-day mounts are unchanged. The Papic tile, date and
venue, % planned, overlays, journey rail and decisions board stay. Pure rule in
`firstScreenRepeats` (lib/home-first-screen.ts); guarded in
`the-home-leads-with-one-next.test.ts` (rendered first-screen counts + gate per
site, sites counted).

SPEC IMPACT: None.
