# LAUNCH GATE · supplier sign-up + Apple upload (owner 25 Nov: "finish all that we need so we can launch, then the rest of the builds after")

Launch = suppliers can sign up and open a shop, and the iOS app passes App Store review. Everything on this list lands
first. Every other final-check build continues AFTER, in the normal order. The controller function-checks each PR; the
controller never merges. "Live" only after /api/health shows the commit.

## Must land (in this order where it matters)

| # | What | PR / branch | Owner of the work | State 25 Nov |
|---|---|---|---|---|
| L1 | Supplier plan info honest | #8305 | area 5 | ✅ LIVE (1bc2e44) |
| L2 | Live faults: help links, crash on odd links, dead-end demo, test shops not public (A1-151), promise words, commission line | #8310 | area 1 | fix: restore design-rules baseline |
| L3 | Supplier screens honest ("couldn't load", fit check) | #8314 | area 5 | fix: one assert line |
| L4 | Supplier sign-up keeps the shop (A1-059, Add 33: a supplier is a user with a shop) | NEW `claude/fc-fix-a1-launch` | area 1 | not started |
| L5 | Open a shop flow look (lane B B1–B3, approved) | NEW `claude/fc-fix-a5-lb-1` | area 5 | not started |
| L6 | Retired pages removed (lane R R1–R9; R2 and R8 forward to their new home) | NEW `claude/fc-fix-r-retire` | area 7 (coordinator) | not started |
| L7 | Bookings/payments honest | #8311 | area 6 | ready, CI re-run |
| L8 | On the day, chat honest | #8324 | area 6 | ready, CI re-run |
| L9 | Same date booked twice (A6-71; owner: the first registered wins) | #8331 (check) | area 6 | being checked |
| L10 | Supplier words and doors | #8318, #8320 | area 5 | ready, CI re-run |
| L11 | Guest offline words promise only what ships (A4-01/23); table QR must NOT leak | #8329 | area 4 | NOT READY: privacy leak |
| L12 | Admin guards (A1 guards first: approve/verify suppliers safely) | #8322 + next batch | area 8 | 9 guards missing |

Not required for launch (may land when ready): #8321 (speed; NOT READY: custom-domain sign-in leak), and every other batch.

## Rules for launch items
- Same FIXER-ORDERS rules. No baseline regenerated, no guard lowered, server actions ≤ 1251, migrations only through the pipeline.
- Lane R deletes: run the door check first; delete the page and its own files only; an old address that people may hold
  (R2 AI buy page → the Event Hub AI page; R8 API keys → dashboard) gets a permanent redirect; remove menu/sitemap entries;
  add a test that the route is gone or redirects.
