## 2026-08-02 · fix(vendor): a Locked-QR claim now dates the event at 'day' precision

`public.vendor_claim_locked_qr()`'s (d0) block wrote the vendor's contracted date into
`events.event_date` but never touched `events.event_date_precision`, which defaults to
`'year'` on every new event. Countdown maths only runs at `'day'`
(`apps/web/lib/progress-stages.ts`), so an event dated by a signed vendor contract — with a
downpayment already taken against it — was skipped by everything that counts down and was
still being told to "Lock your exact date — narrowed, not final".

This is the same defect fixed for `studio/save-the-date/actions.ts` on 2026-07-30. That fix
called itself "the only `events.event_date` writer that didn't set precision alongside it";
it was the only **TypeScript** one. This is the plpgsql sibling.

**Is `'day'` honest here?** Asked, and answered yes — `events.event_date` genuinely carries
first-of-range PLACEHOLDERS at year/month precision, so this could not be assumed. The
token's date is not one: `vendor_locked_qr_tokens.event_date` has exactly one writer
(`vendor-dashboard/invite/actions.ts`, `/^\d{4}-\d{2}-\d{2}$/`), the generator offers a bare
`<input type="date">` with no vague mode, the issue action validates the date against the
vendor's calendar availability **for that one day** (`date_unavailable`), and the claim page
takes the couple's consent naming the formatted day. `'day'` is also the narrowest rung, so
this write can only narrow precision, never widen it.

**Downstream, verified not assumed:** `sync_event_date_status_trg` (20271033121603) promotes
`date_status` to `'locked'` only for DAY-precise dates, so this path also left `date_status`
permanently `'undecided'`. Fixing the precision fixes both, off the same UPDATE — the RPC
still writes no `date_status` of its own, because the trigger's "explicit intent always wins"
arm would then skip it.

- `supabase/migrations/20271033949806_locked_qr_claim_sets_event_date_precision.sql` —
  `CREATE OR REPLACE` adding exactly one `SET` clause (`event_date_precision = 'day'`) to the
  (d0) UPDATE. Body otherwise byte-for-byte 20270427212060: same signature, same
  `SECURITY DEFINER`, same verdicts, same money. **No backfill** — prod has 0
  `vendor_locked_qr_tokens` rows, 0 `event_vendors` at `source='vendor_locked_qr'` and 0
  `event_vendor_payments` at `method='qr_lock'`, so no event has ever been dated by this
  path. **No REVOKE/GRANT** — `CREATE OR REPLACE` preserves `proacl`; the post-condition
  asserts anon/authenticated/service_role keep EXECUTE and PUBLIC does not, so a narrowing
  fails as loudly as a widening.
- `apps/web/tests/db/locked-qr-date-precision.db.test.ts` — new regression guard (11 cases):
  the claim's precision + `date_status` promotion, money untouched (booking, frozen plan,
  seq-1 attributed vendor-confirmed downpayment), the legacy no-date token fabricating no
  precision, ACL reach, that `CREATE OR REPLACE` preserves the ACL, and a NEUTRALISATION case
  that strips the added `SET` clause out of the live function and asserts the drift returns.

SPEC IMPACT: None — no SKU, price, entitlement or policy changes. The RPC's callers, ACL and
money paths are untouched; this only makes the date it already wrote honest about its own
precision.
