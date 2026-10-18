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

## PR B (not started — needs one owner answer first)
Owner: "suppliers for those categories can upload photos for that" / "so does the other parts". Measured: a booked
vendor CANNOT write event_inspiration_assets today (insert RLS = event_members only); #6407's map is view-only and has no
photo rule. Smallest design: one migration (added_by_vendor_id + added_by_label + source_kind 'vendor_suggestion',
provenance CHECK) + a SECURITY DEFINER RPC vendor_add_inspiration_photo (booking via current_vendor_event_vendor_ids,
fee gate, category/services vs MOODBOARD_SLOT_TRADES with a SQL mirror + one-map db test), get_vendor_mood_board returns
the label, couple side shows it via photoTag, vendor UI = per-part upload on the vendor mood-board page.
OPEN OWNER QUESTION: a slot holds 3 photos; when a supplier adds one, does it (a) take a free place only (refused when
full), or (b) wait as a suggestion the couple accepts? Replacing the couple's photo is ruled out.

## State
- [x] code · [x] tsc · [x] targeted tests · [x] preflight (49/50) · [x] shots 375 light+dark + side-by-sides · [x] PR #6651
- CI: 24 pass · 2 fail = ONE cause: schema-drift "prod snapshot 41 migrations behind" (ceiling 40; main sits at 40,
  this PR's migration is the 41st). Fix = OWNER refresh `pnpm --filter @setnayan/web schema:snapshot` + commit
  supabase/security/prod-schema.snapshot.txt. Never raise the ceiling.
