## 2026-08-01 · fix(taxonomy): date + hangout — repair the dining dead end, widen date by two tiles, and guard the whole defect class

An audit reported that `date` and `hangout` surface only ~4 vendor tiles each. Verified against
prod, not the audit: the mapping is `service_categories.applicable_event_types` at tier 2
(admin-editable at `/admin/event-types/<type>/categories`), the reader is genuinely PERMITTED
(`service_categories_read_all`, `USING true` for anon + authenticated — so 4 is a real narrowing,
not an RLS denial), and the counts are real: `date` 4, `hangout` 4, `travel` 8, `wedding` 58.

**Why it is not simply "too thin".** The 4-tile reach was a deliberate authorial choice recorded
in `DECISION_LOG.md` 2026-07-22 ("a small reservation-centred reach"), and both types describe an
OUTING in their own `event_type_vocab` rows. What is NOT defensible is what sat underneath it:

**① The dining tile was a structural dead end.** Migration `20270902999627` widened the TILE
`restaurant_reservation` to `['travel','date','hangout']` but left its ONLY leaf on an older
`['travel']` override. The leaf override WINS (`lib/vendor-coverages.ts`) and the server ENFORCES
it (`parseEventTypes` in `coverage-actions.ts`) — so a date/hangout host SEES the tile while no
restaurant vendor can ever tick those types, meaning `vendor_coverages.event_types` →
`vendor_profiles.event_types` → `/explore`'s `.contains('event_types', […])` can never return one.
Empty FOREVER, not empty-until-launch, for the single most important category either type has.
Fixed by DELETING the redundant override (the leaf is the tile's sole child, so the override was
pure duplication — which is what let them drift) so it inherits the tile from here.

**② A photographer asymmetry.** `photo_video` listed 14 types including `hangout` but not `date`,
though its leaves are `engagement_photographer` / `pre_nup_photographer` /
`studio_portrait_photographer`. A barkada dinner was photographable and a proposal dinner was not.
Adds `date`; also adds `date` to `performers` for `acoustic_performer` (a serenade at a proposal
dinner — a real PH booking with no other home). Net: date 4 → 6, hangout 4 → 4 but fillable.

**③ The class, not the instance.** The same tile-vs-leaf mismatch turned out to affect **20 pairs
in prod**, and nothing could see it: `lib/taxonomy-tile-reachability.test.ts` guards the right idea
at the wrong grain (≥1 canonical at all, keyed off the CODE constant, which carries no event
scoping — `taxonomy-snapshot.ts` ships `tileEventTypes: {}`). Adds
`tests/db/tile-event-type-fillable.db.test.ts`, a migration-replay guard with a both-directions
self-cleaning allowlist recording the 18 pre-existing dead pairs (`gala_night` on five tiles,
`kids_entertainer:christening`, plus `editorial` and `filipiniana_barongs` — the latter already
documented as live-and-uncaught in the sibling guard's own header, and this is the first thing that
actually fails on it). Proven non-vacuous: with the migration removed, the guard fails naming
exactly `restaurant_reservation:date` and `restaurant_reservation:hangout`.

**Deliberately NOT done.** `travel` untouched (owner-gated — it keeps every type it has). Not added
and left for the owner: `stylist_decorator`, `hmua`, `photo_booth`, `arcade_games`, `mobile_bar`,
`catering`, `food_cart`, `dessert`, `tour_activity` — each is a hosted-party rental or a travel
construct, and several carry bridal/ritual leaves (`chuppah_rental`, `mandap_decor`, `bridal_hmua`)
that would read as noise. Whether `date`/`hangout` mean "an outing" or "a small hosted gathering" is
a product call, not a wiring fix. The 18 allowlisted pairs are likewise left for their own PRs —
widening another event type's reach is its own reviewable change.

No new table/function/view (nothing to REVOKE from `anon`); no RLS policy, `USING` or `WITH CHECK`
touched, so the exposure baseline is unchanged. No pricing or entitlement change.

SPEC IMPACT: `DECISION_LOG.md` — append a row recording (a) the `restaurant_reservation` tile/leaf
dead end and its fix, (b) the two tiles added to `date`, (c) the 18 known-unfillable tile × event-type
pairs now under guard, and (d) the open owner question of whether `date`/`hangout` are outings or
small hosted gatherings, which decides the nine tiles this PR declined to add.
