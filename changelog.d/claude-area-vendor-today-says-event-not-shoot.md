## 2026-09-19 · fix(vendor-today): the Today page says "booking", not "shoot" (AREA-VENDOR)

The owner, as Saysay (a host-and-band shop), saw "Your next shoot is on the books." and a "Next shoot" tile. Every supplier reads the Today page — a band, a caterer or a florist does not shoot. The focal headline and the countdown tile now say "booking"; the shop-website "About" placeholder says "the couples you work with".

Test: `app/vendor-dashboard/_components/the-today-page-speaks-to-every-supplier.test.ts` renders both tiles with the owner's case (one booking, a confirmed ₱2,000 deposit on ₱10,170) and asserts on the markup; reverting either word turns it red.

SPEC IMPACT: None.
