## 2026-07-30 · fix(dx): money writes use a client that refuses the dev anon-key fallback

PR **B**, the last unlanded piece of commit `9743f1f4f` (the #3738 repair). A/C landed the
security-meaningful halves (#3929, #3930); this one is diagnosability.

### What it does

`createAdminClient()` falls back to the **anon key** in `next dev` when
`SUPABASE_SERVICE_ROLE_KEY` is unset, so pages render with degraded data instead of dying at
client construction. Right for a read. Wrong for a money write: since SEC-4b, INSERT (migration
`20271008178212`) **and** DELETE (`20271024090000`) on `public.orders` / `public.payments` are
revoked from `authenticated` and `anon`, so the statement fails with a bare `42501` that each
action absorbs into its generic "please try again". `createMoneyWriterClient()` refuses the
fallback and names the missing variable — including the non-obvious part, that `vercel env pull`
returns it EMPTY because it is marked Sensitive.

### ⚠ The risk, thought through: this changes `next dev` ONLY

The task flagged that deployed environments without the key would start throwing. They will not.
The fallback in `createAdminClient` is gated on `NODE_ENV === 'development'`; in production a
missing key already hits `throw new Error('Missing SUPABASE env vars for admin client.')`. So
**no deployed environment behaves differently** because of this PR — it buys a clear local error,
not a new production gate. That is stated in the function's own doc comment so the next reader
does not over-read it either.

### Scope

Converted **only** orders/payments INSERT and DELETE — 16 files. UPDATE was deliberately left on
`createAdminClient`: it was never revoked from the session roles, so it does not degrade the same
way (one `orders.update({status:'cancelled'})` in the guest-buy abandon path was converted by an
over-broad first pass and reverted).

Read paths were **not** touched. A first pass with a looser regex did convert ~38 read statements
across 16 files; every one was reverted, and the leftover unused imports it left behind were
removed. The final diff is money-write files only.

### Two guards, because one was not enough

1. **Wiring** (extended `lib/order-price-authority.test.ts`): every orders/payments insert **or
   delete** across `app/` + `lib/` must resolve to `createMoneyWriterClient`. This is broader than
   the file's existing `mintClients` scan, which only looks at `.insert` — DELETE degrades just as
   badly. **It immediately earned its place**: it found 8 order-INSERT call sites that a
   hand-written `grep` had missed, because they use the multi-line
   `await admin\n.from('orders')\n.insert(orderRowFor(…))` form.
2. **Behavioural** (`lib/money-writer-refuses-fallback.test.ts`, new): the function itself throws
   on a missing key, names the variable, `.env.local` and `vercel env pull`, refuses an
   **empty-string** key (exactly what `vercel env pull` writes), and still constructs when the key
   is present.

Guard 2 exists *because* a mutation exposed the gap: neutralising the check inside
`createMoneyWriterClient` — turning it into a plain alias — left the wiring scan fully green. The
wiring scan only knows WHICH function is called, never what it does.

**Mutation-proved:** revert one call site to `createAdminClient` → wiring test fails. Neutralise
the guard → 3 of 4 behavioural tests fail. Accept an empty-string key → 1 fails. Restored → 20/20.
Wider run: **946/946** across order / payment / money / sku / vendor / booking tests.

### Two existing assertions had to be generalised

`isServiceRoleClient` and the custom-plans mint assertion both hard-coded `createAdminClient` /
`await admin`, so switching a call site read as a regression. Both now accept either service-role
constructor — `createMoneyWriterClient` **is** `createAdminClient` plus a refusal. Pinning one
identifier in an assertion makes a legitimate refactor look like a break; noted in the code.

SPEC IMPACT: None — no behaviour change in any deployed environment (see the risk note above).
`DECISION_LOG.md` row added 2026-07-30 closing the #3738 recovery.
