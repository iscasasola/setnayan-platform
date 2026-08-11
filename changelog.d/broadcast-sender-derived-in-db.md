## 2026-08-11 · fix(day-of): the database signs a guest announcement, not the browser

Sibling of the `chat_messages` fix (migration `20271132839561`, PR #4353). Same
defect family — an attribution fact the browser was trusted to state — found by
sweeping for that shape immediately after fixing the first one.

`coordinator_broadcasts` is what the couple or their day-of delegate pushes to
every guest's phone mid-event ("phones down, the ceremony is starting"). Guests
are shown who it came from.

Reproduced against a full replay of the migration corpus before the fix, both
directions:

| | before | after |
|---|---|---|
| couple inserting `sender_role='coordinator'` | **ACCEPTED** | refused |
| coordinator inserting `sender_role='couple'` | **ACCEPTED** | refused |
| honest couple send | landed as **`coordinator`** | lands as `couple` |

**Milder than the chat case, and that is asserted not assumed.** Both INSERT
policies pin `sender_user_id = auth.uid()`, so nobody could impersonate a
different *person* — only the role *label* was forgeable. A META test fails if a
future policy edit drops that pin, because the severity would change.

**The difference that mattered.** `chat_messages.sender_role` is NOT NULL with
no default, so revoking the grant without a working trigger fails loudly.
`coordinator_broadcasts.sender_role` is NOT NULL **DEFAULT `'coordinator'`** —
take the column away from the browser and the default still fills it. The
obvious minimal fix (revoke `sender_role`, leave the rest) would have signed
**every couple announcement as the coordinator**, silently, with no error
anywhere — worse than the bug, which at least required someone to choose to lie.

What defuses it is revoking `sender_user_id` **as well**: nothing then fills that
column either, both policies require it to equal `auth.uid()`, and a missing
trigger becomes a visible refusal instead of a uniform mislabel. That revoke is
load-bearing here, not belt-and-braces as it is on chat.

Both directions are executed in the test rather than argued — one case drops the
trigger and asserts the loud refusal, the other additionally re-grants
`sender_user_id` and asserts the silent lie appears. The first was written
expecting the silent lie; the run corrected it, and the migration header now
records the correction.

**The fix**, mirroring `20271132839561`:

1. `authenticated` and `anon` lose the table-level INSERT/UPDATE grant; INSERT is
   re-issued per column minus `sender_role`, `sender_user_id` and `created_at`
   (the guest feed is newest-first, so choosing your timestamp is choosing your
   slot in it).
2. `tg_coordinator_broadcasts_derive_sender` (BEFORE INSERT) derives both sender
   columns from `auth.uid()`, mirroring the two INSERT policies branch for
   branch — couple member first, then accepted-and-not-removed delegate holding
   `schedule='edit'` — matching `resolveBroadcastAuthority()`'s own order.

Derivation is inlined in the trigger, not a helper function: a standalone
`SECURITY DEFINER` function in `public` is published by PostgREST as new RPC
surface, which `anon-rpc-surface.db.test.ts` and `exposure-freeze.db.test.ts`
refused when the chat migration's first cut tried it.

`day-of-broadcast.ts` stops sending both columns. Its comment claimed
"Attribution label only — the INSERT policies re-check real authority", which was
true of *whether* you may write and false of *whose name* goes on it; it now says
what the policies actually do.

**Guards.** New `apps/web/tests/db/broadcast-sender-not-forgeable.db.test.ts` —
19 tests: anti-vacuity META (including one asserting the `'coordinator'` DEFAULT
still exists, since this whole design rests on it, and one proving the fixture
couple and delegate genuinely pass their own INSERT policies, so the behavioural
tests cannot be vacuously green), behavioural coverage of both forgery
directions, backdating, the honest send reading back correctly, a stranger, and a
delegate holding only `schedule='view'`, plus four NEUTRALISATION tests.

`supabase/security/exposure-surface.baseline.txt` regenerated — 17 narrowings, no
widenings. **The branch was rebased onto current `main` first**: it was cut before
PR #4353 merged, so regenerating without the rebase would have overwritten main's
baseline with one that still recorded `chat_messages` as wide, silently undoing
that PR's guard.

SPEC IMPACT: None. No product rule, price, SKU or copy changes.
