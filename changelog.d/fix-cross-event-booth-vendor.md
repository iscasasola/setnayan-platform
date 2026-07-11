## 2026-07-11 · fix(security): stop cross-event vendor leak on the seat-plan floor

Follow-up to the booked-vendors booth picker (#3060). An adversarial review
found the cross-event guard that #3060 added to `saveBooths`
(`nullOutForeignBoothVendors` — nulls any `event_vendor_id` that isn't a BOOKED
vendor of THIS event) was **bypassable via the sibling `autoArrange` server
action**, which parses + persists booths with the same links but never called
the guard. A couple holding their own event's seating lock could POST
`autoArrange` with a booth `event_vendor_id` belonging to a DIFFERENT event; the
link persisted, and the public `public_venue_scene` RPC (which LEFT JOINs
`event_vendors` with no event scope) then surfaced that vendor's public identity
(name / logo / category) on the couple's published floor plan — a cross-event
data leak.

Two independent barriers:

- **Write side (defense-by-construction).** `nullOutForeignBoothVendors` is
  moved INTO `persistBooths`, the single choke point every caller (`saveBooths`,
  `autoArrange`, and any future one) passes through — so the guard can't be
  forgotten again. Removed the now-redundant explicit call in `saveBooths`.
- **Read side (defense-in-depth).** New migration
  `20270718457937_public_venue_scene_v6_vendor_event_scope.sql` recreates the
  public RPC with `AND ev.event_id = v_event_id` on the booth→`event_vendors`
  join, so a foreign link can never leak at the public sink even if one already
  existed. Byte-identical to the v5 (linkGroupId) definition except that one
  clause; idempotent `CREATE OR REPLACE`, signature + SECURITY DEFINER unchanged.

Verify: `pnpm --filter web exec tsc --noEmit` clean; `next lint` clean;
seating tests 108/108; `migration:check` 716 unique.

Known follow-up (NOT security, out of scope here): the public `public_venue_scene`
RPC still omits `entrance_kind`/`entrance_depth_m`, so the public guest walk
renders a walk-through entrance as a plain door until that payload is extended.

SPEC IMPACT: None (security hardening of shipped behavior; no product-surface or
pricing change).
