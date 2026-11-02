## 2026-08-06 · sec(privacy): the anonymity floor allowed a band built from ONE peer

### The hole

`platform_settings.radar_min_n_floor` is the minimum number of distinct peers a
market band needs before it may be shown. Its CHECK allowed `>= 1`, and **prod
was set to 1.**

Seven functions gate on it via `min_n_ok()` — `demand_radar_for_vendor` ·
`demand_radar_admin` · `recompute_market_funnel_bands` ·
`recompute_market_price_bands` · `rival_signals_for_vendor` ·
`service_card_records` · `trusted_circle_vendor_signal`.

At a floor of 1, a band can be built from a **single** other vendor — and its
p25 / p50 / p75 are then **that vendor's exact reply rate, reply time and
conversion**, published to a competitor under the label "anonymised benchmark".
At n=2 the median still gives them away.

The feature's own docblock promises *"quantiles-only … no peer identity by
construction."* At n=1 that promise is simply false.

⚠ **Nobody has been exposed.** `market_funnel_bands` has 0 rows and the recompute
is an admin "Run now" that has never been pressed (verified in prod alongside 2
vendor profiles total). This closes the hole while it is still theoretical — the
moment that button is pressed at a floor of 1, the exposure is real **and
retroactive**.

### Two numbers, two jobs

| | value | why |
|---|---|---|
| **CHECK** | `>= 3` | the safety rail. Below 3 an individual is readable out of a quantile. No admin, however well-intentioned, can go there. |
| **operating value + column default** | `5` | what the code already uses. At n=3 the p25/p75 sit almost on the extremes; at n=5 they are genuinely interior. |

A range rather than a single number: if a thin category later needs 5 relaxed, an
admin can drop to 3 — a real decision, inside a safe band. They can never drop
into the identifying zone.

### 🔑 Three copies of one rule, all disagreeing

- the migration default and prod: **1**
- `lib/funnel-benchmark.ts` docblock: *"held >= 3"*
- `lib/vendor-funnel.ts` `FUNNEL_MIN_N`: **5**

And `vendor-funnel.ts` called itself *"a TS mirror of the shipped SQL
`public.min_n_ok`"* — false by a factor of five. Setting the SQL value to 5 makes
that sentence true; both comments are corrected here, and the CHECK is now the
authority.

This is the same shape as nearly every defect found on 2026-08-06: **one fact,
several homes, and the copies drifted.**

### The guard

`tests/db/anonymity-floor.db.test.ts` asserts the database **refuses** 0, 1 and 2
with the named constraint; still **allows** 3, 5 and 12 so the knob stays usable;
the shipped value is `>= 3`; the column default is `>= 3` so a fresh environment
cannot be born identifying; and `min_n_ok(1, 5)` is false.

**Sabotage-verified:** relaxing the CHECK back to `>= 1` fails it by name.

⚠ **Honest limitation:** removing the second `UPDATE` (the raise from 3/4 → 5)
does NOT fail the suite, because in a fresh replay the first `UPDATE` already
lifts 1 → 5. That statement only matters for an environment already sitting at 3
or 4. Recorded rather than papered over.

### Verification

`tsc` exit 0 · all 15 lint scripts pass · 22 db tests pass (the new 5 plus the
existing platform-settings suite) · migration guard passes (1,061 migrations).

Raising a floor only ever suppresses MORE, so no data is destroyed and no
existing surface can start showing something it previously hid.

SPEC IMPACT: None — no product decision changed. This corrects a privacy control
to the value the code already claimed it had.
