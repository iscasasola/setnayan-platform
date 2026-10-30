## 2026-10-30 · fix(event-settings): Event Details is combined into Home's ⚙ Event Settings; the ☰'s event mark opens it

What the owner said on the live iPhone app: *"tapping monogram not working"*, then *"no. that shoud be inside home settings"*, then *"move them all in the event settings"*, then *"event details showed on desktop view but not on mobile view. and it was already supposed to be gone because the were suppose to combine the event details and event settings together on the event settings"*. This build finishes what DECISION_LOG already ruled on 2026-10-26: "FINAL STRUCTURE" (2), "EACH MENU HAS ITS OWN SETTINGS" (2) and "ACCESS LIVES IN HOME › EVENT SETTINGS ONLY".

**Why the monogram tap did nothing.** In the ☰ rail (`event-rail-context.tsx`) the event's mark was a plain `div` with no link. It had been left that way on purpose since 2026-10-23, when the rail's "⚙ Event settings" line was removed. The rail also drops the whole `event` group, so the `personalization` → `/details` row that `lib/customer-menu.ts` still builds (with a stale comment saying it was "drawn AS the name") was not drawn anywhere. The only way into Event Details was the Countdown card. On desktop that card is labelled "Open Event Details". On the phone the tile has no such label.

**Fix.**
- **Home's ⚙ Event Settings sheet** now holds every part of Event Details that the couple edits. Each one is the same component, moved over, not rebuilt:
  - names · date · venues · parents (already in the sheet)
  - kind · area · guest estimate: `EventSettingsEditor`
  - Plan it myself: `PlanMyselfSwitch`
  - How guests get in: `OneCodeUnderGetIn`
  - People with access: `PeopleWithAccess`, the last section, with the same actions, saving at once
  - Put this away: `PutAwayCard`
- **One read per open.** The sheet's action reads all of these in a single `Promise.all`. A failed read says it failed; it never shows as empty.
- **Parts that were only displayed stay with their own menu.** The look, answers and Love Story stay in the Maker / Event Hub ⚙. Budget, suppliers and purchases stay in Suppliers. Times stay in Schedule.
- **The ☰'s event mark** is now a real link to `/dashboard/<id>?settings=1`. Its hit area is at least 44 px at every width (`.fd-rctx-door`). Tapping a link inside the open drawer now closes the drawer even when only the query changes.
- **The Countdown** (phone tile and desktop card alike) opens the sheet on its date for the couple. A helper, who has no ⚙, still goes to `/details`.
- **Opening the sheet from a link.** Home opens it from `?settings=1&row=…` and drops those query words when it closes. While the sheet is open, each fresh server render of Home (`renderKey`) re-reads the rows in place, so a person who was just added shows up.
- **Remove a person** from the sheet lands back on the sheet (`return_to=home`, `seatReturnPath`). Every "Change ›" link (`peopleWithAccessHref`) opens the sheet on access.
- **Old `/details` links** forward the couple to the sheet (`details/page.tsx`). Helpers still see the page, read-only, with their own access.

**Guards.**
- New: `access-is-in-event-settings.test.ts`.
- Re-aimed, with nothing deleted: `one-door-to-event-details`, which now pins "no door to the Event Details page at either width" plus the Countdown's phone and desktop doors; `reachable-without-typing-the-url`; `home-one-widget-per-page`; `event-details-shows-the-map`; `seat-return-path`; `people-with-access`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-30 "EVENT DETAILS IS COMBINED INTO HOME › EVENT SETTINGS". It quotes the owner's four lines and completes the 2026-10-26 rows; it changes nothing they ruled.
