## 2026-07-28 · fix(marketplace): Explore bench visual parity — row icons, card contrast, motion

The live Explore bench did not match the approved prototype
(`Design_Explore_Replan_2026-07-27/explore_replan_playable_2026-07-27.html`).
Owner, comparing them side by side: *"icons, theme, style. everything is still
not in order."* This is a parity pass on the SHIPPED component — no rewrite, no
new surface, no schema, no flag change.

**Icons on every row.** Folder rows (Venue · Planning · Feast · …) and leaf rows
(Reception · Cake · Photo & Video · …) rendered no icon at all; only the Coverage
Strip did. Both now draw Lucide glyphs from the icon source that already existed
— `tileIcon()` for leaves (unchanged), and `WEDDING_FOLDER_ICON` for folders.
That folder map is NOT new: it shipped as a private `FOLDER_ICON` const inside
`app/explore/_components/icon-tile-folder-strip.tsx`. Because that file is
`'use client'` and re-exporting a data table out of a client module is the
documented RSC hazard, the map was LIFTED verbatim into the plain
`lib/taxonomy-icons.ts` beside `WEDDING_TILE_ICON`, and the /explore strip now
imports it. One source, two consumers, zero icons changed. The prototype's emoji
are a prototyping shortcut and did not come across (repo icon framework is
Lucide).

**Every event type covered, by test.** `WeddingTile` / `WeddingFolder` are legacy
names for the FULL cross-event taxonomy, and per-type scoping
(`passesEventTypeFilter`) only ever REMOVES rows — so exhaustiveness over the
union covers debut / christening / corporate / travel / tournament / … too. New
`lib/taxonomy-icons.test.ts` locks that: every folder and tile has an icon, the
maps have no orphan keys, every event type in the `ANCHOR_BY_TYPE` roster
resolves an icon on every row it can show, and `tileIcon()` / `folderIcon()` are
TOTAL so an admin-authored DB category can never blank a row. Prod is
wedding-only, so non-wedding types are verified by this test, not by eye.

**The washed-out page (GLOBAL — owner: "we want it to be global").** The
app-wide `.sn-ambient` wash had a base-ramp midpoint of `#E3DDCF`, within
(2,1,2) RGB of the card border token `--m-line` (`#E1DCD1`) — a card outline
drawn over it literally disappeared. The wash is now lightened onto `#F4F2EC`
(the prototype's own page colour, and the existing `--m-paper-2` value) with all
three radial glows kept at ~half alpha. Deliberately a LIGHTENING, not a
re-flatten: the base stays tinted so glass `rgba(255,255,255,.5)` panels still
read, which is the precondition the 2026-07-15 owner reversal of the
2026-07-13 white-flatten exists to protect. **Scope: every logged-in surface** —
SidebarShell (customer event dashboard, `/vendor-dashboard`, `/admin`), the home
launcher, and the account spokes.

**Bench surfaces.** The bench adds its own neutral `--edge` + resting lift, so
folder cards have a real edge instead of a 0.5px beige hairline. The Coverage
Strip's container was a translucent ink wash (the "grey-beige box"); it is now
the same white card, edge and lift as the folder cards. Folder-summary pills
("2 to decide") go 9px → 10px. `--line` itself is untouched, so every dashed
rule, separator and chip that reads it is byte-identical.

Contrast measured, not eyeballed. Bench vs the reference prototype:
edge|card **1.52:1** (ref 1.28), edge|page **1.26:1** (ref 1.14), card|page
**1.25:1** (ref 1.12) — clear of the reference on all three. Text on card:
ink 17.40:1, ink-soft 7.72:1, gold-deep 4.95:1 (all ≥ AA).

**Motion (owner: "full animation. expand. taps. animations. effects.").**
Accordion expand tightened .3s → .24s keeping the grid-rows technique —
`grid-template-columns:minmax(0,1fr)` is preserved verbatim and commented as
load-bearing, so the PR #3799/#3801 mobile horizontal-overflow fix does not
regress. Chevron rotation aligned to .24s; Coverage-Strip tiles now transition
`color` + `box-shadow` so a state change (not-yet → exploring → locked →
covered) is seen. Press feedback was already universal in `globals.css` (every
`<button>` gets `scale:.96`), and folder rows, leaf rows and strip tiles are all
real buttons — extended, not forked. Transform/opacity/colour only; nothing
animates layout. `prefers-reduced-motion` is enforced app-wide by the existing
`*` block, plus a local guard for the motion this stylesheet owns.

Known, pre-existing, NOT changed by this PR (flagged for the owner): the
disabled ranking-lens chips compute **1.96:1** at `opacity:.42` — WCAG exempts
inactive controls, but these are meant to teach what would switch them on, so
the owner may want them less dim. The `.fsum .s.lk` gold pill is **4.18:1**,
just under AA 4.5 — fixing it means darkening the `--m-orange-2` token
app-wide, which is a design-system decision, not a bench one.

SPEC IMPACT: None — presentation only. No SKU, price, schema, RLS, flag or copy
change. The `.sn-ambient` lightening is an app-wide visual change recorded here
and in `DECISION_LOG.md`.
