## 2026-08-04 · feat(lock): the data layer for the step where a vendor has to agree

PR-H, **data layer only** — the missing step 2 of the lock handshake:

> couple locks (a **request**) → **vendor agrees** → vendor sends payment request → couple pays + screenshot → vendor accepts payment → locked

Steps 3–5 ship today. Step 2 does not exist, so a couple locks a vendor and **the vendor is never asked.** This adds the columns, the state machine and the three RPCs. **No UI** — that is the next slice.

### The forgery hole, closed

The guard was wrapped in `TG_OP = 'UPDATE'`, so **INSERT was completely unchecked**. `event_vendors_couple_write` is `FOR ALL` with no column list, so a couple's own client could INSERT a row **born `agreed`** — `lock_agreed_at` and `lock_answered_by_user_id` filled in — and **manufacture a vendor's consent to being booked.** The vendor never sees a request; the row simply exists as though they had said yes.

Three independent review lenses found this. It is now guarded on both operations: on INSERT a new row may be `NULL` (no request) or `pending` (the couple is asking) and **nothing further along**.

### The second ask is no longer born dead

The 7-day deadline was materialised only `WHEN lock_request_expires_at IS NULL`, so a couple asking **again** after a decline inherited the first request's dead deadline — expired on arrival, the vendor never got a chance, and the couple was told nobody replied. Now keyed on the **transition into `pending`**, so a re-ask gets a fresh window and a later touch of an already-pending row can never silently extend one.

### Owner rulings honoured

- **The handshake stamps no wedding date** — at either end. Verified: the migration writes no date column. The date is a property of the event narrowing to one candidate (2026-08-04 ruling).
- **7 days max** · **nudge at day 5** (column present; the sender is the next slice) · **the printed Locked QR stays one-step**, exempt.
- **`event_vendors.status` is not repurposed** — a post-condition asserts the enum still has exactly 6 labels.

### Both generated artifacts regenerated, not hand-edited

- `exposure-surface.baseline.txt` — 9 new `col` facts + 3 new `func` facts, all the new columns and RPCs, nothing unexpected.
- `user-fk-behaviour.generated.txt` — `SET NULL 144 → 146`, the two new `auth.users` references.

**Renumbered `20271105090000` → `20271107090000`**: the original sorted *below* the current head, which does not stop it applying in prod but replays it in the wrong order under PGlite, where the whole db suite runs.

### Verification

**773/773 db tests pass** with the migration replayed. Both freeze tests green.

⏭ **Not built:** the vendor's agree/decline card, the couple's waiting states, the day-5 nudge sender, and the expiry sweep. ⚠ **The fatal plan defect is still open** — `get_vendor_event_brief` raises `not_booked` unless the row is already confirmed, so the vendor cannot open the page the card was specified for. That is a UI-slice decision and does not block this data layer.

SPEC IMPACT: None — implements PR-H of `Explore_Replan_BUILD_SPEC_2026-07-27.md` §7 plus the owner's four 2026-08-04 answers.
