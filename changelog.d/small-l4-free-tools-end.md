## 2026-09-11 · feat(vendor-dayof): dated end for the free day-of tools, shown to shops (Q7)

Owner ruling 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS" Q7): *"Dated end, shown to shops"* — the free day-of tools for booked shops during launch need an end date shops can see, set now (e.g. three months after public launch), never guessed.

RULE 0: `app/vendor-dashboard/on-the-day` (list) and its `live/[eventId]` console are the shipped "day-of tools" — the generic module kit every booked vendor gets, free, with no expiry anywhere in code. `lib/vendor-dayof-frame.ts`'s own invariant keeps that generic kit ungated on every access path ("Free-during-launch is active and every production vendor is on a free tier"), pinned by its own identity test — left untouched. The separate DB-driven `promo_free_windows` "all_vendors" mechanism already promotes vendor subscription tier for free on its own admin-set windows; that is a different lever (billing tier, not the day-of console) and out of scope for a single config value.

Built `lib/vendor-dayof-free-until.ts` — the ONE new config value the launch date lives in (`NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL`), defaulting to unset ("no date yet" — never invented). While unset, both pages behave byte-identical to today: always free, no copy about an end. Once the owner sets the date, the launcher shows "Free until <date>" and the console (list + live) stops opening past it, showing an ended state with an upgrade CTA to `/vendor-dashboard/subscription` instead.

Tests: `lib/vendor-dayof-free-until.test.ts` (11 cases — env read, fail-open on unset/unparseable, inclusive end instant, copy present only when set). Mutation-checked (flipped the unset fail-open branch; 1 test failed as expected, restored from an explicit backup). Typecheck clean, lint clean.

SPEC IMPACT: None (config value lives in code/env, not the spec corpus — the public-launch date itself is still an owner decision, unset here).
