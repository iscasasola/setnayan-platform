## 2026-08-29 · chore(catalog): delete 35 retired prices, lock the 8 that code still reads, and make Event Hub PRO say what it includes

Owner ruled 2026-08-28, of the 43 switched-off prices: *"delete them."*

**35 go. Eight stay** — application code reads their price by literal string
with **no `is_active` filter** and substitutes a hardcoded constant when the row
is missing, so no foreign key and no database-only check can see the dependency.
Deleting one moves **no number today** (every fallback is byte-identical); it
moves the price out of the pricing screen and into a deploy.

- 🚨 **Four of the eight are a NEW lock.** The per-row checklist this work was
  written from graded the `PAPIC_CAMERA_*_DAY` rates *"safe once their pointer is
  cleared"*. Measured otherwise: `fetchCameraRates` reads all four past
  `is_active`, and its output renders the **guest camera tier picker** and sets
  `requested_total_php` on a real `orders` row. Two of the four price a charge a
  couple can make today. `fallback-prices-match-the-catalog.db.test.ts`
  **exempts** `papic-cameras.ts` from its automatic pairing, so nothing was
  watching them.
- 🛑 **`pricing-removability.ts` claimed all three Papic tables CASCADE. One does
  not** — `papic_tier_config.rate_service_code` is `ON DELETE NO ACTION`, so a
  pointer it graded *informational* was the database refusing the delete. Pressing
  *Remove for good* on those rows returned a raw Postgres error. It now blocks
  with a sentence.
- 🔬 **Proved, not argued:** the migration's own statements were run against
  **production inside a rolled-back transaction** — 1 activation + 35 catalogue
  rows removed, no foreign key refused it, exactly the 8 left; prod re-read
  unchanged afterwards. ⚠ The PGlite replay **cannot** prove this half: prod holds
  68 catalogue rows (43 retired), the replay 33 (9), because most retired rows were
  created by an admin on the pricing screen and exist **only in production**.
- One non-catalogue row is removed: the single `event_software_activations_v2`
  row holding `LIVE_WALL`, on a **seeded sample** event (`is_sample = TRUE`).
  Nothing reads it for the wall any more, and `LIVE_WALL` is in
  `FREE_FOR_ALL_SKUS`, so that demo keeps its wall either way.

**Event Hub PRO now says what it includes — and stops claiming three things it
does not.** Owner ruled 2026-08-28: yes, say what it buys. Of the four
inclusions advertised in **three** places (the buy page, the Studio blurb, and
the description the **public** pricing page renders), three were untrue: **RSVP**
and **the on-the-day page** are gated on nothing — every guest-side read of the
SKU resolves the watermark and nothing else — and **Editorial PRO** went free for
everyone on 2026-08-23. The three things that ARE gated and were never mentioned
(background music + video hero, the couple's own photo gallery, their own site
colours) are now named. Copy only: no price, alias or gate changed.

Guards, all mutation-checked with occurrence counts before → after:
`lib/admin/retired-price-locks.test.ts` (5) derives the locked set from
`AI_TIER_SKU` and the camera SKU constants, so a fifth of either shape fails;
`tests/db/a-retired-price-can-still-be-load-bearing.db.test.ts` (4) proves the
eight survive the replay with usable prices and pins the camera rates to their
fallbacks; `says-what-it-includes.test.ts` (5) checks the Editorial PRO claim
**in both directions** — if it stops being free, the guard demands the claim back.

⚠ Flagged, not fixed: `site-chrome` and `our-photos` resolve the Pro gate with
`.catch(() => true)`, so a read error opens a paid feature. Existing behaviour,
outside a copy change.
⚠ Owner's call, not taken: whether Event Hub PRO should be repriced now that one
of its headline inclusions is free for everyone.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-08-28 "delete them" ruling carried out
(35 deleted · 8 locked, with the four-camera correction), and Event Hub PRO's
described inclusions corrected.
