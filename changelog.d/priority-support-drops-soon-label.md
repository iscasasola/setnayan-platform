## 2026-09-18 · fix(pricing): drop the stale "soon" label from Pro's Priority Support pitch (SUP-92)

`vendor-benefits.ts`'s Pro-tier "Priority support" benefit still carried
`soon: true`, but the feature is live end to end: `submitter_vendor_tier` /
`priority_rank` (migration `20270411213000_vendor_priority_support.sql`) are
written by `apps/web/app/help/actions.ts` on every vendor submission, and
`apps/web/app/admin/help/page.tsx` already orders the admin help inbox
`.order('priority_rank', { ascending: false, nullsFirst: false })` — a paid
vendor's message genuinely floats to the front of the queue. Removed the
flag; the other `soon: true` rows on the pricing page are untouched (not
re-verified here — out of scope for this fix).

SPEC IMPACT: None.
