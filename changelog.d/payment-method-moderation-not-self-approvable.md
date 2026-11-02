## 2026-08-12 · fix(vendor): a supplier cannot mark their own payout destination "checked by Setnayan"

Fifth instance of the shape fixed four times already (`20271132839561` chat
sender · `20271132843141` broadcast sender · `20271132891176` self-promotion to
admin · `20271134103060` self-awarded experience mark).
`vendor_payment_methods` has two PERMISSIVE `FOR ALL` policies keyed on owning
the vendor profile, **zero triggers**, and nothing constraining
`moderation_status`.

| | before | after |
|---|---|---|
| vendor inserts with `moderation_status='approved'` | **ACCEPTED** | refused |
| vendor flips an existing row to `approved` | **ACCEPTED** | refused |
| vendor inserts *without naming* the column | landed **`approved`** | lands `pending_review` |
| vendor toggles `is_shown` / `is_primary`, deletes own row | worked | still works |
| admin console approves · bank & QR instant publish | worked | still works |

**What the column decides.** `lib/vendor-payment-methods.server.ts:64,128` filter
`.eq('moderation_status','approved')` — it gates whether a couple *sees* the
destination they are about to send money to. `lib/admin/queue-counts.ts:117`
counts `pending_review|held` — so it also decides whether the row ever reaches a
reviewer. Forging it did both at once: in front of couples, invisible to review.

### 🚨 The trap that would have made the obvious fix worse than the bug

The column DEFAULT was **`'approved'`**. So "revoke the column from the browser"
— the shape the two sender migrations used — would have shipped **silent
universal auto-approval**: every payment destination anyone adds, instantly in
front of couples and never queued. No error, nothing in a log.

That is the `coordinator_broadcasts` default trap inverted and worse, because
here the default *is* the privileged value. The DEFAULT flip is therefore
load-bearing, has its own META assertion, and has its own neutralisation test
that restores the old default and watches the silent approval reappear.

It also means "the forgery is refused" is **not a sufficient assertion** for this
table — it is equally true of that broken state. The load-bearing behavioural
test is the one that inserts without naming the column and asserts
`pending_review`.

### What is not a bug and still works

Instant approval for the safe lanes — bank details, a QR whose image decodes, a
link on the allowlist — is a deliberate product decision, not an oversight. It
survives unchanged from the vendor's point of view. What changed is **who
performs the approving write**: `addPaymentMethod` now inserts without the
column (landing `pending_review`) and, for those lanes only, flips to `approved`
through the service-role client. A vendor POSTing straight to PostgREST skips
that code and lands in the review queue — which is the point.

The follow-up write is best-effort and fail-safe: if it errors the row stays
`pending_review` (shown to nobody, visible to the reviewer), and the vendor is
told it is awaiting review rather than promised a visibility it does not have.

### The fix

1. `moderation_status` DEFAULT → `'pending_review'`.
2. `tg_vendor_payment_methods_pin_moderation`, BEFORE INSERT OR UPDATE: forces
   the value on INSERT, freezes it to OLD on UPDATE. The UPDATE half is what
   survives a future re-grant — the lesson from `20271132891176`.
3. Table-level INSERT/UPDATE revoked from `authenticated`/`anon`, re-issued per
   column minus the two moderation columns. The allow-list is **computed from
   the catalog**, not typed (precedent `20271005100000`): this table has 18
   columns, and a hand-typed keep-list is how a legitimate field silently stops
   saving — surfacing as "vendors can't add their bank details" and blamed on
   anything but the migration.
4. `addPaymentMethod` updated in lockstep, because the old code *named* the
   column and would now fail loudly.

**Guards.** New `apps/web/tests/db/payment-method-moderation-not-self-approvable.db.test.ts`
— 16 tests: anti-vacuity META (the DEFAULT assertion first; trigger covers both
verbs; policies still FOR ALL; real unprivileged probe role; service_role keeps
everything), behavioural coverage of all six rows above **plus the admin queue's
own predicate** (queue invisibility was half the exploit, so the queue query is
the assertion), and three NEUTRALISATION tests — re-grant and the trigger still
pins; restore the old DEFAULT and the silent approval returns; remove both halves
and the original forgery returns.

`supabase/security/exposure-surface.baseline.txt` regenerated — two columns
narrowed, nothing else moved, no widenings.

Prod rows: **0**. Nothing to backfill and the DEFAULT change cannot disturb
existing data.

SPEC IMPACT: None. No price, SKU or product-rule change — the review queue and
the instant-publish lanes both behave exactly as documented; only the party that
can perform the approving write has changed.
