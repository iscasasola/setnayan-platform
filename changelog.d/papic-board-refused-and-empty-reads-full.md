## 2026-08-27 · fix(papic): the couple's challenge board was refused on every render, and an EMPTY board was reported to them as FULL

Two defects, one cause. A couple opening their Papic challenges screen has, since 2026-08-23, been told their board is full and that they must delete a challenge to make room — on a board with nothing on it.

**The refusal.** `ensure_papic_board` is the only thing that writes `papic_missions.board_slot` — *which* challenges reach a guest and *in what order*. The couple's screen calls it through the couple's own session on every render; the guest route calls it through the service role. The pabati retirement (`20271159146115`) re-created the function with one argument instead of two (correct — the boolean it dropped gated the retired SKU) and then wrote `REVOKE ALL ON FUNCTION public.ensure_papic_board(uuid) FROM PUBLIC, anon, authenticated;` **with no matching GRANT.** The migration it was carrying forward (`20271126272662`) had a pair: revoke from `PUBLIC, anon`, then `GRANT EXECUTE ... TO authenticated`. The rewrite folded `authenticated` into the revoke list and dropped the grant.

**Measured in production before writing the fix**, by the object and not from a migration:

| function | `authenticated` may EXECUTE |
|---|---|
| `ensure_papic_board(uuid)` | **false** |
| `ensure_papic_auto_missions(uuid)` | true |
| `papic_challenge_pick_counts()` | true |

It is the only one of its family that is shut. And the function's own body still opens with *"Auth: the event's couple or coordinator, an admin, or service_role (server). NOT anon"* and `RAISE`s for a signed-in non-member — a guard that has been unreachable dead code since the revoke, which is the strongest evidence available that the revoke was a slip rather than a decision.

**🔑 Why nobody noticed.** Supabase does not throw — `.rpc()` resolves with `{ error }` — and the wrapper is deliberately fail-soft (`if (error) return 0`). Nothing logged, nothing raised, CI green throughout: the db tests call this function as **superuser** in the PGlite replay, where a missing grant cannot be felt. This is the "rejected, not thrown" family again, in its grant costume.

**The inversion, which is the half a person actually feels.** With the resolver refused, every `board_slot` stays NULL. The screen then read the only state it could see and concluded the board was *full*:

- `onBoard` (slot assigned) — empty
- `waiting` (active, approved, no slot) — everything the couple had chosen
- rendered: *"These N are waiting for a free spot — **hide one above to make room**."*

An unbuilt board is not a full one. The couple was asked to **delete their own work** to make room on a board that was empty, on the strength of a measurement that had failed. `0` was doing two jobs — "the board is empty" and "I could not build the board" — and the caller had no way to tell them apart.

**What changed**

- **`20271173829027`** — `GRANT EXECUTE ON FUNCTION public.ensure_papic_board(uuid) TO authenticated`, plus a `COMMENT ON FUNCTION` recording the history, because applied migrations are never edited and the two above will keep describing a revoke that no longer stands. Dry-run against production inside `BEGIN … ROLLBACK` first (the PGlite replay runs as superuser and cannot reproduce a grant problem). ⛔ `anon` is **not** granted and must never be: the function reads a NULL `auth.uid()` as "the trusted server", so an anon grant hands a stranger the board builder on any event. The existing db test pinning that is untouched.
- **`ensurePapicBoard` no longer returns a bare number.** It returns `{ resolved, slots }`, and a refusal is `console.warn`-logged instead of vanishing. Fail-soft is preserved — nothing throws and the capture surface still renders.
- **The couple's screen fails toward "we could not check".** A new `boardIsTrustworthy` gates every sentence that describes the board's occupancy. It is false when the resolver was refused, and also when the board came back empty while active challenges sit unslotted — which the resolver cannot produce (the couple lane is slotted first), so the two reads disagree and we do not know which is right. In both cases the screen says it could not work the board out, and **never asks for a deletion.**
- The guest route's discarded return value is now commented as deliberate: a guest keeps whatever board exists, which is the right failure for a phone at a party. The couple's screen is the one that must know the difference.

**Not-measured is never zero and never a limit reached.**

Safe by arithmetic today: production holds 40 missions across 2 events, **all** of them Setnayan fills placed by the service-role guest path, and **zero** couple picks — so no couple's own choice has ever been resolved onto a board, and there is no existing board for this to disturb.

SPEC IMPACT: None — no SKU, price, or product rule changes. `BOARD_SIZE` (10) and the couple/vendor lane split are untouched; this restores a privilege that was lost by accident and stops one screen making a claim it cannot support.
