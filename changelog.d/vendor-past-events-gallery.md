## 2026-07-18 · feat(vendor): venue-matched past-events on the public profile (safe layer)

The vendor's public profile now shows a **venue-aware gallery of the vendor's
past events** (owner 2026-07-18). When a logged-in couple views the vendor, the
vendor's completed events at the **same venue** surface first ("Weddings at your
venue"); with no match it falls back to the most recent ("Recent weddings").

- **"Same venue" = exact venue** (owner's choice): the structured venue-directory
  id when both sides have one, broadened to a **normalized venue-name match** (the
  directory link is sparse, so name-match is what usually fires), then latest.
- **Reuses** the anti-fraud-clean `vendor_completed_events` list already fetched
  on the page; enriches it with venue facts. `lib/vendor-venue-events.ts` (pure
  matcher/sorter + service-role enrichment) + `_components/venue-matched-events.tsx`;
  6 unit tests. No new schema.

**SAFE LAYER — no couple PI.** Each card shows only **venue · month/year · event
type** — never the couple's names or photos — and **events a couple set to
private are excluded** (private-by-default respected). This is the vendor's own
professional track record; it does not re-host any couple's wedding.

The **couple-identified, photo-bearing "rich layer"** the owner also wants (each
past event's full detail + gallery photos on the vendor page) is a deliberate
**follow-up** — it re-hosts couple/guest PI on a commercial page, so it needs a
NEW per-event "let booked vendors feature my wedding" consent column + DPO/counsel
sign-off (the repo is mid-NPC-filing). NOT built here.

`tsc` 0 · lint clean · full unit suite green (+6).

SPEC IMPACT: None to the corpus schema. The feature + the safe/rich split is
recorded in `DECISION_LOG.md` (2026-07-18). The rich layer's new consent column
is flagged for owner + DPO before it can ship.
