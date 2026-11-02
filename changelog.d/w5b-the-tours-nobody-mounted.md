# w5b-the-tours-nobody-mounted

## 2026-08-24 · feat(tours): the marketplace gets its mini-tour back, and the vendor gets a welcome tour at all

W5-B ("the surfaces nobody drew") re-measured its own brief first, and most of it
was already drawn: `/explore` ships in the terracotta system, 8 of 10 public Papic
routes render through the shared DoorShell, the onboarding question content
shipped 2026-08-20/21, and a guided tour ships as the centered-modal carousel.
What was genuinely missing was two tour handles:

- **`customer_vendors_v1` was defined and mounted NOWHERE.** Its mount was
  deliberately removed on 2026-05-31 (879c1c138) when the accordion replaced the
  card/stage page its copy described — and the copy was never rewritten, so the
  tour sat defined-but-unmounted for three months (the granted-capability-with-
  no-caller shape). The copy is rewritten for the Marketplace takeover a couple
  actually sees (browse the bench → build your team → save/compare plans), and it
  is remounted **inside the takeover branch only**, so the kill-switch accordion
  is never narrated by copy about a different page.
- **The vendor dashboard had no welcome tour at all** — couple, admin and guest
  each have one; the vendor (the role the 0030 spec gave 7 steps) had zero. A
  5-slide `vendor_welcome_v1` now mounts from the vendor-dashboard layout, gated
  on `users.tour_seen_keys` exactly like the couple and admin welcomes, and the
  profile page's existing "restart tours" affordance covers it with no change.

Guard: `app/dashboard/[eventId]/vendors/marketplace-mini-tour.test.ts` pins the
mount (comment-stripped occurrence count, position after `<ServicesTakeover`)
and the copy rewrite; the vendor mount is pinned beside it. All assertions
mutation-checked with counts printed before → after.

SPEC IMPACT: None (iteration 0030's Driver.js shape was already superseded in
code by the documented centered-modal decision; no spec claim changes).
