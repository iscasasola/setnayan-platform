## 2026-09-18 · fix(quotes): accepting a quote no longer claims it fills the plan

The supplier-facing quote builder and the couple-facing default quote body both
said "accepting adds it to their plan" — backwards. Owner ruling, 2026-09-18:
*"Plan should only fill at lock. not when accepted. accepting it allows the
user to test different builds properly"* (comparing combinations of suppliers
before committing to any of them).

The shipped behaviour already matched the owner's rule — `respond_vendor_proposal`
upserts `event_vendors` at status `shortlisted` on accept, and
`event_vendor_line_items` stays empty until Lock (measured on the platform's
first real quote: accepted 06:46, line items 0). Only the copy disagreed.

- `apps/web/app/_components/proposal-maker.tsx`: the caption a supplier reads
  while writing a quote now says accepting shortlists at that price and the
  plan fills only at Lock.
- `apps/web/lib/proposal-send.ts`: the default couple-facing quote body says
  the same thing.
- `apps/web/lib/accepting-a-quote-is-not-booking-it.test.ts`: guards that no
  copy under `app/` or `lib/` says accepting fills the plan, narrowly (does not
  convict unrelated "add to your plan" copy elsewhere).

SPEC IMPACT: None — copy-only fix aligning stated behaviour with shipped
behaviour; no schema or decision change.
