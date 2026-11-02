## 2026-09-03 · feat(mood-board): section 02 "Palette" goes live on the palette-style engine

Ports atelier-board.html's `#palette` (section "02 — Define") onto MB4's landed
`lib/palette-styles.ts` engine, with live 00 → 02 derivation: change a major color on the
theme card and every role that hasn't been edited directly re-derives immediately, no save
round trip.

**The majors move to section 00, for real.** `<MajorsEditor>` (new) is the couple's FIVE main
colors, now edited inside `<ThemeCard>` — the reference's `majorsOnly` rule ("these ARE the
majors on the 00 theme card — they render and edit THERE only"). Section 02's Venue group shows
a read-only Reception mirror instead: plain `<span>` swatches, no `<input>`, no click handler,
just an "↑ Edit at 00" link — no picker machinery can attach to it by construction.

**The one-directional rule is enforced twice, not once.** Every 02 mutator
(`applySetRoleColor` / `applyAddRoleColor` / `applyRemoveRoleColor` / `applyPasteInto` /
`applySwap`, `lib/mood-board-board-ops.ts`) refuses `key === 'reception'` as a defensive
guard, in addition to the Reception mirror never rendering an interactive control at all.
Sabotage-tested THIS session, on the real source: removed the guard from
`applySetRoleColor`, confirmed `mood-board-board-ops.test.ts` went red (2 failures, listed),
restored, confirmed green again. Same pass performed on `displayColorsFor`'s touched-role
check (`lib/mood-board-derive.ts`) for the touchedRoles guard — removing it turned both the
lib-level and the component-render-level tests red, restored.

**`touchedRoles` persists, inside the existing JSONB column — no migration.**
`RolePalette.touched_roles` and `RolePalette.palette_style` (`lib/mood-board.ts`) are new
siblings of `room_dressing`/`custom_roles` in the same `role_palette` column, sanitized the
same way (drop invalid, dedupe, omit when empty). A role in `touched_roles` is never
overwritten by a major change or a style switch — proven at three layers: the reducer
(`mood-board-board-ops.test.ts`), the derive bridge (`mood-board-derive-slice-path-preserves-
rank-order.test.ts`), and the rendered component (`palette-section-renders.test.ts`).

**The six-rank monotonic invariant, re-run through the UI's slice path — the trap the brief
named.** `displayColorsFor` (`lib/mood-board-derive.ts`) is the ONLY post-processing between
`deriveBoard`'s output and what a role's swatches show, and it does exactly one thing:
`.slice(0, max)`. It never pads a short derived role toward its `min` — the old UI's top-up
that broke this exact invariant by handing the Dominant major to the guests, above the bride.
`mood-board-derive-slice-path-preserves-rank-order.test.ts` reproduces the engine's own "97
ordered pairs, 0 failures" measurement THROUGH `displayColorsFor`, plus a direct trap test
(a hand-built short derived role must render short, never padded).

**Palette style picker** — Simple ("Our colours only") / Depth ("Softer room, richer people")
/ Complex ("Room and people"), the owner-approved labels verbatim from the reference. Switching
style re-derives every untouched role; touched roles are unaffected (same guard).

**Six-rank display order, read from the engine, never hand-copied.**
`DERIVABLE_ROLES_IN_RANK_ORDER` (`lib/mood-board-derive.ts`) sorts by `VISIBILITY_RANK` then
`IN_RANK_INDEX` — both imported from `palette-styles.ts` — so the Roles group's order can never
silently drift from the ladder it's displaying. Adds `muslim_principals` to the derivable set:
the engine already ranks it (rank 3, alongside `principal_sponsors`) and production's taxonomy
already carries it for Nikah weddings; the atelier-board.html demo simply never modeled one.
Extending the richer, already-shipped taxonomy rather than the simpler demo — noted since the
brief says "translate, don't reinterpret" and this is one place they disagree.

**Copy, paste, and swap — an interaction simplification, disclosed.** The reference's picker is
a custom draggable HSV square with long-press/right-click copy-paste and drag-to-swap; this port
uses the codebase's established native `<input type="color">` pattern instead, with copy/paste
via one internal clipboard (never the system clipboard) and swap via click-to-mark-source →
click-to-commit, both reachable from an expanding panel under any swatch
(`<SwatchPopover>`). Same outcome (copy a color, swap two roles' colors), different gesture —
rebuilding a custom drag-square picker was out of proportion for a port session. "The theme's
own colours shown under the colour picker" ships as a "Your theme colours" chip row inside that
same panel.

**Search by color name** (owner, 2026-09-03: "they can also search for the color name").
`lib/color-search.ts` — curated `WEDDING_NAMES` first, `CSS_NAMES` second, plus a
`COLOR_ALIASES` table for words neither table names exactly ("moss green" → Moss, "dusty pink"
→ Dusty Rose, "champagne" → Champagne Gold, 29 entries). Prefix-then-substring,
diacritic-insensitive ("pina" finds "Piña Cream"). A miss returns Levenshtein-ranked
suggestions instead of an empty box. **Coverage measured separately from naming accuracy**, per
the brief's own warning: `color-search.test.ts`'s coverage test walks 84 real wedding-vocabulary
search terms and requires every one to resolve — it does, after three alias additions the first
run surfaced (`pearl grey`/`pearl gray` → Silver was the one genuine gap; the rest already
resolved once the alias table pointed at entries that actually exist in `color-names.ts` rather
than a different, unrelated attire-material library that happens to share some names).

**Verification:** `tsc --noEmit` clean (whole project). `npx tsx --test
'app/dashboard/**/mood-board/**/*.test.ts' 'lib/mood-board*.test.ts' 'lib/color-*.test.ts'
'lib/palette-styles*.test.ts'` — 109 tests, 0 failures (new files: `mood-board-derive-role-key-
parity`, `mood-board-derive-slice-path-preserves-rank-order`, `mood-board-board-ops`,
`color-search`, `majors-editor-starter-slots-renders`, `palette-section-renders`).
`port-control-baseline.json` regenerated — the only real removal is
`handleSubmit` (the old explicit "Save palette" button/form), replaced by the same debounced
auto-save pattern `<ThemeCard>` already uses for the theme name/description; every destination
and every other control is a strict addition (884 destinations unchanged, 620 vs 621 actions).
Not verified in a live browser: this route needs auth + a real event + Supabase env, none of
which exist in a fresh worktree (no `.env.local`) — verification here is `tsc` + the render/unit
suite above, not a screenshot.

SPEC IMPACT: None — this is a UI port of an already-decided palette-style engine (MB4) and
already-locked palette limits (`PALETTE_LIMITS`), plus a same-column schema addition
(`touched_roles`/`palette_style`) that needs no migration and no corpus decision.
