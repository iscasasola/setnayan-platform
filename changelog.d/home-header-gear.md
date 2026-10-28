## 2026-10-29 · feat(home): Home's ⚙ shows at rest — it opens Event Settings (names · date · venues · parents)

Owner, 29 Oct, verbatim: *"on event dashboard> home the header does not show the settings icon like the other pages
with settings icon. keep it there"*.

- **Before:** Home's ⚙ lived inside the pinned line and was `invisible` until the cover band stuck (27 Oct), and it was
  a link to Event Details. At rest the Home drew no ⚙, while Guests · Suppliers · Memories each show theirs at the
  right end of their first row.
- **Now:** ONE `MenuSettingsButton menu="home"` (the shared ⚙ — same component, same 44 px; drawn in the cover's own
  ink, `.home-cover-ab`) at the right end of the cover band's bottom 52 px — at rest it ends the name's row, pinned it
  ends `<names> · <date> · ⚙`, the same spot, so it never moves (`home-settings-gear.tsx`). The couple's Home only
  (`eventSettings={viewerMemberType === 'couple'}`); the loading screen draws none.
- **It opens Event Settings** (DECISION_LOG 2026-10-27 "APPROVED — SETTINGS PER MENU": *"Home's header ⚙ = Event
  Settings only"*; "INFO SPLITS BY WHAT IT IS ABOUT": names · date · venues · parents) — a sheet, in place, whose rows
  are the editors those facts already have, never a second one: `yourEventFactEditors` (Names · Date · Venues — the
  builder the Maker's Details and Event Details' rows mount) and `ParentCards` (the Maker's parents list + add), with
  the Maker's own Undo · Apply (`HubDraftDock`) on top, as Event Details carries it (these facts save into the Event
  Hub draft and go live at Apply). Composed once in `event-settings-rows.tsx`.
- **Fewest requests:** nothing is read with Home. One action (`openEventSettings`, `open-event-settings.tsx`) reads the
  rows when the ⚙ is pressed — couple only, on the session, the draft laid over live; a save that asks for its one
  refresh re-reads the rows in place without blanking them (a save never resets the screen). +1 server action (budget
  1225/1225).
- **The Countdown stays Home's one door to Event Details** — the band now draws no link at all.
- **Registry:** `SETTINGS_ENTRY.home` (`door: 'cover-gear'`, sheet "Event settings", live) in `lib/menu-settings.ts`.
- **Lab:** `/dev/home-lab` draws the ⚙ and its sheet on a fixture wedding (`lab-event-settings.tsx`, no database).
- **Guards:** `every-menu-has-one-settings-button.test.ts` test 4 flipped from "Home mounts no ⚙" to "Home RENDERS its
  one ⚙ — Event Settings — on the cover, at its right end, never hidden; mounted once; a helper's Home renders none"
  (4 sabotages red); `the-pinned-row-is-one-row.test.ts` Home test (the ⚙ is the band's one control, drawn at rest,
  the pinned line leaves it room); `one-door-to-event-details.test.ts` test 2 (the band draws no link; its ⚙ is a
  button opening a sheet); `home-cover.test.ts` follows the prop. Ugat screens map regenerated (the Home's old
  `/details` door is gone).

SPECIAL NOTE (flag for the owner): the 27 Oct build note kept the ⚙ hidden at rest "so the Countdown stays the one door";
the owner's 29 Oct word supersedes that. Event Settings here holds the four facts the controller named; money and who
helps still live on Event Details (the plan's step E — not built here).

SPEC IMPACT: DECISION_LOG row 2026-10-29 "HOME'S ⚙ SHOWS AT REST — IT OPENS EVENT SETTINGS" (amends the 2026-10-27
"EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO" build note: Home's ⚙ is no longer hidden at rest, and opens the Event Settings
sheet instead of Event Details).
