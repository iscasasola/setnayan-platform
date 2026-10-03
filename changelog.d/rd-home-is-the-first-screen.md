## 2026-10-03 · fix(home): Home is the approved first screen only — the old tiles under it are gone

Owner on cale-ice's desktop Home: *"home is still not fixed?"*. The first screen
(cover · Next · Edit your Event Hub · three numbers · money line · Your
services) sat in a narrow centred column with the whole old dashboard
(`<EventDashboard>`) mounted under it in a second, wider layout — "The wedding
day", Sai briefing, The Watch, Needs you this week, Schedule, Papic, Messages,
and below them the decisions board, Coming up, Meanwhile, Around your event and
the journey rail — repeating the screen above it. DECISION_LOG "THE SIMPLE PHONE
APP — APPROVED" and "HOME ON DESKTOP SHOWS EACH THING ONCE" say replace, not
stack.

- `app/dashboard/[eventId]/page.tsx`: the plan branch renders `homeFirstScreen`
  and nothing else. `<EventDashboard>` is now mounted only by the two receded
  views (day-of, after the day), each behind its own "Planning tools"
  disclosure. The plan-phase nudges that rode under the screen
  (`SetDateNudge`, `PapicReadyNudge`, the comeback offer, Nikah essentials, tea
  ceremony, Plan next year) are no longer drawn on it.
- `home-first-screen.tsx`: one column, `max-w-xl`, `lg:max-w-3xl` on desktop
  (same Home, just wider); the "See all" link and the `#home-all` anchor are
  gone. The "You are on track" card now opens the checklist ("Open your
  checklist") instead of scrolling to a section that no longer exists — which
  also keeps `/checklist` reachable (its only in-app door was the decisions
  board's header).
- `event-dashboard.tsx` / `lib/home-first-screen.ts`: the `firstScreenAbove`
  prop and `firstScreenRepeats` are deleted — nothing mounts the dashboard under
  a first screen any more, so every gate was always off.
- Content that had no other home keeps its smallest form, on the existing
  "Your services" row (no tile re-added):
  - **Nikah essentials** (the only editor of `mahr_description` and
    `gender_separation`) moved, unchanged, to a new page
    `/dashboard/[eventId]/nikah`; a Muslim wedding's row reads "Nikah essentials
    · N of 4 in place" (count shared with the card via `lib/nikah-essentials.ts`;
    a refused guest read prints "—"). The imam read moved to
    `_components/nikah-imam.ts`, one reader for both.
  - **The Setnayan AI comeback offer** (its only surface was the removed
    overlay): while the couple's window is open the AI row reads "Comeback price
    · Nh left" and opens the Setnayan AI page.
- Tests: `the-home-leads-with-one-next.test.ts` now holds the plan branch to the
  first screen alone (source + rendered), the one-column desktop width, and a
  route check that each removed tile's content is reachable at its home. Port
  baseline regenerated (the Nikah card left `/dashboard/[eventId]`); Root map
  screens regenerated.

Owner "yes" (2026-10-03) on what the first-screen-only Home left without a page:
- **"What's next"**: ONE 48px row, no caption, on the first screen (above Your
  services) opens a sheet (`?sheet=next`, `whats-next-sheet.tsx`) holding the
  dashboard's own ranked decisions list (with "Today's one thing"), then "Coming
  up" — `<EventDashboard only="whatsnext">`, the same components and data, moved.
  The decisions are read only while the sheet is open.
- **Dropped, code and pinning tests deleted**: the journey-rail stage line
  (`journey-rail.tsx`, `lib/progress-stages.ts`, `lib/stage-mark.ts` and their
  tests) and the dashboard's "% locked in" bar (Suppliers shows what is booked;
  Setnayan AI still states the share on its own page).
- **Supplier delivery notice**: already a notification — `vendorPostHandover`
  emits `schedule_suggestion` ("… delivered your handover", opens the supplier's
  workspace) to the couple. Reused; none added; now pinned by a test.
- The Hosts card lives in the guest list's Access column / a helper's guest card.
- **Merged with batch 7 (#6309, 2026-10-03).** Main's wording wins (d19 "booked",
  d16 "supplier"); main's handed-down facts (`daysOut`, `guestStats`,
  `guardMoney` from `lib/home-facts.ts`) now feed the What's next sheet's
  `<EventDashboard only="whatsnext">` too; main's "% booked" bar stays deleted
  (owner 2026-10-03). The Your services row takes main's plain-name-first names
  (`SERVICE_NAMES`, d17); the Nikah row carries no brand line and its name is
  one constant (`NIKAH_NAME`) shared with its page. Port baseline and Root map
  screens regenerated with their generators.

SPEC IMPACT: None.
