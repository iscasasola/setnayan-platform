## 2026-06-26 · feat(guests): save a vendor you loved at an event → your future plans (Invite/Join v2)

The growth loop: a guest who loves a vendor at a wedding can save them to their own
Setnayan account, and the vendor is waiting when the guest later plans their own
celebration. Today's guest is tomorrow's couple, arriving with a shortlist started.

- **Migration** `20270226218747_guest_saved_vendors.sql` — new `guest_saved_vendors`
  (`user_id · vendor_profile_id · source_event_id`), owner-only RLS, unique per
  (user, vendor). An **account-level bookmark independent of any event the saver
  hosts** — deliberately distinct from `event_vendors` (the prior only-"saved" surface;
  owner-signed-off reversal of the "no favorites table" convention). *Applied to prod.*
- `lib/vendor-cards.ts` — shared marketplace-card hydration (display name w/
  hybrid-anonymity, slug, logo, category) reused by the two new fetches below.
- `lib/event-vendor-credits.ts` — `fetchEventVendorCredits(eventId)`: the couple's
  **booked** marketplace vendors (status contracted/deposit_paid/delivered/complete),
  read server-side (a guest can't read `event_vendors` under RLS).
- `app/[slug]/page.tsx` + `InvitationSite` — a **"Vendors who made this day"** section
  (RSVP/Event/Editorial, never Save the Date) listing those vendors with a **Save**
  button; account-gated (accountless sees "make an account to save"). `saveAttendedVendorAction`
  (`app/[slug]/actions.ts`) bookmarks to `guest_saved_vendors` (idempotent).
- Library Vendors tab — new **"From weddings you attended"** group
  (`fetchAttendedSavedVendors`) so the saved vendors live in the guest's account.

No type-regen needed (untyped client). typecheck ✅ · lint ✅ · production build ✅.
**Completes feature B of the Invite/Join v2 flow** (alongside A — the no-login photo grace).
Follow-up (optional): auto-seed these into a new event's plan when the guest starts planning.

SPEC IMPACT: extends `0000_ADDENDUM_invite_join_model_2026-06-25.md` §5 — syncing an account
also carries the vendors a guest liked at events they attended into their future planning.
