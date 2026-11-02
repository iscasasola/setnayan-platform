## 2026-08-26 · feat(admin): the six jobs the owner actually does, on the page he lands on

Read out of `admin_audit_log`, 20 May – 8 Aug 2026: **65 admin actions, every one of
which falls into six groups with nothing left over** — prices & what we sell (34 ·
**52%**), categories (9), test data (9), shops (6), the website (4), the team (3). The
console offers 94 recorded actions; 16 have ever been used.

🔑 **"Pricing" appeared ZERO times on `/admin`.** More than half of everything the owner
has ever done had no entry on the front screen, while twelve queue tiles reading zero
did.

⚖ **RULE 0 changed this build from a rewrite into six tiles.** The Overview is NOT an
undesigned tile wall: the exception desk (the one `.sn-tile-dark` the view allows), the
lane bento with its documented blur budget, and the count-less "More queues" contract are
all deliberate. They are untouched. The only thing missing was the other half of the
question — the page answered *"what needs me"* and never *"what do I want to change"* —
so `<WhatYouChange />` is added directly under the focal and everything else keeps its
place.

**Built to not drift:** each tile resolves its href from the canonical
`ADMIN_NAV_GROUPS` **by key**, so a nav change carries the tile with it; a key that stops
existing **throws at render** rather than shipping a dead tap. Shares are FIXED, not
recomputed — the six are a statement about what the product needs, not a leaderboard
that reorders itself under you.

🎨 Gold (the slot named `terracotta`, 3.37:1) is used on the icon and the hairline only —
never on anything read — and the guard pins that in both directions.

Guard: `app/admin/the-home-shows-what-you-change.test.ts` — 4 assertions, comments
stripped before matching, each anchored to a construct rather than a file-level substring.

SPEC IMPACT: None — no product rule, price or SKU moves; six links to pages that already
exist.
