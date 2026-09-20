## 2026-09-20 · feat(entourage): the couple sets who walks first

⚖ Owner 2026-09-20, shown the invitation's printing order and asked whether he
wanted the within-role order fixed too: *"Both, and I want to drag them"* —
placed, on his instruction, on the guest list's per-role view.

- **`guests.entourage_order`** (migration `20271236109974`) — nullable integer,
  NULL meaning "never placed by hand". No DEFAULT and no NOT NULL on purpose: a
  default would be a placement nobody made.
- **`EntourageOrderPanel`** — appears above the roster only when the host has
  filtered to a role the invitation prints, and renders itself away for every
  other view. Move ↑ / Move ↓ rather than HTML5 drag, matching
  `admin/website/widget-list.tsx`: drag-and-drop does not exist on touch, and a
  couple arranges their entourage on a phone.
- **`entourage-order-actions.ts`** — writes the full 0..n-1 sequence for the
  role rather than the two rows that moved, so there is no "have we normalised
  yet" state to get wrong on the first drag. `.select()` on every write,
  because a zero-row UPDATE is success-shaped and an RLS refusal returns
  exactly that. A Reset hands the role back to the alphabetical default —
  without it, a couple who drags once can never return to "no opinion".

🔑 **The panel and the invitation share ONE ordering function**
(`holdersOfRoleInPrintOrder`, exported from `lib/entourage.ts`). If the
dashboard sorted independently — its own `sort` param, or raw DB order — then
"move her up" would swap her with whoever the DASHBOARD showed above her, and
the invitation would change somewhere the couple was not looking.

A hand-placed name outranks the alphabetical default, and only where one was
given: place three of twelve ninongs and you get those three on top in your
order, with an alphabetical tail. NULL is never read as 0 — that would rank
everyone untouched above the person deliberately put first.

Guarded in `lib/entourage.test.ts` (28 tests). Three sabotages confirmed red:
NULL treated as 0 (3 failures), `entourage_order` dropped from
`ENTOURAGE_COLUMNS` (1), the override ignored (1).

No GRANT is issued: `public.guests` carries TABLE-level grants (verified in
prod — 60 columns × 4 privileges across anon, authenticated, postgres,
service_role), so the new column inherits them; a column-level GRANT would be a
no-op that reads like a decision.

SPEC IMPACT: None.
