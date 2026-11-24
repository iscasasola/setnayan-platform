## 2026-11-18 · feat(seating): the seat plan's drawing core, shared by couple and supplier

Owner, 18 Nov: *"we can fix that seat plan to adapt for this one and improve the functions … they are already coded.
we just need to improve and adapt them properly"* (DECISION_LOG 2026-11-18, three rows).

- `lib/plan-maker.ts` — a plan (room Wide × Deep, doors on walls, tables) and its pure math, with no event. Couple
  tables go straight through the couple's own `tableGeometry`; "Line up" is the couple's own `computeAutoLayout`.
  New: Round · Long (with "chairs at the ends", counted in the one number; ≤ 4 and no ends draws as a square) ·
  Half-moon booth; doors snap to the nearest wall; `planFromSeating` reads a couple's plan as a Plan.
- `app/_components/plan-maker/plan-maker.tsx` — the shared `PlanMaker` a supplier page imports: Grid view and Floor
  plan view (the page says which it may show; Floor plan can be listed greyed with its reason), ＋ Table, ＋ Door,
  Line up (rows read left to right in name order), Wide × Deep rows, a table sheet (Name, shape ▾, chairs counter,
  "Chairs at the ends", Turn, Remove), drag to move, doors dragged snap to the nearest wall; read-only with ONE table
  marked; the guest/name layer can be switched off.
- `seating-editor.tsx` — its walk-through entrance now takes the nearest wall from the shared core (same rule, same
  tie order; nothing it draws changes).

SPEC IMPACT: None — implements the 2026-11-18 DECISION_LOG rows as written.

- **Mounted** on the supplier's Rooms & seating page (#7968, merged into this branch): each dining area draws its
  tables with the shared `PlanMaker` in its new `tools: 'move'` (drag a table, Line up — the page's own rows keep
  adding, editing and deleting). Moves save through #7968's `placeTable`, only for the tables that moved, while the
  plan stays where the supplier left it. Floor plan on Pro and up (`vendorPaywallApplies(isTierAtLeast(tier, 'pro'))`,
  ruling 35); Grid for every shop. New core helpers: `planFromShopPlan`, `placementsChanged`.
