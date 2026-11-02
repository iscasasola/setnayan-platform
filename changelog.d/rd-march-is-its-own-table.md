## 2026-10-01 · feat(march): the wedding march is its own table — `march_walks`

DECISION_LOG 2026-10-01 "THE WEDDING MARCH IS ITS OWN ENTITY" · "A WALK AND A COUPLE ARE
INDEPENDENT" · "THE GUEST LIST IS ONE PERSON PER ROW"; 2026-09-30 "WALKING TOGETHER IS NOT BEING
A COUPLE".

- **Migration `march_is_its_own_table`** — `public.march_walks`, one row per person
  `(event_id, guest_id PK per event, walk_no, place_in_walk)`; a walk = the rows sharing a
  `walk_no` (unique per walk across the event), order = `walk_no`; composite FK → `guests`
  ON DELETE CASCADE. RLS at CREATE TABLE: hosts via `current_couple_event_ids()` (NOT the
  member-wide `current_event_ids()`, which admits plain guests) + `is_admin()` + a guest-list
  editor, mirroring `guests`. One-time copy: every mutual `pair_with_guest_id` pair → one walk of
  two, every other entourage member → a walk of one, numbered so each section prints exactly
  what it printed before.
- `join_entourage_line` · `swap_entourage_places` · `set_entourage_order` · `unpair_guest` now
  write `march_walks` only (same names — the four march actions are re-pointed, no new action);
  `pair_guests` and `clear_entourage_order` are dropped. `guests.pair_with_guest_id` /
  `entourage_order` are kept but retired for the march (column comments say when they may go).
- `lib/entourage.ts` reads walks through the embedded `march:march_walks(…)` in
  `ENTOURAGE_COLUMNS`; every march line prints **both full names**, always.
- Maker Wedding March: the "They're a couple" tick and `setWalkingPairCouple` are retired
  (server actions −1). Reset re-sorts a section to the default order and keeps who walks with
  whom.
- Auto-seat no longer reads a walking pair as a seat-together hint: Rules ▾ "Sit together"
  (the default) already seats the sponsors as one unit, and a spouse is a +1.
- Sponsors page: a principal pair reads "Walk N · A walks with B" — full names, never a couple.
- Ugat: `TYPE-MARCH` node + joint `J50` with claims (renumbered from J49 in the 2026-10-02 train: main already had a J49, the Papic portfolio ledger).

SPEC IMPACT: None (rows already logged in DECISION_LOG 2026-10-01).
