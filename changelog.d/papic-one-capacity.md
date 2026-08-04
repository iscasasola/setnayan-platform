## 2026-07-31 · fix(papic): a camera's advertised capacity now comes from the table the grant reads

The extra-cameras picker advertised **"No limit · archived to your Drive"** on a
₱50 camera, directly above a Papic One card correctly offering "₱50 — 50 shots,
that camera's own". Same product, same price, contradictory capacity, one screen.
It became visible once #3953 removed the two retired rungs that had been sitting
between them.

**It is not a copy mismatch — the picker was the one that was wrong, and it was
selling.** On approval, `papic_grant_camera_points()` branch (B) — the legacy
multi-camera `PAPIC_CAMERAS` order this picker mints — does:

```sql
SELECT t.points FROM papic_one_tiers t
 WHERE t.service_code = 'PAPIC_CAMERA_MINI_DAY' AND t.is_active;
v_per := COALESCE(v_per, 50);
INSERT ... points = v_per ... WHERE ps.tier = 'mini';
```

A finite bucket (50 on prod), after which the fail-closed reserve stops the
shutter. So a couple paid for an unlimited camera and got a metered one.

**Cause:** the picker read `papic_tier_config.points_per_day` — the RETIRED
per-camera-per-DAY meter, whose entry row is `NULL` on prod, and `NULL` means
"unlimited" to every copy helper. `lib/papic-tier-config-read.ts` documents this
exact trap in its own header ("a surface that still derived One's capacity from
the tier config rendered 'unlimited shots per day' for a camera that actually
holds a bucket — reading the rung table is what makes the claim true"). This
picker was the surface still falling into it.

**Fix:** `ExtraCameraRung.pointsPerDay` → `points`, resolved from
`papic_one_tiers` keyed by `papicRungSku(rung)` — the same table, keyed the same
way, as the grant. Rendered through `papicBucketPhrase()` (the sanctioned helper
for a lifetime bucket), which also discloses the one-purse trade-off. A rung with
no tier row now says **nothing** about capacity rather than guessing.

**Added** `lib/papic-camera-capacity.test.ts` — pins the invariant in one
sentence: *a display surface may never decide capacity for itself; it reads what
the enforcement path reads.* Asserts the picker carries no `pointsPerDay`, never
prints an unbounded claim, and that the page keys the lookup by rung SKU so a
rung with no row goes silent instead of inheriting another rung's number.

⚠ Note for the owner: this is the **third** defect on the same line in one day
(hardcoded clip divisor → wrong field → now fixed). All three were the same
mistake in different clothes. The two copy guardrails caught my own explanatory
comments while I wrote this, which is them working.

SPEC IMPACT: None — no price or SKU change. The camera always granted this
bucket; only the advertisement was wrong.
