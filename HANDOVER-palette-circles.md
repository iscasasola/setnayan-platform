# HANDOVER — rd/palette-wears-attire-circles (2026-10-19) — PR A (couple side)

Owner rulings: circles like attire, names not codes, no dropdown · Palette + Inspiration one list "make it look like
attire" · prototype `prototypes/palette_inspiration_one_list_2026-10-19.html` (corpus 0c75a5f0) approved:
"1. yes all circles  2. yes  3. yes. remember these can also get inspiration from suppliers."

## Built (this branch)
- `_components/colour-dot.tsx`: RoleColourDot (moved unchanged) + NamedColourDot (slot word + name).
- Palette = one list: changes notice · upload bar · YOUR MAIN PALETTE (5 circles + Venue & decor photos, offer "Use as my
  five main colours") · THE ROOM / FLOWERS / CAKE groups of Attire-shaped blocks (partBlock), each with ideasRow + offer
  "Use for <part>" (commit → Undo toast). Inspiration tab removed (Tab = colours|attire|dos).
- room_dressing +9 keys (lib/mood-board.ts), every lane part has `field`, CAKE_LANE_PARTS (lib/colour-access.ts).
- 5 new slots + migration 20271278232574 (both gates) + every mirror (slots, trades, shelf labels, render parts,
  inspiration-board GROUPS, Ugat prose). Part→board map: lib/inspiration-slots.ts `paletteBoardOf`.
- 3D: Lab3DPalette stage/walls/ceiling/tunnel/candles/cake (override-only, lib/room-palette.ts partOverrides) → stage
  slab ×3 surfaces, VenueShell + decor wallsP/ceilingP/tunnelP/candleP, cake_table.
- Guards: colour-circles-are-one, the-palette-holds-the-boards, the-room-reads-the-resolved-board (+1 test). Sabotage
  4 + 6 red. Re-aimed ~12 tests (see commit c255cf3308).

## Decisions (mine — say in PR)
- Tab order kept Palette · Attire · Do's (prototype drew Attire first; not in its captions).
- Cake group header "Cake — for your cake maker" (the prototype has no cake block; owner "3. yes").
- Flowers (all-flowers) board: no part — block only where photos exist, not offered for new photos.
- Supplier grant (colour_domain_covers SQL) still reaches only linens/chairs/lighting/florals → PR B.
- Old "Your main palette from ALL photos" + Compare dropped; ✨ Auto still offers "From your photos".
- Older non-Maker Mood Board page (palette-section.tsx) unchanged.

## PR B (not started): supplier inspiration by category (owner "suppliers for those categories can upload photos for
that"; reuse #6407 category keys, vendor mood-board page, event_colour_changes actor).

## State
- [x] code · [x] tsc local clean · [x] 858 targeted unit + 25 db green · [ ] preflight · [ ] shots · [ ] PR · [ ] CI
- Walk: work dir ~/Documents/Claude/Projects/shots-2026-10-18/palette-circles/work (serve.sh port 3687, walk2.mjs).
