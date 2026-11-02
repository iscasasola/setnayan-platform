## 2026-08-10 · fix(papic-games): the guest board was never built — and the couple's list showed the wrong thing

Owner 2026-08-10: *"just make sure the lists of the papic challenge is properly listed."* The data was clean. The lists were not.

### 🚨 1 · No Setnayan challenge has ever reached a guest

`app/api/papic/guest-missions/route.ts` calls `ensure_papic_board` through the **service-role** client, because a Papic guest is zero-account — there is no `auth.uid()` to present. The route's own comment stated the belief it rested on: *"auth.uid() IS NULL → the couple/coordinator/admin gate is bypassed for the server."*

That was true when written. On **2026-08-01**, migration `20271030569442` hardened `ensure_papic_auto_missions`, verbatim: *"a missing session is now a REFUSAL, not a bypass."* And `ensure_papic_board`'s **first act** was `PERFORM ensure_papic_auto_missions(...)`.

So every guest-path call raised, the board transaction aborted, the route's `.catch(() => 0)` and the wrapper's `if (error) return 0` swallowed it, and the v4 reader **fail-softed** to *"no board → show every active mission by created_at"* — a plausible-looking list. Consequences, all silent: **no library challenge (errand or story) offered to any guest · no booth mission generated for any booked vendor** (the §3 commercial core) · the §9.4 hero ranking and the 20-slot cap never applied · a guest saw only what the couple typed by hand.

**Reproduced, not inferred:** against the full replayed prod schema, `ensure_papic_board(<event>, false)` with a NULL session raises and leaves the event with **0 setnayan missions, 0 board slots**. Prod holds 0 `papic_missions` across 0 events — pre-launch, so no wedding was harmed. It would have failed on the first real one.

**The fix is not "let a NULL session through again"** — that would reverse a deliberate security fix. 🔑 **The defect is where the check LIVES.** `ensure_papic_auto_missions` is both a public RPC *and* an internal step of another SECURITY DEFINER function; putting authorization inside the shared step means the caller's own already-passed gate gets re-litigated under rules written for a different caller. **An entry point authorizes; a step does the work.** So they're split: `papic_generate_booth_missions_unchecked` holds the body with no auth and `EXECUTE` revoked from `anon` + `authenticated`; the public RPC keeps the 2026-08-01 guard byte-for-byte and delegates; the board keeps its own guard and calls the step.

🔑 **The belief that rotted was about a function the file does not name.** A comment asserting how a callee's callee behaves has no way to notice when that callee is hardened. `rpc-argument-names.db.test.ts` could never have caught this — the arguments were always right. A db test now calls the exact guest path with a NULL session and asserts a board comes back.

### 2 · The couple's list answered neither question they have

It was **one flat list in creation order** — the order vendors happened to get booked, which matches no other screen and means nothing to a couple. Worse, the 20-slot board silently drops the overflow, so a couple could read a list of 24 with **no hint that four of them reach nobody**.

Now: the board is resolved on load (the resolver's own guard names the couple — it is the caller it was written for; idempotent, advisory-locked, materialize-once), the list is ordered **the way a guest sees it** with the position shown, and it splits into **"What your guests see"** and **"Not showing"**, the latter saying whether each is waiting for a free spot or hidden by them. Each row now also carries what the guest is asked to *do* — Photo · On camera · Video greeting — because *"Brag about the bride for ten seconds"* and *"Catch the cake"* read as the same kind of item otherwise. A failed read now suppresses the list instead of rendering *"No challenges yet"*, which was a confident lie about an event that may have twenty.

### Data audit (the literal ask)

60 library rows · **no id gaps · no duplicate titles · no duplicate prompts · 0 inactive** · ranks 1–16 used, 17–20 free headroom · categories and capture kinds all valid.

Tests — 31 unit + 20 db. Four new db guards: the server can build a board with no session (**the regression guard** — revert the one-line fix and it goes red), the public RPC still refuses a sessionless caller, the internal step is granted to nobody, the board builder is not granted to `anon`. Plus three on the list's own states: a fresh board is 20 contiguous slots in rank order · the overflow really does sit off-board · hiding one frees its slot for the one that was waiting. **Mutation-tested** — reverting the fix turns 4 red. Typecheck clean, 20 `lint-*.mjs` green, migration guard green (1084), and the exposure-freeze / anon-RPC-surface / UGAT schema guards all pass.

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` — §9.3b note on the couple's list; `DECISION_LOG.md` rows added 2026-08-10.
