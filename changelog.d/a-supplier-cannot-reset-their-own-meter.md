## 2026-08-26 · fix(vendor-papic): a supplier could reset their own meter — and mark their own file screened

`vendor_papic_captures_vendor_update` is `FOR UPDATE` with USING and WITH CHECK that both ask **one** question — *is this row on a profile you own?* — and constrain **no column**. Verified in production: `authenticated` holds UPDATE on **all 23 columns**, `hidden_at` and `nsfw_checked` included. Postgres checks the grant first, and the grant is there.

**🚨 1 · UNLIMITED FREE SHOTS.** `fetchVendorPapicPointsSpent` tallies a supplier's spend as their captures `WHERE hidden_at IS NULL`. PATCH `hidden_at` onto your own rows through PostgREST and **your spent count returns to zero** — shoot the entire allowance again, repeatably, with **no error anywhere**. The meter simply reads a smaller number.

**🚨 2 · AN UNSCREENED FILE REACHING THE COUPLE.** `vendor_papic_captures_member_read` shows a capture to the couple only when `nsfw_checked = true`. That same unconstrained UPDATE lets the supplier set it. **The safety screen is not the control if the uploader owns its verdict.**

🔑 **THE ROW IS YOURS, THE FIELD IS NOT** — the eighth instance of this exact shape in this schema (`DECISION_LOG.md` 2026-08-12, eight PRs, including #4366 where an uploader could pre-mark a photo `clean` so the screen never ran on it). **A PERMISSIVE policy saying "this row is yours" has no opinion about a field that records somebody ELSE's decision.**

⚖ **Latent today, not tomorrow.** Production holds **zero** vendor captures and the lane sits behind the DPO control (the route 403s). It stops being latent the moment this lane turns from a 5-shot documentation aid into a **500-photo gallery upload** — which is what the owner asked for on 2026-08-26 and what the allowance was re-sized for the same day.

## ⛔ Why a trigger and not a revoke — the tempting fix breaks capture

The vendor capture route **NAMES `nsfw_checked` in its own INSERT** (writing `false`, deliberately). **Postgres checks privileges against the columns NAMED, not the values written** — so dropping that column from the INSERT grant would fail every legitimate capture with a 42501.

This is the distinction recorded on 2026-08-12: **revoke** when no RLS client writes the column; **trigger** when the app must name it to write a specific *safe* value. This is the trigger case. And `REVOKE UPDATE (column)` against a table-level grant is a **no-op** — that inert "fix" has already been paid for once.

✅ **Verified it breaks nothing.** Both legitimate writes of these fields run on the **service role** — the post-screen verdict update and the admin paths. The only unprivileged write is the route's own INSERT of `nsfw_checked: false`, which the trigger forces to false anyway. There are exactly two writers in the codebase.

## 🛡 Guard — 6 rules, against the INSTALLED function, not the migration text

`tests/db/a-supplier-cannot-reset-their-own-meter.db.test.ts` reads the body back with `pg_get_functiondef` after replay: reading the migration file would pass even if it never applied.

- the trigger exists (anti-vacuum)
- **it fires on BOTH verbs** — *a guard is only as wide as the verbs it fires on*; #4361 was a correct guard attached `BEFORE UPDATE` only, and delete-then-reinsert sailed through it
- INSERT forces `nsfw_checked false` and `hidden_at NULL`
- UPDATE pins both to `OLD`
- **privilege is derived from `current_user`, never `auth.role()`** — the replay shim returns `'anon'` where production returns NULL, so an `auth.role() IS NULL` branch is **dead code in every db test in this repo** and the guard would pass while protecting nothing
- **the service role is still the decider** — without the privileged early-return the screen could not write its own verdict and every capture would stay unscreened forever

⚠ **These assert the RULE, not a refused forgery.** A pin does not refuse, it **overwrites** — so `assert.rejects` would be the wrong shape (RLS returns zero rows rather than throwing; that mistake is recorded). The behavioural half belongs with the vendor-capture fixtures when the lane leaves the DPO flag.

**Found by:** an adversarial pass over the upload design — and **not by any of its four skeptics**. It surfaced in the synthesis, from reading how the meter counts rather than how the upload writes.

**SPEC IMPACT:** None — it enforces the allowance model already recorded for 2026-08-26.

---

🪤 **THE GUARD READ ITS OWN EXPLANATION AND WENT RED — the third time this shape has been paid for here.**

The trigger carries a comment saying *"current_user, NOT auth.role() … every `auth.role() IS NULL` privileged branch is DEAD CODE in every db test in this repo"*. The rule below it bans exactly that string. **The function body was correct; the assertion was matching prose.**

Same family as the contrast guard that fired on the comment explaining the fix, and the naming census that matched its own ban list. **Strip comments before matching, every time** — the assertion now reads a comment-stripped copy.

**Mutations run against the REPLAYED schema, counts printed before → after:** the meter can be reset again (1→0) 🔴 · the supplier owns the verdict again (1→0) 🔴 · `BEFORE UPDATE` only — the #4361 half-fix (1→0) 🔴 · back to the dead `auth.role()` branch (1→0) 🔴 **two rules**. Green on both clean sides, run locally with the toolchain installed rather than discovered in CI.
