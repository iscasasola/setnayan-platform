## 2026-07-11 · fix(plan3d): the last 8 booth-staff wear a real garment (not white)

Gap-audit follow-up to #3028. Staff figures only get dressed when their outfit is
a STAFF kind (`isStaffOutfit`: chef_whites/apron/vest/uniform/robe) — but 8 of 57
booth templates assigned staff a GUEST-kind outfit (`suit` ×7, `barong` ×1), so
those staff fell back to the matte-white mannequin, defeating #3028's "differentiate
staff by garment" goal for exactly those booths.

Extending the figure to dress `suit`/`barong` was NOT an option — guests use those
outfits too (the lab derives guest attire → suit/gown/barong), and dressing them
would break the locked "guests stay matte-white" rule. So the fix re-maps the 8
rows onto staff-only kinds (guests never use these), which dresses the staff while
leaving every guest untouched:

- Host / MC · Bride's/Women's/Men's Attire consultants → **vest**
- Coordinator · Wellness & Fitness · Trophies & Awards attendants → **uniform**
- Choir → **robe** (the burgundy choir garment)

(Garment-per-booth is an easy owner tweak — the mechanism is what matters: no more
white staff. Now every booth's staff reads distinct.)

`tsc` + guards clean; the outfit values are all valid `OutfitKind`s.

Also noted (NOT fixed here — deferred): the guest venue walk still draws linked-
serpentine chairs non-even, because `public_venue_scene` (v4) doesn't return
`link_group_id`. Fixing it needs a NEW RPC migration (v5) replacing that prod
function — a high-risk change to a critical scene-load RPC for a low cosmetic gain,
so it's left for a deliberate, separately-verified pass.

SPEC IMPACT: None.
