## 2026-10-08 · feat(egifts): the wish list's two tables (wish list 1/5)

⚠ **Carries ONE migration** — `supabase/migrations/20271266228704_the_wish_list_two_tables.sql`.
The pipeline applies it; nobody applies it by hand.

Owner 2026-10-08 (DECISION_LOG "E-GIFTS WISH LIST", design
`EGIFTS_WISH_LIST_2026-10-08_fable.md`, approved "ok wish list"): the couple
add what they would love to Studio › E-Gifts; a guest sends toward a wish
through the couple's OWN GCash or bank and then shows the couple a screenshot,
the amount and a word — "this will be the way to measure". Gifts add up per
wish and a wish is marked got "when amount is reached". Free. Setnayan never
holds the money, and every word is "sent", never "received" or "verified".

This PR is the data only — no screen changes yet.

- **`event_wish_items`** — a name (≤ 60), an optional whole-peso price (none =
  any amount, never marks itself got), photo, shop link (the registry link's
  http(s) ≤ 500 rule), note (≤ 120), the couple's order, and `got_at` +
  `got_by` (`auto` | `host`, both set or neither).
- **`event_gift_records`** — what a guest SAYS they sent: amount, screenshot,
  message (≤ 240), the name they gave (≤ 80), their guest row when recognised,
  the way they said they used, the wish it counts toward (none = "Any gift"),
  and `removed_at` (the couple's Remove is soft; a removed record never counts).
  No order, no ledger, no settlement state.
- **Who reads them:** the hosts only — the exact `event_egift_methods_host_all`
  predicate (accepted, not-removed moderators · the legacy couple member ·
  admin). No anon policy and **no anon grant** (narrower than the stock grant
  `event_egift_methods` still carries). `authenticated` holds SELECT + UPDATE on
  gift records and **no INSERT or DELETE**: the server writes a guest's record,
  and a host can correct, move or soft-remove one but never invent or erase it.
- **Got it is the action's to write, not a trigger's** — two plain tables.
- **Public ids:** all 26 type letters are already in use, so none was free.
  Wishes wear `S89H-` (as designed; shared only with chat threads); gift
  records wear `S89Y-`, the E-Gifts letter, instead of the designed `G`, which
  is `guests` — a record sits beside its giver's guest id.
- **`lib/wish-list.ts`** — the row types, the two canonical select lists and
  two purpose projections (the sum reads no name), `sumSent`, `sentByWish`,
  `reachedPrice`, `leftToReach`, `meterPercent`, `gotAfterGifts`,
  `wishesInOrder`.
- **Guards that had to learn about the tables:** exposure baseline (+30 facts,
  all `authenticated`, anon `-`); the FK-behaviour roster (+1 SET NULL); Ugat
  joint **J52** with claims for both tables, including the absences (no order,
  no verification, no status column); erasure `AUTHOR_UUID_NULLS` + the export
  exclusion for the author stamp; the data-subject register (a wish's `name`
  is a thing, not a person).
- **Two debts recorded, each with a named payer** (`ugat-both-ends`): a table
  needs a writer, and this plan lands the tables one PR ahead of theirs.
  `event_wish_items` is paid down by wish list 2/5; `event_gift_records` by
  wish list 4/5. `EXPECTED_BASELINE_ROWS` 43 → 45.

Tests: `tests/db/the-wish-list-is-the-hosts-alone.db.test.ts` (18 — a non-host
reads zero rows of both, a host reads their own, anon cannot read either, no
signed-in user can invent or erase a gift record, no trigger marks a wish got,
the rows outlive their author / giver / wish) and `lib/wish-list.test.ts` (12).

SPEC IMPACT: `02_Specifications/Account_ID_Format.md` gains a dated note — the
type letters in use (all 26), and `H` / `Y` for the wish list. Status in
`EGIFTS_WISH_LIST_BUILD_STATUS_2026-10-08.md`.
