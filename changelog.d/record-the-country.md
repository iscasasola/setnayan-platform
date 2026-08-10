## 2026-08-10 · feat(vendors): the country a shop is in is now recorded, not assumed

Owner: *"just place that variable. so it will be easy to add countries next time. but for now, it is true that it will be just philippines for now for the vendors."*

**Still Philippines-only.** Nothing a vendor can do changes — this is the seam.

### What was actually wrong

The geocoder has **always returned the country and the app has always thrown it away**. So *"this vendor is in the Philippines"* has been an **assumption**, true only because `lib/geo.ts` restricts both lookups to `countrycodes=ph`. The moment that line changes, every existing row becomes a country nobody wrote down.

🔑 **Adding the column while one value is correct is the cheap moment.** The backfill states a fact that is provable today and unprovable later: every shop in the table was pinned through a Philippines-restricted geocoder. Doing this after the map opens would mean guessing which of the old rows were PH.

### The seam

`lib/phone-rules.ts` is now the one place that answers *"given where this shop is, is this number real?"* — one entry today.

The point is not the map, it is that **the country flows through as a value**: captured from the pin → posted with it → stored on the shop → passed to the rule. Adding Singapore later is a new entry, not a new argument threaded through every call site under live data.

🔑 **It fails CLOSED.** An unsupported country falls back to the Philippine rules rather than accepting anything, so if the map is ever opened without that map being updated, foreign numbers are **refused**, not waved through. A refusal gets reported by the person in front of it; a silent acceptance never does. Mutation-tested in that exact direction.

🔑 **And when the second country arrives, do not hand-write its rules.** The Philippine rules were hand-written and within an hour had missed an entire carrier's mobile range and accepted area codes the plan never assigned — one country, written carefully, from the plan. Two hundred is not a bigger version of that job; it is a numbering-plan database, and one exists. The shape here makes that a one-file swap. **The same day, the wizard steps must be reordered** so location comes before the number — recorded where it will be read.

### Three guards fired, all correctly

- **The data-export projection.** A new column that is not listed silently drops out of a person's RA 10173 export. Added.
- **The exposure freeze.** Regenerated in this PR, as the rule requires. The diff is **one line** — `hq_country anon=- authenticated=SIU`, identical to `hq_address` and **stricter** than `location_city` and `hq_latitude`, which anonymous visitors can already read. Nothing widened.
- **My own earlier guard**, which pinned the old function name. Signup now goes through the country-aware seam; pinning the old name would have blocked exactly the thing being built.

Stored only alongside real coordinates — a country with no pin is a claim about a place nobody marked. Shape-checked in the action as well as by the column's `CHECK`, because that action takes direct POSTs. The `CHECK` constrains the **shape**, deliberately not the value: pinning it to `'PH'` would make opening a second country a migration under live data, which is the thing this column exists to avoid.

Verified: **7521/7521** unit · **967/967** database · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: recorded with the Philippines-only ruling.
