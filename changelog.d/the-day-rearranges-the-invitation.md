## 2026-09-20 · feat(invitation): on the day, the page leads with the room

ARRIVAL slice 5 (design board "5 · On the day"), on top of #5781 (the page opens
on the mark). On the celebration's own day an identified guest's invitation
leads with what they need standing in a lobby — the programme, the pass, the
camera — and the planning rows step back behind them. Every other day the page
renders exactly as it does now.

**The delta is ORDER, not new UI.** Two blocks that already shipped are written
once and mounted in one of two slots:

| block | ordinarily | on the day |
|---|---|---|
| the invitation QR (the pass) | far below the vendor pitch | directly under the programme rail |
| the salutation ("Hi, <name>") | first thing in the body | behind the room |

- `apps/web/lib/day-of-lead.ts` — one pure rule, `resolveDayOfLead()`. It decides
  ORDER and nothing else.
- `apps/web/lib/the-day-rearranges-the-invitation.test.ts` — 16 subtests.

🕐 **Manila decides the day.** `manilaToday()` and `events.event_date` are both
Manila-local and are compared as `YYYY-MM-DD` STRINGS; there is no Date
arithmetic in the module. `new Date('YYYY-MM-DD')` is midnight UTC — the
previous day here — and would rearrange the invitation EIGHT HOURS EARLY, during
the evening before the wedding. A test states the instant: 2026-12-17T16:30Z is
the 18th in Manila and the 17th in UTC, and the two readings are asserted to
disagree.

🔒 **The lead is the calendar day, deliberately narrower than
`dayOfPhase === 'live'`** (T−12h..T+36h). For a Manila venue the calendar day
sits strictly inside that window, so the page can never rearrange itself while
it is not already in its day-of state — asserted against the shipped
`getDayOfPhase` at five instants rather than re-derived.

🚪 **A guest who declined is not handed a door pass.** The pass does not lead for
them; their QR still renders in its ordinary place, because it is also how
photographs are tagged to them and a decline is not a deletion.

♻️ **No second definition of "what is happening now."** The programme rail
already renders it from `pickTriggerNowNext` (lib/run-of-show.ts) — the same
resolver the day-of hub's `WhatsHappeningCard` reads. This slice only says that
on the day the rail comes first.

⛔ **Nothing here gates on the booking fee.** `lib/event-access-stage.ts` narrows
a SUPPLIER's view; guests are not gated, and a test forbids the import.

⚠️ **One existing guard was RE-POINTED, not relaxed.**
`the-invitation-opens-on-the-mark.test.ts` asserted
`SRC.indexOf('plan.greetingShouldRender') > hero` — the first mention anywhere in
the file. The salutation is now declared as `greetingBlock` above the `return`,
so that index moved above the hero while the rendered order did not change by a
pixel: a declaration is not a mount. The test now finds every MOUNT, asserts
both sit below the hero, and asserts there are exactly two — which forbids
strictly more than one index could (a lone index cannot see a second slot
appearing above the hero, nor a slot being dropped). Re-verified by sabotage: a
third salutation slot inserted above the hero turns it red.

**Verification** — typecheck `tsc --noEmit -p .` exit 0, 0 errors. 175/175 across
the 38 guards that read `site-body.tsx`, plus this slice's 16. Three sabotages,
each turning exactly one test red: the call site resolving the day in UTC → the
Manila call-site guard; dropping the declined check → the door-pass test;
dropping the ordinary pass slot → the both-slots-wired test.

**Not yet seen by a real guest on a real wedding day** — the day-of branch only
renders when `manilaToday()` equals an event's date, so it cannot be opened on
demand with a guest link today.

SPEC IMPACT: DECISION_LOG.md — arrival slice 5 recorded (order on the day;
Manila boundary; the pass withheld from a guest who declined).
