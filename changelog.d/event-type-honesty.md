## 2026-07-31 · fix(dashboard): stop selling vendors, Setnayan AI and weddings to vendor-free event types

Found by creating the first Simple Event ever created in prod and opening it.

**Hiding a door in the nav does not close it.** The 2026-06-27 Simple Event build
gated the NAV — `hideKeys` on `buildCustomerMenuTree` + `buildCustomerNavGroups`
drop Explore / Vendors / Budget when a profile sets `marketplace_enabled=false`.
Nothing gated the dashboard BODY. So a vendor-free event opened on:

- "Lock your reception venue → **Browse reception venues**" as its ONE open
  decision — a marketplace this type does not have;
- "Book a vendor · **21 categories still open**";
- a **Setnayan AI** card offering to build a venue shortlist and quoting a
  subscription price, on the one type where the 2026-07-27 owner lock says the
  assistant is *not offered at all* ("setnayan AI will not be available on simple
  event since it does not have vendors") — onboarding derives this correctly
  (`readServicesStepView` returns `ai: null`); this surface did not;
- "Your team · No vendors booked yet — start with the ones that book out first:
  your venue and catering", linking to `/vendors`;
- a **"Wedding day"** stage in the journey rail;
- and **"overdue by 315 days"** on an event created minutes earlier.

That last one is the tell. It is not a date bug: the wizard's lead-time ladder
says book a venue ~a year out, so a 50-day-out event is "overdue" by the
difference. The arithmetic was right — asking the question at all was the error.

**Gated at the SOURCE, not per render site.** `resolveProfileByEvent` →
`marketplaceEnabled`, and when false the vendor inputs (`vendorRowInputs`,
`remainingTaskCount`, `totalLockableCategories`, `topPriorityTask`) are empty. So
the cockpit derives no vendor decisions, the board grows no vendor groups, the
digest counts none, and the lead-time ladder never runs on a category that can
never be booked. One gate instead of one per surface plus a new one every time a
surface is added. DERIVED from the profile column, never `eventType ===
'simple_event'` — a future vendor-free type is covered without touching the file.

**Also fixed**
- `progress-stages.ts` — the day-of stage KEY stays `wedding` (a stable id) but
  the LABEL is now "Event day" on non-weddings. Reuses the `eventWord` already
  derived in the same function rather than adding a second test that could drift.
- The Papic studio greeted all 16 event types with "Wedding photo capture" and
  "unlimited cameras for the whole wedding". Now derived.
- The three guest claim interstitials said "a candid camera for the wedding …
  the couple's gallery". Made type-neutral rather than adding a DB read to a
  redirect page.
- The Drive storage note ("Weddings can run 30–60 GB") is now type-neutral —
  30–60 GB is a function of cameras × hours, not of what the day is called.
- **One camera, two names:** the crew page rendered `Free camera ${index - 99}`,
  which swallowed the free Papic One camera at its FIXED index 110 and printed
  "Free camera 11", while `papic-one-card.tsx` called the same seat "Camera
  #110". Now checks `PAPIC_FREE_ONE_CAMERA_INDEX` — a constant that already
  existed — before the range test, and names it "Papic One — free camera".

**Added** `lib/vendor-free-surfaces.test.ts` — pins the body gate at each seam
plus the stage label, so the next dashboard surface cannot quietly re-open the
marketplace on a type that has none.

SPEC IMPACT: None — this enforces the existing `marketplace_enabled` contract
(2026-06-27) and the existing Setnayan AI vendor-free lock (2026-07-27). No
pricing, SKU or scope change.
