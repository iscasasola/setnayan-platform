## 2026-09-09 · feat(bench): a couple can arrange their own shortlist — per category, shared by every host

Owner 2026-09-09, in three steps: *"top tier can be long pressed and dragged to be rearranged"* → on the recommendation that one gesture serve the whole rail, *"okay then. let both rearrange."* → and, on scope, ***"per category."***

### Pins + sort, so the two features stop fighting

A dragged card is **pinned where it was put**; the lens orders everything **unpinned**; a supplier who arrives later lands in its normal computed position among the unpinned and **never jumps the queue**.

🔑 **That last clause is why pins are sparse absolute slots and not a saved list.** A saved list of the whole rail would have to say something about a supplier it has never seen, and whatever it said would be wrong — append and a newcomer is buried under cards the couple never ranked, prepend and it jumps ahead of everything. Recording only the cards the couple actually moved leaves the rest to the one thing that already knows how to rank a stranger.

It is the same shape as `inline-more-order.ts` from the sort work, inverted: there the protected tiers hold their slots and the tail is re-ordered around them; here the pinned cards hold their slots and the lens fills what is left. Composition is `lens → the couple's own hand → sink the date clashes`, with the sink still last because it is a partition over whatever order was chosen, never a term inside it.

### Per category — which also scopes the Reset

Keyed `(event_id, tile)`. A caterer can never outrank a florist, which is the only shape the page's grouping allows anyway. **One Reset clears one category**: a couple who arranged their caterers three weeks ago must not lose it by tidying their florists today. The *"Your order"* chip and Reset therefore sit on the **category**, not on the global Sort by bar — a global chip would claim the whole bench was hand-made when one rail is.

### RULE 0: the obvious existing home was the wrong one

`event_category_build_state` is already per-(event, category) and already has a column literally called `pinned_vendor_id` — and reusing it would have been a defect. There, "pinned" means the 3-State Build solver's **Locked pick**: which supplier the build uses. Here it means where the couple dragged a card. One column, two meanings is the competing-source-of-truth trap; it also holds a *single* pin where an arrangement needs an ordered set, and it is dark behind `BUILD_3STATE_ENABLED`.

New table `event_bench_arrangement`, **one row per pin**, for a measured reason: removing a supplier from the shortlist is a real `DELETE` on `event_vendors` (`vendors/actions.ts` releases the schedule pools, then `.delete()`), so `ON DELETE CASCADE` takes the pin with it — a JSON blob would keep a dangling id holding a slot open for a supplier who is gone, and nothing would clean it up. ✅ And **one FK reaches the whole rail**: a manually-added supplier is not a second kind of card — `20260604080000_event_manual_vendors_table.sql` states *"each category gets its own `event_vendors` row"*.

Stored on the celebration, not per browser: the sort lens beside it stays `persistBenchSort` in localStorage and is deliberately private, but *"all hosts of that event see the same order."*

### 🔴 The migration shipped a hole for one commit, and the exposure guard caught it

Creating the table and granting only to `authenticated` does **not** withhold anything from `anon`. This project carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated` — named in `20271014090000_guest_song_requests.sql` as *"the root cause of the 368-table exposure"*. Measured on this very migration before the fix: `exposure-freeze.db.test.ts` reported **13 new capabilities**, every column reading `anon: gained INSERT, SELECT, UPDATE`. Adding the `REVOKE ALL … FROM PUBLIC, anon, authenticated` the repo's own pattern requires took it to **12, all `anon=-`**. RLS would have refused an anonymous caller anyway (`current_couple_event_ids()` is empty without `auth.uid()`), so it was defence in depth rather than a live hole — which is exactly why it is written down: a hole RLS happens to cover today is one policy edit away from being real.

### The gesture

**Long-press enters a mode**, and that is load-bearing rather than a flourish: the rail is a horizontal snap carousel, so a card that could be dragged immediately would hijack the swipe that scrolls it. An 8px movement threshold cancels the press, so a swipe that happens to linger stays a swipe.

In the mode each card carries the shipped `proposal-maker` drag shape (a draggable grip beside a drop-target row — **no drag library**) plus **← →** buttons. Those buttons are not a fallback: they are the keyboard route (a drag-only reorder is unreachable without a mouse or a touchscreen) *and* the whole touch route, because HTML5 drag-and-drop does not fire on touch at all. Escape and a **Done** button both leave the mode.

A failed write **rolls the rail back and says why** — a silent revert is a rail moving on its own, which is the complaint this feature answers.

### Measured

**23 tests, exit 0** in `lib/bench-arrangement.test.ts`, and **all 11 mutations proved red**: the sort ignoring pins (1 fail) · dropping an out-of-range pin instead of clamping (3) · the later pin evicting the earlier (1) · re-pinning only the moved card (2) · saving the whole visible order (4) · writing on a nudge at the end of the rail (1) · offering Reset for a supplier who is gone (1) · **Reset clearing every category** (1) · the save merging instead of replacing (1) · measuring the drop index against the unsorted list (1) · running the date sink before the couple's order (1).

🔑 **One guard was decoration and the battery caught it — the same trap as the sort work, one layer down.** The collision test used two pins wanting the *same* slot, so the comparator returns 0 whichever way round it is written and reversing it changed nothing. Rewritten with two pins that both point *past the end* of the rail, which is the only case where placement order is observable. Fixing the test also fixed the rule: pins are now placed from the rightmost request inward, so the card that asked to be furthest right is the one that gets the last slot instead of being pushed in front of a card that asked for an earlier one.

`exposure-freeze` (6) · `ugat-schema-claims` (3) · `ugat-concept-coverage` (3) · the card-element guard (5) · the contrast guard (6) · `bench-sort` (36) · `inline-more-order` (22) · `inline-more-row` (23) · `lint-port-no-lost-controls` green with its baseline **untouched** · migration-timestamp guard green · typecheck and eslint clean.

⚠ **The contrast guard's pinned list goes 4 → 5**, which it asks you to say in the PR: *"Your order"* is gold on a gold wash — the exact family every one of that guard's four original failures came from — so it is measured in both themes rather than assumed.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-09 bench-ordering row — the per-category question closed; `SESSIONS_Chat_Bench_Exclusive_2026-09-09.md` S8 and `BUILD_PLAN_Chat_And_Exclusive_2026-09-09.md` B7 already carry the ruling and the schema finding (committed 2026-09-09).
