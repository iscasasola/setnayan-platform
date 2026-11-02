## 2026-09-09 · fix(chat): "Message" on a supplier's public profile / search card opens the conversation

Named but not fixed in [PR #5344](https://github.com/iscasasola/setnayan-platform/pull/5344),
now done:

- **"Message"** on a supplier's public profile or search card (`FollowGate`) landed on the
  couple's whole conversation **list** with the supplier's email typed into a "start a new
  thread" form that still needed submitting — even when a thread already existed.
- When the couple had **no celebration yet**, the same button linked to
  `/dashboard?prefill_vendor_email=…` — a query param the account launcher never reads and
  never forwards into create-event's `next` carry-through, so the supplier's address was
  **silently dropped** the moment the couple made their first event.

`FollowGate`'s Message control now goes through the same canonical resolver the four PR #5344
controls use — `ContactShortlistVendorButton` → (new) `contactVendorProfile` →
`startServiceInquiry` — which dedupes on the `chat_threads` UNIQUE(event_id, vendor_profile_id)
index. `contactVendorProfile` is a sibling of `contactShortlistVendor`, not a second
thread-opening mechanism: both anchor on the vendor's first active service and delegate to the
same `startServiceInquiry`; the only difference is which shortlist-free identifier they start
from (`FollowGate` only ever holds a marketplace `vendor_profile_id`, never an `event_vendors`
shortlist row).

The no-event case is now an honest doorway — "Start an event to message" → `/dashboard` — the
same shape `SaveVendorButton`'s `needs_event` state already uses (owner 2026-09-08: "this is a
search result outside an event"). The vendor is never silently dropped; pressing it and then
making an event is one more step, not a dead end.

⚠ Also removed in its own commit: the "Follow first, then chat" recovery panel on
`/dashboard/[eventId]/messages` (~100 lines, `page.tsx`) had no caller since 2026-09-08, when
`startThreadByVendorEmail` stopped redirecting with `?next_action=follow&vendor_profile_id=…`
(it now records the follow itself instead of bouncing the couple back). Verified by grepping
every caller of `next_action=follow` in the repo — none remained.

⚠ `lint-port-no-lost-controls` reported the removal (`FollowGate` dropped from
`/dashboard/[eventId]/messages`) — the one expected, deliberate loss. Baseline regenerated
after diffing every route's blocks/destinations/actions before vs. after: exactly that one
removal, no other route lost anything.

Measurement: `tsc --noEmit` — exit 0. `lib/one-action-to-reach-a-vendor.test.ts` (re-aimed, 3
new/updated cases) and `a-supplier-on-the-budget-page-can-be-reached.test.ts` (unchanged,
verifying the `contact-shortlist-vendor.ts` refactor didn't disturb PR #5344's behavior) — 7/7
and 8/8, exit 0. Both guards mutation-tested: reintroducing the old `prefill_vendor_email` href
flips 2 of the 7 tests red. `next lint` and every `scripts/lint-*.mjs` — clean.

SPEC IMPACT: None — no schema, no pricing.
