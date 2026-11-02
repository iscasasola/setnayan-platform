## 2026-07-28 · fix(design-system): app ground → flat warm white, glass carries its own edge

Follow-up to PR #3855 (Explore bench visual parity), which had already merged
when the next owner direction arrived — so this lands the background change as
its own PR on top of it rather than amending a merged one.

**Owner direction, in sequence** (all three are recorded in the `.sn-ambient`
comment so the next reader does not think someone re-broke an earlier decision):

- 2026-07-13 — page flattened to white.
- 2026-07-15 — owner **reversed** it to the champagne wash, because glass
  `rgba(255,255,255,.5)` panels are invisible on white.
- 2026-07-28 — *"we want a lighter feel for the background than the champagne.
  keep it modern digital color. like facebook. that keeps white to make it look
  clean."* then, refining: *"then make it a bit of warm white just enough to
  show the glass effect."*

**Ground: flat `#F7F5F0`, radial glows removed.** The value is measured, not
taste. Glass fill (white @ .5) computes **~1.03–1.05:1** against *any* warm
white across the whole `#F6F3EC`–`#FAF8F3` band — the fill physically cannot
carry the panel. So the ground was chosen for the **white cards**, which do have
to read: `#F7F5F0` gives card|ground **1.09:1** against Facebook's own `#F0F2F5`
→ 1.12:1. Warm, in the light band asked for, at its darker end — the lighter end
drops white cards to 1.06:1 and they disappear.

**Glass now carries its own edge — this is what lets the ground stay light.**
`--sn-glass-line` was `rgba(255,255,255,.72)`, a *white* hairline that only ever
worked because the champagne ground framed it. It is now a warm
`rgba(40,34,24,.16)`: edge|ground **1.37:1**, edge|glass-fill **1.43:1**, the
same band as the bench card edge (1.40 / 1.52) so every surface reads alike.
This is precisely what the 2026-07-13 flatten lacked — it made glass depend on
ground contrast alone. Warm, never grey/blue: Atelier kit rule 4 still holds for
edges and shadows; only the page ground moved.

Also fixed, because the token could not reach them:
- `.sn-tile-glass` (launcher) hardcoded copies of the `--sn-glass-*` values →
  now references the tokens. One source of truth.
- `.sn-row` (182 usages) was a white `.72` fill + white `.6` border + **no
  shadow** — the worst case. Now opaque white with a lighter warm hairline
  (repeated rows at full strength read as a cage).
- `.sn-modal-panel` declared **no border at all**; its one consumer supplied
  `border-white/60` by hand. Rule now carries the shared hairline; the hand-rolled
  override removed so it takes effect.
- `--m-sidebar-line` `.08` → `.12`. The sidebar is a 45%-white frosted rail whose
  fill computes **1.03:1** against the new ground — the hairline is the only thing
  separating the rail from content. 1.14:1 → 1.22:1.
- `--sn-sh-tile` / `--sn-sh-hi` gained a 1px contact layer; the lone big ambient
  shadow reads as a smudge on a flat ground.

**Dark mode paired, not left as a trap.** `.sn-ambient` previously had *no* dark
override at all — a dark-mode shell would have painted a light page. Added, plus
a dark counterpart for `--sn-glass-line` (a dark hairline is invisible on a dark
ground) and for `.sn-row`'s new opaque fill. Dormant today (nothing adds
`html.dark`), correct regardless.

**Glass surfaces walked and visually verified** on the new ground: `.sn-glass`,
`.sn-tile` (411 usages), `.sn-tile-glass`, `.sn-card`, `.sn-row`, the suite
vignette, and the three inline glass panels on the guests surface — all read.
The obsidian family (`.sn-tile-dark`, `.sn-tile-obsidian`, `.sn-glass-dark`) is
untouched: its background is its own dark fill, not the page, so its light
hairline is still correct. The only true glass-over-photo in the app
(`event-type-photo-picker`) does not use these tokens and is unaffected.

Contrast on the new ground: ink **15.97:1**, ink on white card **17.40:1**,
ink-soft **7.72:1**, `--sn-ink-500` **4.94:1**, gold `--m-orange-2` **4.54:1** on
ground / **4.95:1** on card — all ≥ AA 4.5. Bench edge re-measured at edge|card
**1.52:1**, edge|ground **1.40:1** (up from 1.26 on champagne — the lighter
ground *improved* it, so those values stand unchanged).

**Gold accent, honestly:** it still looks right. It reads warm and intentional
because the ground stayed warm — this is exactly why the warm-white refinement
beat the Facebook cool grey, where gold at 4.5:1 on a blue-grey ground would have
read dirty. It clears AA but only just on the ground (4.54:1), so it should not
be placed on any surface darker than `#F7F5F0`.

Known and NOT changed, flagged for follow-up: ~60 components hand-roll
`border-white/{50..80}` on white-ish fills and have lost their edge (mostly
`/admin`; full list in the follow-up task). The `--sn-glass-line` change cannot
reach them because they hardcode the border; the established fix is the
`border-ink/10` idiom the rest of the app already uses. Also unchanged: the
bottom-nav pill fill is pinned by `lint-bottom-nav.mjs` and keeps its own border
+ drop shadow, so it still reads.

SPEC IMPACT: None — presentation only. No SKU, price, schema, RLS, flag or copy
change. Logged in `DECISION_LOG.md` as an app-wide visual change.
