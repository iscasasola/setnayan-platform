## 2026-08-25 · feat(admin): the money page has the money

`/admin/money` shipped as a grid of links to settings pages, under a note that had
to apologise for itself — *"The act-now money queues — Payments, Payouts and
Subscriptions — live in Overview, not here."* The page named Money contained no
money.

Worse, no page in the console listed transactions at all. `/admin/payments` reads
orders with `.eq('status','submitted')` and payments with `status='pending'`, so it
shows only what is UNSETTLED; `/admin/receipts` lists receipts, which exist only for
orders that reached `paid`. A cancelled or lapsed order appeared nowhere, and the
first real sale (`S89O-BSTY3J0STT`, Setnayan AI, ₱2,499, paid 2026-08-25) dropped off
every money screen the moment it was reconciled.

🔑 **A QUEUE IS NOT A LEDGER.** A queue answers "what needs me now" and empties
itself by design. The owner asked how to *check and track* transactions — tracking is
the half that survives settlement, and that was the half missing.

**What ships:** a ledger above the settings grid — every order ever, newest first,
capped at 200, with buyer, what they bought, amount, plain-English status and a
receipt link. Three side reads (buyers, payments, receipts) are per-page, not
per-row. The "needs you now" strip reads the SHARED `getAdminQueueDigest()` — the
same fetch behind the nav badges, the topbar pill and `/admin/work` — so this screen
cannot disagree with them about what is outstanding.

⚠ **`requireAdmin()` is new and load-bearing.** The landing was a pure link grid with
no reads, so it carried no page-level gate. It now mounts a component that reaches
the RLS-bypassing service-role client, and the admin layout alone is not a safe auth
boundary in front of one (layouts don't re-run on soft navigation or a crafted RSC
request) — the same council fix `/admin` and `/admin/work` carry.

🪤 Our own test purchases look exactly like real revenue in a total. Internal buyers
are labelled "ours" on the row rather than filtered out, so the ledger stays complete
and still honest.

Money words are derived, never re-typed: `orderGrossOwed` for the amount and
`ORDER_STATUS_LABEL` for the status word. `null` renders an em-dash throughout — on a
money screen a confident ₱0 reads as "no money came in", a different and much worse
claim than "this did not load".

Guard: `app/admin/money/the-money-page-has-the-money.test.ts` — 4 assertions, each
anchored to a specific construct rather than matched file-wide, comments stripped
before matching, all four mutation-checked by occurrence count.

SPEC IMPACT: None — no product rule, price or SKU moves; this surfaces records that
already existed.
