## 2026-09-22 · fix(copy): CTRL-B3 — say the true thing

### 11 — no shop page promises a review the product cannot generate

Every shop page said *"Bookings through Setnayan generate a review request 24 hours after the
event."* Three things were wrong: **nothing generated a request at all** (gated on
`service_marked_complete_at`, set on 0 of 51 and never asked for until CTRL-B2); the code's own
intervals are **7 and 30 days**, not 24 hours; and `vendor_reviews` is empty, so it had never once
happened.

🔑 **The replacement names no duration at all.** The brief asked for the number to be derived from
`reviewState`'s constant — but **a sentence with no number cannot drift from one**, and the steps are
what a couple actually needs. A hand-typed duration is how this said 24 hours in the first place. The
guard asserts the **property** (no hand-typed interval), so a reword to "7 days after" fails too.

### 8 — the download page stops contradicting itself

The hero correctly branches on `mac.signed` and says *"Not yet notarized by Apple"*; a `Value` card
outside both branches then told the same visitor the build was *"notarized by Apple"* — one page, two
answers, the wrong one louder. Now gated on **the same fact**, not a copy of the condition.

### 3 — the one real orphan route gets a door

`/website/stories` — the host choosing which supplier-authored stories appear on their celebration
(owner, 2026-08-15) — had **no link from anywhere in the app**; only its own `actions.ts` and two
tests named the path. Every other apparent orphan turned out to be a deliberate redirect.

It now sits on the launch controller's `setOnce` list, beside `our-story` and `guest-columns` —
whose own comment records that those two were "reachable from the hub and NOWHERE else" and would
have been orphaned by the fold. This one was already in that state and simply had no hub entry to
lose.

### 7 — a filtered Explore card names the trade that matched

`vendor-card.tsx` took `vendor.services[0]` unconditionally and **nothing passed the filter in**, so
a couple filtering by Florist could be shown *"Photography by X"*. New pure
`card-headline-service.ts`: with a filter, name the match; without one, today's behaviour exactly.

⚠ **Exact match only.** The filter vocabulary and `vendor_profiles.services` overlap but are not the
same list (`/v/[slug]`'s SUP-14 comment records `serviceGroupOf` returning UNDEFINED for `live_band`),
so a fuzzy match would invent a trade the shop never claimed.

Guards: `the-page-says-what-is-true.test.ts`, `card-headline-service.test.ts`. **9 sabotages red.**
🪤 One sabotage stayed green and exposed a weak test rather than a weak guard: `'live_band'` contains
`'band'`, so swapping `===` for `.includes()` produced the same answer. A discriminating case was
added — the fuzzy match now jumps past the first service and fails.

### 6 — skipped, taken by CTRL-B2
### 1, 10, 12 — held for the owner (the 0% commission wording and the `-fix` slug)

SPEC IMPACT: None.
