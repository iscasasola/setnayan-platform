## 2026-09-08 · fix(vendor): the supplier sees who is asking

The owner accepted the first real inquiry in the platform's history and the
thread page still read **"Couple"**, a **"C"** avatar and **DATE · Not set yet**
— against an event row saying `display_name = 'Cale & Ice'`,
`event_date = 2026-12-18`. The inbox and bookings lists said **"Event"**.

**Two independent layers hid the customer, and only one was the mask.**

1. **RLS.** A vendor is not an `event_members` row, so `public.events` is
   unreadable to them. Measured in prod on the accepted thread itself:
   `vendor_is_event_member = 0`. This fires regardless of accept state — so
   every surface's "revealed" branch read an RLS-nulled `event.display_name`
   and rendered "Event" too.
2. **The mask** — anonymization-until-accept (Glass PR-6b ·
   `Vendor_Inquiry_Anonymization_Spec_2026-07-15`).

🔑 **Removing the mask alone would have changed nothing on screen.** The fix is
that surfaces now read the customer through `fetchInquiryCustomerFacts`
(admin-scoped, batched), which is what the list surfaces already did for the
placeholder's event-type/region — extended to return the name it was
deliberately withholding. The thread page reads `events` with the `paxAdmin`
client it already uses for three sibling reads on the same event.

⚠ **`events` RLS was NOT widened to vendors.** That would hand every supplier
every couple's event row, including couples who never contacted them — far
wider than the ruling. The reads stay admin-scoped and each CALLER proves
vendor ownership; `the-supplier-sees-who-is-asking.test.ts` pins that pairing.

**The mask is deleted, not disabled** (owner ruling 2026-09-08: *"we do not need
to hide anything, since no more tokens"*). It was the token wallet's storefront
— the retired module said so: *"identity is what the token buys"* — and the
wallet was retired 2026-05-11, so for four months it withheld a name and sold
nothing. Its residual privacy argument does not survive the data model either: a
`chat_threads` row exists only because the couple wrote to that one supplier.

Removed: `lib/inquiry-mask.ts`, `maskVendorThreadEvent`, the rail's `masked`
branch, and the placeholder on six surfaces. `lib/inquiry-mask.server.ts` →
`lib/inquiry-customer.server.ts`. `get_pending_inquiry_basics` keeps its one
consumer removed but the function is left in prod, unused.

Also fixed here: the rail rendered **`2026-12-18`** because its prop was
documented "pre-formatted" while the only call site passed the raw Postgres
value — a mismatch no type could catch, both being `string | null`. Now
`December 18, 2026` (owner, same day). And the pending-inquiry copy no longer
says accepting is *"free"*, a last trace of the wallet.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-07-15
`Vendor_Inquiry_Anonymization_Spec` is SUPERSEDED by the owner's 2026-09-08
ruling. Applied to the corpus in this commit.
