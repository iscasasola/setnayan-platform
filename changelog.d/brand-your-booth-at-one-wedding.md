## 2026-09-05 · feat(vendor): brand your booth at ONE wedding — ₱500 per event, beside the ₱3,000 cycle

Owner 2026-09-05: *"500 per event. or 3000/4 week cycle."* · *"unverified vendors
cannot purchase here and free. only paid vendors (solo, pro and enterprise)"*.

The vendor 3D Booth had one shape — a 28-day cycle branding every client's room
(`vendor_3d_booth`, ₱3,000 flat since #5187). A vendor with one wedding this month
had no reason to buy it. This adds the second shape: **one event, one-time, no
clock** — the booth stays branded for as long as the couple keeps their room up.

- **Migration `20271205905484`**: seeds `vendor_3d_booth_event` (₱500,
  `offering_type = 'vendor_addon_per_event'` — an *existing* vocabulary value
  from the Photo Challenge's original shape, so no re-listed CHECK), and creates
  `event_branded_booth_vendor_ids(p_event_id)` — SECURITY DEFINER, granted to
  **service_role only** (the `vendor_papic_challenge_entitled` precedent); the
  exposure-freeze guard refused a first draft's `authenticated` grant, and this
  is the narrower answer. `fetchBooths` takes a `brandedReader` for that one
  read; both session-client callers pass the admin client, and the guard derives
  every `fetchBooths(` call site from the tree to keep it so.
- **The grant is the order row.** No new table, no new column: `orders` already
  carries `vendor_profile_id` + `event_id` + `service_key` + `status`. A
  paid/fulfilled row on (vendor, event) IS the entitlement. No `sku-activation`
  entry needed — approval is a plain status flip and the row already answers.
- **Why the RPC exists:** `orders_owner_read` is `user_id = auth.uid()`. A direct
  read under the couple's session returns `[]`, and the couple's lab would draw
  a generic booth while the public walk (admin client) drew the branded one —
  two renders disagreeing about one fact, with the wrong one looking exactly
  like "nobody paid".
- `lib/vendor-3d-booth-event-pricing.ts`: pure `boothBrandedAtEvent` (cycle OR
  per-event), `boothEventOrderState`, the catalogue price read, the RPC read
  (fail-soft to empty but **logged**), the vendor's own order-state read. One
  `*_FALLBACK_PHP` + one `*_SKU_CODE` in its own module so
  `fallback-prices-match-the-catalog` can pair them.
- `lib/seating.ts fetchBooths`: one RPC call per fetch; `boothAddonActive` is now
  the OR of both halves — the single boolean `boothIsBranded` reads, so logo,
  poster and the crowd-avoidance disc can never disagree.
- `booth-event-actions.ts`: every gate the cycle has (own shop · manage ·
  3D kill-switch · paid-plan floor · verified · on sale) **plus** booked-on-this-
  event via the same `get_vendor_event_brief` RPC the page mounts on, **plus**
  not-already-branded (a live cycle, or a paid/pending per-event order). Mints
  the order **with** `eventId`, `status: 'submitted'`, then the ONE payment page.
- `booth-event-section.tsx` stands in the retired "unlock the 3D Plan for this
  couple" slot (booked-only) and draws every state — cycle covers it · branded
  here · payment under review · needs a paid plan · needs verification · buyable
  — because a vendor who cannot see *why* they are generic assumes the product
  is broken. Points at the cycle for vendors with several weddings a month.
- `lib/brand-your-booth-at-one-wedding.test.ts` pins the OR, the RPC-not-direct
  read, gate order + event scope on the mint, the migration's vocabulary reuse
  and scoping, the one-fallback pairing, and the mount.

Break-even at the owner's figures is six events per cycle (₱3,000 / ₱500) —
stated in `DECISION_LOG.md`, not a recommendation.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-05 rows already record the two prices and
the floor; the per-event window ("life of the room, not a clock") is added there.
