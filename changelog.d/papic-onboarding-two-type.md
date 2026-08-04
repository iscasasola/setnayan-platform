## 2026-07-29 · fix(onboarding): point the two Papic onboarding keys at the two-type model

PR2 of the Papic two-type model — the **data/display layer only**. PR1 (#3868 + #3869)
shipped the mechanics and the catalog; this makes the surfaces that quote them tell the
truth. The services-step card UI is PR3.

**The defect.** `INAPP_TO_SERVICE_CODE` still mapped `papic_seats → PAPIC_SEATS`, a SKU
deactivated by PR1 — and an inactive code takes the missing-row degrade path, so that card
rendered **blank**: price 0, empty label, `not_built`. `papic_guest → PAPIC_GUEST` was
legitimate again, but every string around it still described the retired pax-priced
"Papic for guests / from ₱2,999" pack rather than the flat ₱1,000 pool top-up it now is.

**Remapped** (key strings unchanged — they are stable identifiers written into
`style_preferences.interested_services` on every saved draft; only what they point at moved):

- `papic_seats` → `PAPIC_CAMERA_MINI_DAY` — Papic **One**, a dedicated camera with its own
  QR and its own unshared shots. Was `PAPIC_SEATS` (₱2,999 · 5 seats), now inactive.
- `papic_guest` → `PAPIC_GUEST` — Papic **Pool**, a flat ₱1,000 additive top-up.
  Verified on prod: the row is `is_pax_priced = false`, so `formatSkuPriceLabel` renders a
  flat "₱1,000" and the "from ₱X" pax path no longer applies to any live SKU.

**Market anchors removed for both Papic keys** (`OUT_ANCHORS`, and their `INAPP_VS`
strings). They were sized against the dead products — `papic_seats: 75000`
("vs 5 hired photographers") and `papic_guest: 32000` ("vs 20+ disposable cams"). Against a
₱50 camera and a ₱1,000 top-up they would have claimed savings of ₱74,950 and ₱31,000: a
1,500× and 32× "bargain" on the screen where a couple decides what to trust us with. This is
the same failure the 2026-07-21 degrade-path fix stopped, arriving from the other direction,
and the same rule applies — silence is honest, a fake bargain is not. **No anchor was
invented to replace them**; if the owner wants a compare-at on either card it needs a real,
like-for-like PH figure and is a pricing decision, not an inference.

Also fixed, same cause: the featured-service card rendered its struck-through compare-at
**unconditionally**, so any service without an anchor showed a crossed-out "₱0" — reading as
"this used to be free". Now gated on the same `save > 0` condition as the savings line.

**`/pricing` — one live falsehood, one invisible product.**

- Papic One's capacity was derived from `papic_tier_config.points_per_day`, which the
  two-type lock set to `NULL` on prod. `NULL` means *unlimited* to every copy helper, so the
  page told couples a ₱50 camera shoots **"unlimited shots per day"** when it holds 50. The
  One ladder now reads `papic_one_tiers` (the lifetime shot bucket) via a new
  `readPapicOneTiers()`, and renders `papicBucketPhrase()`. Both rungs (₱50/50 · ₱100/100)
  now appear instead of only the cheapest.
- The reactivated Pool rows belong to no `ADDON_GROUPS` entry, and `resolvedGroups` can only
  render codes listed in a group — so Papic Pool was quoted by the estimator while the price
  list carried no row for it at all (the trap the `LIVE_STUDIO` comment records). Added a
  synthetic collapsed `PAPIC_POOL` "from ₱X" row, mirroring the existing `PAPIC_CAMERAS`
  pattern. No prices, no catalog rows, and no page structure were changed.

Admin `/admin/event-types/[type]/onboarding` no longer humanizes the two keys into
"Papic Seats" / "Papic Guest" — it shows the same names the couple sees.

No test pinned the old mapping; none needed updating. 5301 unit tests pass.

SPEC IMPACT: None — `DECISION_LOG.md` already carries the owner-locked 2026-07-29 two-type
row that this PR implements. No price, SKU, or catalog change: PR1 owns the numbers.
The removal of both Papic compare-at anchors is a display-claim reduction flagged for owner
sign-off in the PR body.
