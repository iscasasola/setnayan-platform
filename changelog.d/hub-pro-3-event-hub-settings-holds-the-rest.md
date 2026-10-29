## 2026-10-30 · feat(maker): Event Hub Pro slice 4 — ⚙ Event Hub settings holds the rest: Look · Your Event Hub · What guests see · E-Gifts

Builds the ⚙ sheet of the approved Event Hub Pro look redesign (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look
redesign)"; 2026-10-27 "LOOK MOVES TO EVENT HUB SETTINGS" · "INFO SPLITS BY WHAT IT IS ABOUT" · "STUDIO IS LOOK AND
WORDS ONLY"; 2026-10-26 "EACH MENU HAS ITS OWN SETTINGS"; prototype `prototypes/build-contracts-2026-10-30/event-hub-pro/`
"⚙ Settings"). Owner: *"Stages and the Studio will be on dropdown. move all other details on the settings."* Stacked on
slices 1 and 2.

The pinned row's ⚙ (slice 1) now opens ONE sheet grouped by topic, every control a shipped one, moved:

- **Look** — Background · Elements · Music: each opens the shipped Look editor on THAT section, in the Maker (the page
  its Studio card opened).
- **Your Event Hub** — the address · Go live · who can view · which version · Event Bar · the event QR (on/off, its look,
  Copy · Share · Download): Studio › Info's "More for guests" rows, OPEN. One builder for both places
  (`hubSettingsEditor`, maker-details.tsx), handed to the Maker with its late panels (`MakerLate.hubSettings`); the
  amber "these change right away" line is the group's ⓘ. While on its way / unreadable it SAYS so.
- **What guests see** — the shipped sheet, its row moved from Studio ▾ (the prototype's Q4, drawn as A).
- **E-Gifts** — Ways to give, with the line its Studio card says, opens the shipped E-Gifts page.
- One closing line: names, date, venues and parents are in Home › Event settings (never edited here).
- The work area no longer draws the old navigator's Go live · visibility · version · open-browse rows or its QR card in
  the sheet (one setting, one place) — only the Event Hub Pro line is its to add.

Guards: new `lib/the-hub-settings-sheet-holds-the-rest.test.ts`. Re-aimed: the-guests-see-sheet-is-lazy (1, 3: the row
is the ⚙'s), studio-info-wears-the-form-row (6: the fold wraps the shared body; the ⚙'s copy is open),
which-version-guests-see-is-one-control (3: the one builder), the-maker-keeps-the-page-on-a-phone,
the-maker-toolbars-lose-nothing.

SPEC IMPACT: builds the 2026-10-27 "LOOK MOVES TO EVENT HUB SETTINGS" and the Hub-address half of "INFO SPLITS BY WHAT IT
IS ABOUT" (both "NOTHING BUILT" until now) and the 30 Oct prototype's ⚙ sheet; takes the prototype's Q4 = A ("What guests
see" lives in the ⚙) as drawn — flag for the owner if he meant B. No new ruling.
