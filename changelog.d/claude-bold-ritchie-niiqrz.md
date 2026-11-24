## 2026-11-23 · feat(maker): Look › Theme — the theme shown as one moving set, and the table sign in the theme (Maker parts 4–6, themes PR 2)

Owner 23 Nov: DECISION_LOG "EVENT HUB THEMES BATCH 6 APPROVED" lifts the hold on Maker parts 4–6. "THEMES ARE SHOWN AS
THE ANIMATED SET — APPROVED" (*"animated yes"*) says how a theme is chosen. Drawings:
`prototypes/maker_theme_set_animated_2026-11-23/` § "2 · Try it, in the Maker" and
`prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` (v17). Stacked on #8221 (themes PR 1).

- **Look has four tabs: Theme · Background · Elements · Music.** Look opens on Theme from every way in: the resting
  bar's Look, Pages › Whole Event Hub, the ⚙ and an old `?item=theme` link (`STUDIO_LOOK_TABS`, `studioTileItem`).
  - Since 5 Oct the Maker had no theme picker (the gallery component was unmounted). The 23 Nov rulings bring it back
    here.
- **The set is Look › Theme's preview.** It shows the five pieces of the theme being tried, overlapping as one picture:
  - the Event Hub page with its guest bar;
  - the RSVP sheet (the same page, opened at `#your-details`);
  - the digital ticket;
  - the invitation;
  - the table sign.
  - Each piece comes from the door that already draws it (`lib/theme-set.ts`). The live pages are sandboxed frames of
    the sample event, never the couple's own page.
- **Motion** (`maker-theme-set.css`, kept out of `globals.css`):
  - The pieces arrive once, in the drawing's order, on Rise 700 ms with the Spring. Each starts one Quick after the
    last.
  - Trying another theme cross-fades every piece in place (Move, Settle).
  - With reduce motion there is no travel, and a switch is a 120 ms fade.
  - Only transform and opacity move, and every length is a token.
- **The cards** sit in Look's sheet:
  - one per theme, its picture at 3 : 4, the tried one ringed and named, ◆ on Pro;
  - a tap tries a theme and saves nothing;
  - "Play again" replays the arrival;
  - **"Use <theme>"** picks it through the one shipped theme pick: into the draft, where Undo steps it back and ✓ Apply
    puts it live and names a Pro theme.
  - The theme already theirs reads "Your theme".
- **The table sign in the theme** (`layoutTableSign`, lib/print-layout.ts):
  - The theme's picture is placed the theme's way. Over it go "TABLE", the number large in the theme's face, the rule,
    and the couple's names.
  - Every word sits inside the safe area on every theme.
  - The sample door serves it as `table-sign` (`lib/print-sample-door.server.ts`).
- **Lab:** `/dev/maker-lab` → Look shows the set with no database.
  - The real print engine draws the prints on lab facts (`/dev/maker-lab/theme-print`). Pictures come from the corpus
    via `SETNAYAN_SPECS_DIR`.
  - The lab's themed hub page stands in for the sample page.

Guard: `lib/the-theme-is-a-moving-set.test.ts`. Re-aimed, with a reason in each:
`studio-followups-follow-the-prototype` (Look opens on Theme) and `theme-print-previews-wear-the-theme` (the sample door
serves four pieces).

Not in this PR:
- Papel · Lino · Gabi as the free three (1b). Papel replaces Classic, which is every un-themed event's base look, so it
  needs its own PR.
- The seating pack's real table signs wearing the theme. Free prints are plain white, so it needs the owner's word on
  Free vs Pro.
- The set's 18 s picture drift: the picture is inside the shipped pieces, and 18 s is not in the timing table.

SPEC IMPACT: None. This builds approved rulings. One question goes to the controller: the drawing's "Use <theme>" on a
Pro theme "opens Event services", but the 20 Nov ruling has a Free couple try Pro and pay at ✓ Apply. The ruling is kept.
