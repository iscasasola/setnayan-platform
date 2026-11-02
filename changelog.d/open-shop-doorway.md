## 2026-08-10 · fix(wayfinding): a signed-in customer can open a shop

Reported against `testnayan4@test.com`: the account has no shop and the
dashboard offered no way to make one. Verified in prod — that account is
`account_type='customer'` with 0 shops and 0 team seats.

`/open-shop` was **already finished** and already handles this exact state
("logged in, no shop → the onboarding wizard"). Nothing was rebuilt. What was
missing was the door.

**Every doorway to it pointed somewhere a signed-in customer never goes:**

- `/vendors` — the PUBLIC marketing page (3 links), not linked from any
  dashboard surface.
- `/vendor-dashboard/shop` — reachable only if you already have a shop.
- `redirect('/open-shop')` in `vendor-dashboard/shop/page.tsx` — **dead code.**
  The vendor-dashboard *layout* bounces any non-vendor to `/dashboard`, and a
  layout runs before the page it wraps. It reads like a safety net and can
  never fire.

**Added two doorways, because they reach different people:**

- `account-switcher.tsx` — "Open your shop" in the footer, beside "Your Story".
  This is the one that reaches a couple with exactly **one** event: they are
  redirected straight into that event (`active.length === 1 && !hasConsole`)
  and never see the launcher at all. Two of the five prod test accounts are in
  exactly that state.
- `dashboard/(launcher)/page.tsx` — an `OpenShopRow` create-door in the
  "Yours to run" tile, which is headed with a Store glyph and offered
  everything except the shop. Same idiom as the `CreateSamahanRow` and
  `BecomeStorytellerRow` already in that file.

Both gated on not already having a shop, so a vendor never sees "Open your
shop" next to their existing Shop console.

**This is the third time this exact defect has been fixed in this codebase** —
Creator's Lab (readiness verdict 2026-07-16 · B4) and Samahan were the first
two, and the comment naming the rule ("a page ships with its doorway") sits in
the very panel that was missing this link.

Copy is honest: "List your business for free" is the shipped promise on
`/vendors`. The review line is load-bearing, not a hedge — a new shop is
created hidden + unverified and only an admin can publish it (owner
2026-07-27), so implying couples would see it immediately would be the
overstated-copy mistake.

Guarded by `app/open-shop/has-a-doorway.test.ts`, deliberately narrow (a
blanket "every route must be linked" check fires on redirect stubs and QR
deep-links). All 5 assertions mutation-tested — each one sabotaged
individually, each went red, the file restored green. A third assertion pins
the dead redirect as unreachable so a later reader cannot mistake it for a
doorway.

SPEC IMPACT: None. No decision, price, or scope changed — this implements the
already-locked wayfinding rule.
