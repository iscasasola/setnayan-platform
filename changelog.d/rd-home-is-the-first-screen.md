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

Reported in the PR, not built: content that now has no consolidated home (the
decisions board's book / pick / settle / fill-a-role groups, the dated "Coming
up" list, the journey-rail stage line, "% locked in" for couples without
Setnayan AI, supplier-handover "Meanwhile" notice, the Hosts / helper-activity
card).

SPEC IMPACT: None.
