## 2026-08-21 · fix(payments): the ONE payment page, corrected — six defects found by attacking my own change

An adversarial review of PR #4676 (five independent lenses, two skeptics per finding,
18 candidates, 6 survived) found six real defects **in that PR**. Every one is fixed here
and each is now guarded by something that fails when the defect returns.

### 1 · 🚨 Approving a shop's plan payment could never switch the plan on

The new activation hook called `approve_vendor_subscription` through `ctx.admin` —
`createAdminClient()`, the service_role key, which carries **no user**. `auth.uid()` is NULL,
`is_console_admin()` is false, and the function RAISES `FORBIDDEN: admin only` before touching a
row; the dispatcher's catch swallowed it. **Reproduced against production.** So the admin
approved the payment, the shop was told *"your order is fully paid"*, and their plan stayed off —
the exact harm the hook's own comment claimed to prevent.

🔑 **THE POWERFUL CLIENT IS THE ONE THAT CANNOT DO THIS.** service_role bypasses RLS *policies*
and fails every check that asks WHO IS THIS. `/admin/subscriptions` already had it right and says
so in its own docblock.

Fix: `ActivationContext` gains the approving admin's own `sessionClient`, supplied at the call
site; the hook **refuses** when it is absent rather than falling back to a client that cannot
succeed.

🪤 **AND THE GUARD THAT SHIPPED WITH IT WAS DECORATION** — it counted source occurrences of
`assertOrderOwnsVendorTarget(` and string-matched the RPC name. Both were present and correct.
Replaced by two things that can actually fail:
- `tests/db/plan-activation-needs-a-real-admin.db.test.ts` — **calls the function**: with no
  `auth.uid()` it must refuse and leave the purchase untouched; as a real admin it must flip to
  paid; a second confirm must answer "already".
- `lib/admin-gated-rpc-needs-a-session.test.ts` — the admin-gated function list is **derived from
  the migrations** (a hard `IF NOT is_console_admin() … RAISE`, not a mere mention, so it does not
  cry wolf), and no source file may call one on a service-role client.

### 2 · 🔴 That guard immediately found a PRE-EXISTING one

`fetchAdminOutcomeOverview` has been calling `admin_inquiry_outcomes_overview` on the service-role
client. Its own comment read *"uses the service-role admin client; the RPC still self-gates on
is_console_admin()"* — **that sentence is the reason it failed, not the reason it worked.** The
admin intelligence card has been rendering a permanently empty state from a read that never once
succeeded and never once complained. Now on the admin's own session.

### 3 · One tap could permanently remove the only way to send proof

Neither field was required and the submit button sits below them, so a stray tap wrote a payment
row with no screenshot and no reference — unreconcilable — and, because the page hid the form once
anything was logged, it also took away the only way to send the real thing. **The same trap fired
on the intended path**: an admin pressing *"ask for a better picture"* sets the payment to
`resubmit_requested` and deliberately leaves the ORDER alone, so the payer got an email asking for
a clearer shot and arrived at a page with no way to send one.

Fixed both halves: an empty claim is refused with a message naming what is missing, and the form
comes back (carrying the admin's own note) whenever the latest payment is `resubmit_requested` or
`rejected`.

### 4 · The page was a second door around the coordinator money-consent gate

`orders_owner_read` admits ANY event member, so a coordinator invited **without** payment
permission could log a payment claim here that the couple's own order page refuses in as many
words. Same lock, same words, now on both doors. Eventless orders (a shop's plan) skip it — there
is no couple to ask.

### 5 · Every payment made through the page counted ₱0 against the receiving-account cap

The rail was stored as `'GCash'` / `'BDO'`; `/admin/settings/payment-methods` matches `'gcash'` /
`'bdo'` **exactly** to measure how much room the personal receiving account has left this month.
The meter read clear while the account filled up. Now lowercase, with the reason written down.

### 6 · A finished order would have shown a live QR

`statusOf` listed `'expired'` and `'failed'` — **neither is a real `order_status` label** — and
omitted `'fulfilled'` and `'lapsed'`, which fell through to "still wants money". Rewritten
exhaustively over the eight labels read out of production, unknown values **fail closed**, and it
is split into `lib/payable-status.ts` so it can be unit-tested at all (the resolver imports
`server-only`, which throws outside Next).

### 7 · One plan payment was counted twice in the admin revenue dashboard

A plan purchase now exists in both `orders` and `vendor_subscriptions`, and
`/admin/app-performance` counted both — ₱7,000 reported for a ₱3,500 plan, skewing the mix the
owner reads to decide what is selling. The order row is that purchase's PAYMENT SURFACE, not a
second sale.

### Tests

- 10 assertions on the page (was 6) + 4 on `payable-status` + 2 on the admin-gated-RPC guard +
  3 db tests. **Six sabotages, every one measured by occurrence count** (sessionClient→ctx.admin ·
  lowercase→'GCash' · empty-claim refusal 1→0 · coordinator gate 1→0 · needsBetterProof 4→0 ·
  `case 'fulfilled'` 1→0), all six RED, baseline and restore green.
- 9,195 unit tests green. Typecheck and lint clean.

SPEC IMPACT: `DECISION_LOG.md` — appended to the 2026-08-21 ONE-payment-page row.
