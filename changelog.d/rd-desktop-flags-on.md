## 2026-10-23 · feat(desktop): the desktop Maker columns and the guest Event Hub desktop are ON for everyone — the default flips in code

Owner, 23 Oct 2026 (DECISION_LOG "OWNER ANSWERS ON THE BUILD TRACKER", Q3 of `prototypes/desktop_layouts_2026-10-22.html`):
*turn on desktop Maker columns + desktop guest Event Hub for everyone, after one 1280 look at /maria-and-jose.* The look
was taken on a local production build with both on (shots in the PR).

- `lib/maker-desktop-columns-flag.ts` · `lib/guest-hub-desktop-flag.ts`: an UNSET (or blank) variable now means ON, so
  the switch ships through this PR instead of a dashboard edit. `NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED` and
  `NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED` stay as kill-switches read through the one shared parser (`false` · `0` ·
  `off` · `no`, any case → off for couples/guests; an internal viewer keeps them). Still one reader each
  (`flag-chokepoint-scan.test.ts`).
- ⚠ The desktop Maker columns are drawn only where the new Maker is (`stagesStudio && makerDesktopColumnsEnabled`), so
  they reach a couple only if `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED` is on in production too — unchanged here.
- ⚠ If either variable is already set in Vercel Production to anything other than an ON value, it now acts as the
  kill-switch and must be removed (or set to `true`) for the flip to take effect.
- Guards: `the-desktop-maker-never-reaches-a-phone.test.ts` and `the-guest-desktop-is-the-system-sheet.test.ts` now
  hold unset → ON, blank → ON, every kill-switch spelling → OFF, internal → ON; their phone halves are unchanged
  (the desk code stays lazy and inside `min-width` rules; a phone's first paint is byte-identical).

SPEC IMPACT: None — implements the 2026-10-23 DECISION_LOG row (Q3) already in the corpus.
