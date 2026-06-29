## 2026-06-29 · feat(reviews): right-of-reply — immutable + visible to all tiers (Soon-benefits Wave 1)

Two owner-decided polish calls on the already-shipped vendor right-of-reply
(both change shipped behavior; owner signed off 2026-06-29):

1. **Visible to every tier.** On the public profile (`apps/web/app/v/[slug]/page.tsx`)
   the vendor's reply was nested INSIDE the `showComments` tier gate, so a
   Free/Verified vendor's reply was hidden. Moved `VendorReplyBlock` OUT of that
   gate — the reply now renders under every review for all viewers, independent
   of the comment-body tier cap. Comment body + per-axis stats stay tier-gated.

2. **Immutable once posted.** New migration
   `20270318000000_vendor_reply_immutable.sql` re-locks `lock_vendor_reply` to
   reject any change to `vendor_reply` / `vendor_reply_at` once set (keeps the
   first-write auto-stamp). This **reverses the 2027-01-11 "editable" relax**
   (`20270111780655_vendor_review_response.sql` §1), restoring the original
   write-once contract from `20260514100000`. Removed the inline "Edit response"
   form from the vendor dashboard (`vendor-dashboard/reviews/page.tsx`) —
   `ExistingReplySection` is now read-only with a "final once posted" note;
   dropped the now-unused `Pencil` import; updated header + composer copy.

Surfaces complete: vendor composes one final reply, couple is notified + sees it
(now on every tier), admin sees replies in `/admin/reviews`. Typecheck + lint
clean.

SPEC IMPACT: Behavior reversal (reply immutable again + tier-gate relaxed for
the reply block). Owner-authorized 2026-06-29. Warrants a DECISION_LOG.md row in
the spec corpus; no schema table/SKU/pricing change.
