## 2026-10-18 · feat(maker-desk): the new Maker on a desktop — three columns, the phone untouched (area 1, part 1)

Owner rulings: 2026-10-07 "DESKTOP ADAPTATION APPROVED — ALL FIVE A" (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`),
2026-10-15 "DESKTOP MOVES AHEAD OF THE ADMIN DASHBOARD" and "DESKTOP COVERS THE WHOLE APP — FOUR AREAS, IN ORDER"
(area 1 = the Maker + the guest Event Hub). Dark for couples: `makerDesktopColumnsEnabled`
(`NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED`, or an internal viewer), so the owner checks it live while every couple
keeps today's desktop. Lab: `/dev/maker-lab?studio=1&desk=1`.

- From 1024 px the shell draws the NEW Maker (it drew the old one): `data-maker-desk` on the shell, and the lazy
  `MakerDesk` lays the phone's own tree out in columns — ≥ 1280: parts 264 · page · tools 384; 1024–1279: page ·
  tools (the parts column folds — answer 2). The top bar is the phone's four controls with their words
  (✕ Exit · Stages | Studio · 👁 Preview · ↺ Undo · ✓ Apply); the old desktop's Page ▾ and Event Details go.
- The tools column IS the phone's lower third: Edit | Style | Background | Animate · ▶, full height, the work area's
  tool laid over its rows by the phone's own rule set (`stage-panel/desk.tsx`); under the selector the part's
  caption ("TOP LINE · 2 of 13", its ⓘ) and ‹ Previous · Next › · ✕ Done — the phone's swipe, for a mouse.
- The parts column: the stage's pages, then every part the page draws in its order, with where it comes from
  (Studio · Suppliers); a click is a tap on that part; the Reveal reads locked. "You're editing" sits under the page,
  the guests' tab bar at its foot. Every Maker sheet opens as a pop-over beside its button (the doc's "Sheets");
  Preview ▾ drops "Both" (answer 1) and opens on Phone (the prototype's "Preview · Phone").
- The work area's "new Maker on a phone" checks (`stagesStudio && innerWidth < 1024`) are now "the new Maker" —
  the same on a phone, and true on a desktop only when its columns are on.
- Guard: `lib/the-desktop-maker-never-reaches-a-phone.test.ts` (one switch that needs a desktop width; every desk rule
  names it; the desk code is lazy; the first paint is byte-identical with the columns on). Seven source-pinned tests
  now read the new expressions.

NOT IN THIS PR (named, next): Style/Animate sections stacked + the 2-column grid of previews (doc PR 3); ＋ Add above
· grip · 🗑 on the picked row of the parts column and its hover ring (PR 4 rest); Studio's own widths — home in four
columns, a tool at 760 / 1100 px, Look's two columns (PR 5); the event's name in the middle of the top bar; Preview ▾
Desktop drawing the guest's real desktop page (the shipped canvas does — walk it); the guest Event Hub on a desktop
(area 1, part 2 — `event_hub_one_page_and_desktop_2026-10-15_fable.html`).

SPEC IMPACT: None — builds the approved `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`; decisions taken inside it
are in the PR body (the phone's stage ▾ moved into the top bar's Stages half on 2026-10-08, so the parts column does
not repeat it; the "Tap a part" hint the phone retired on 2026-10-09 is not drawn).
