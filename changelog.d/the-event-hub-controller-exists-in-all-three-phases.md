## 2026-09-02 · feat(event-hub): the controller exists, and it exists in all three phases

**EH1 of the Event Hub stream.** `app/dashboard/[eventId]/launch/page.tsx` already gathered both
halves of the couple's public address — the three day-of services AND the four public stages via
`PUBLIC_SITE_PAGES` — and it was written for the wedding day. This is a PROMOTION, a RESTRUCTURE
and a STAGE. No new route, no new table, no new engine, no migration.

- **NEW `lib/event-hub-control.ts`** — pure resolvers, shaped after `lib/live-studio-control.ts` so
  the page and the tests share one source of truth. `resolveHubStage` (which of the four public
  pages the link is showing) · `resolveHubPhase` (has the celebration happened) · `resolveHubFacts`
  (the four facts, each carrying `known`) · `resolveHubNextStep` · `hubOffersAllowed`.
- **The page takes the control-centre order** — S1 the stage · S2 the four facts · S3 one next step
  · S4 the parts (four stages, then three services) · S5 set once · S7 offers last, with a dashed
  line naming what deliberately lives elsewhere.
- **⛔ No offers on the event day.** `hubOffersAllowed` is true only in `plan`: on the day the upsell
  branch collapses to nothing, and after the day the row closes with the shipped "Event over" chip
  rather than selling a night that has finished. No confirmation dialog on any day-of verb.
- **Unread ≠ empty, at the RENDER.** The `events` read and the guest read both carry `measured`, so
  a refused read blanks the fact instead of printing "0 of 0 in" or counting down to a null date.
  A refused read no longer yields an instruction either — "add the people you are inviting" to a
  couple with 180 names is the same lie wearing a verb. Copies `lib/guests.ts` +
  `guests-read-is-honest.test.ts`.
- **🚨 The two-resolver trap is now held shut by a test, not a comment.** `getLifecyclePhase` and
  `getMenuLifecyclePhase` disagree for every couple every day of the months before the wedding
  (107 days out → `save_the_date`/`plan`; 31 days out → `rsvp`/`plan`), and again whenever a host
  has set `cleared_at`. `event-hub-control.test.ts` pins both disagreements; swapping the resolvers
  in either selector turns it red.
- Membership now asks `isHostMemberType` (`app/[slug]/_lib/host-scope.ts`) instead of re-typing the
  `['couple','coordinator']` literal — one definition of "host", which is the defect that let a
  guest row count as a host once already.

**NEXT CONCRETE STEP** (if this lands and the stream continues): EH3 owns `lib/customer-menu.ts` and
gives this page one "Event Hub" slot in all three phase rosters — the page is now correct in all
three, but only the day-of roster still links to it. EH2 owns View-as; EH4 the per-channel upgrade
offer; EH5 the editorial workroom. S6 (the money meter) is deliberately not built here — see
§ 5.1 rule 5, a number that governs money must have a home.

SPEC IMPACT: None. The design this implements (`EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 2, § 3.3,
§ 4, § 6.3) is already in the corpus and is unchanged by the build; every open owner decision in its
§ 7 stays open.
