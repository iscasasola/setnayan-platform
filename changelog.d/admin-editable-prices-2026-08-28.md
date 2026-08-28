## 2026-08-28 · feat(admin/pricing): the owner sets the booking fee, the AI bands and the Papic ladder

Four price controls that were code constants become things the owner can set on
`/admin/pricing`, plus one data correction. **No price moves without an owner
ruling, and every ruling applied here is named.**

### 1 · The vendor booking fee is editable

The **5%**, the **₱100,000 threshold** and the **1% tail** move to
`platform_settings` and are edited under a new **"Vendor booking fee"** heading.

- 🔑 **The schedule existed in FOUR places, not two.** The arithmetic is mirrored
  (`public.booking_fee_centavos` — authoritative, ~6 SQL callers — and
  `lib/booking-fee.ts`), and so is the *sentence a supplier reads on their bill*
  (`public.booking_fee_schedule_summary` and `bookingFeeScheduleSummary()`). All
  four now read the same settings. Making only the arithmetic editable would
  have billed one rate and printed another — the exact defect `20271013349208`
  was written to close, one level up.
- ⚠ **Volatility: `booking_fee_centavos` and `booking_fee_schedule_summary` go
  IMMUTABLE → STABLE.** A function that reads a table cannot honestly be
  IMMUTABLE. **Measured in prod before changing it:** zero index expressions,
  zero column defaults or generated columns, zero CHECK constraints and zero
  materialized views reference either function, so nothing depended on the
  marker and nothing needs reindexing.
- ⚠ **The `20271009120000` post-condition could not survive as written** and
  deleting it would have been the wrong repair. Its four worked examples are now
  asserted *conditionally at the default schedule* (which this migration
  installs, so they genuinely run), while **continuity at the band edge, the
  floor, the ₱0 rule and monotonicity are asserted unconditionally against the
  live settings** — they must hold for every number an admin can type. That is
  more coverage than before, not less.
- 🔒 The **₱50 floor** and the **no-cap** rule stay fixed in code. The owner
  ruled on the taper and not on those; they are flagged on screen, not silently
  made editable.
- ⚠ **Two different 5%s now sit on one page.** `setnayan_pay_fee_pct` is a
  dormant **customer**-side gateway fee; this one is charged to the
  **supplier**. Separate headings, and each names who pays in its first line.
- Safe by arithmetic: prod holds **0** booking-fee charges and the feature is
  flag-dark.

### 2 · Setnayan AI: one discount, and a band per kind of celebration

New **Setnayan AI prices** tab, ported from
`prototypes/setnayan_ai_pricing_by_event_type_2026-08-28.html`.

- The band assignment moves from two code copies into
  `event_type_vocab.ai_price_tier`. **One kind, one band — structurally**: it is
  a single column on the kind's own row, so writing one band *is* unticking
  every other. There is no "clear the others" pass that could half-fail.
- ⚖ **Owner set ONE discount for all four bands: 40%**, replacing four per-band
  discounts that had drifted to 40.02 / 40.03 / 44.49 / 50.25. **No single
  number could preserve all four prices** — measured exhaustively at 0.01%
  steps; the best any value achieves is moving two. He chose 40% with that
  arithmetic in front of him.
- 🔑 **ROUNDING — and it is the reassuring part.** Whole pesos are a **rule**,
  not a preference: `20271176315255` ships a post-condition that RAISES on a
  fractional sign-up price, it is written to be re-run, and **all 66 priced
  catalog rows are whole pesos today**. 40% of ₱2,499 is ₱1,499.40, so the
  discount is rounded to the nearest peso, ties **down** (the direction that
  can only make the customer's effective discount deeper than advertised).
  At that rounding:

  | band | regular | sign-up before | after | change |
  |---|---:|---:|---:|---|
  | A `SETNAYAN_AI` | ₱2,499 | ₱1,499 | ₱1,499 | **unchanged** |
  | B `SETNAYAN_AI_B` | ₱1,499 | ₱899 | ₱899 | **unchanged** |
  | C `SETNAYAN_AI_C` | ₱899 | ₱499 | ₱539 | +₱40 |
  | D `SETNAYAN_AI_D` | ₱199 | ₱99 | ₱119 | +₱20 |

- 🔴 **BAND A IS THE LIVE, CHARGED ROW AND IT DOES NOT MOVE.** It is the only
  `is_active` row of the four and the only one that has ever taken money; at
  whole-peso rounding its sign-up price is byte-identical. **The two rows that
  do move are both switched-off price-source rows — but they are not inert:** a
  birthday resolves to band C, so a birthday couple buying at sign-up now pays
  ₱539 instead of ₱499. Called out here rather than allowed to ride along.
- `AI_TIER_ONBOARDING_FALLBACK_PHP` is updated in the same change —
  `ai-tier-ladder-matches-the-catalog.db.test.ts` caught the drift and named the
  file to fix, which is the guard working.
- ⚠ **`wake` is recorded as UNASSIGNED, not as a ₱899 decision.** Nobody chose
  ₱899 for a wake; it falls through the default. It still *resolves* to C, so
  nothing is re-priced and the SEC-5 tier-crossing guard stays undodgeable — but
  the screen shows it in a tray that asks the question. **The tray is permanent
  even when empty**, so the next event type added arrives as a visible question
  instead of being silently sold at the middle price.
- **Tier E has no price field at all** — "not offered" is not "free", and a ₱0
  in a price column reads as a free version somebody could switch on.

### 3 · Papic: five prices in, sixteen out

New **Papic shot prices** tab. He sets **five anchors**; **eleven rungs
compute**. An anchor fixes a price *per credit* which carries forward to every
rung below the next anchor.

- 🔑 **NOT ONE PRICE MOVES** — verified before building: all sixteen reproduce
  exactly, and both monotonicity senses hold.
- ⚠ **The fifth anchor (20,000) is load-bearing.** Without it, 20,000 and 30,000
  inherit 10,000's rate and rise by ₱1,400 and ₱2,100 — and 20,000 would cost
  exactly what two 10,000s cost, deleting the reason to buy it. Pinned by a test.
- 🔑 **NO SECOND SOURCE OF TRUTH.** The anchors are **not stored anywhere**; they
  are five of the sixteen catalog rows, and the derivation is **save-time** —
  the eleven are written into their own catalog rows. Afterwards there is still
  exactly one price per rung, in the catalog, read by
  `resolveRetailChargeCentavos` exactly as before. ⚠ **The residual seam, named:**
  editing a computed rung directly from the Pricing tab would drift it off its
  anchor; `papic-rungs-are-fundable.db.test.ts` is what catches that.
- **Papic's single discount is 10% and moves nothing** — all sixteen already sit
  there. The two derived layers compose in a fixed order (anchors → regular
  prices → discount → sign-up prices) with **no rounding disagreement anywhere**
  and not one fractional peso.
- 🔒 **The 10% floor is Papic-only** (owner: *"we will use the discount created
  for Papic Service Only instead of both"*). Setnayan AI is exempt.
  ⚠ **The floor WARNS; it does not refuse — and nothing has ever enforced it at
  write time.** It has only ever been a data fact set once by a migration. The
  **nonsense guard** (negative, 100%+, or a sign-up price ≥ the regular one)
  *does* refuse, for both families. **Nothing clamps** — a screen that silently
  rewrites what you typed is worse than one that refuses.
- A family-wide save shows **every row it would move, before it happens**. One
  box reprices sixteen rows; that warning is for the next person to nudge it.

### 4 · Live Studio is charged per event-day

`LIVE_STUDIO` carried `billing_period = 'one_time'`; the 2026-05-09 lock says
per event-day and all three of its retired predecessors are already `per_day`.

- 🔑 **THIS MOVES NO MONEY, and that was measured rather than assumed.** The
  charge path `resolveRetailChargeCentavos` **does not even SELECT
  `billing_period`** — the column never reaches the arithmetic. Its only
  consumer is `BILLING_PERIOD_SUFFIX`, a display map. `PATIKTOK_COMPILER` is
  already live at `per_day` and is not multiplied either. A three-day
  celebration is **not** billed three times; the card now reads "₱3,000 / day".
- ⚠ **A claim that came with this task, corrected: `billing_period` is NOT
  un-editable.** The catalog row editor has always rendered a
  `<select name="billing_period">` including "Per day of the celebration". The
  row drifted for some other reason. *"The fields nobody can edit are the fields
  that drift"* is a real lesson — this row simply is not an instance of it, and
  acting on the wrong cause is how the next one gets missed.

### Security — a net narrowing

- 🚨 **A new column inherits its table's grants, and `event_type_vocab`'s are
  wide.** `ai_price_tier` was born carrying **anon INSERT + UPDATE** — a column
  that decides what a customer is quoted. The exposure-freeze guard caught it.
- 🪤 **The obvious fix was INERT.** `REVOKE INSERT (col) … FROM anon` changes
  nothing while a **table-level** grant stands, and the guard duly reported the
  column still at `anon=SIU` after the revoke "succeeded". Revoked at **table**
  level instead. Verified safe first: every writer of that table goes through
  `createAdminClient()` (service_role). **TRUNCATE is why this is not merely
  tidy — RLS is never consulted for TRUNCATE.**
- ⇒ All **11** `event_type_vocab` columns go `anon=SIU` → `anon=S`, and the
  table loses INSERT/UPDATE/DELETE/TRUNCATE for `anon` and `authenticated`.
- The baseline was **read, not reflexively regenerated**. Its additions are
  SELECT-only: the band column (matching the table's public read policy) and
  four `platform_settings` columns at `anon=- authenticated=S`, which is exactly
  the deliberate posture `20271014400000` documents for that table.
- `setnayan_ai_price_tier` also gains a pinned `search_path`.

### Naming

- **"Price bands" → "Market price bands".** That tab is the vendor
  Price-Position feature — what suppliers in a category typically charge — and
  had nothing to do with what Setnayan charges. Two things one tab apart sharing
  a name is how the wrong screen gets edited. The tab **key** is unchanged, so
  every existing deep link and redirect stub still resolves.

SPEC IMPACT: `Pricing.md § 00` and
`Vendor_Monetization_Model_LOCKED_2026-07-25.md § 3` — the booking-fee taper is
now admin-editable (defaults unchanged); the Setnayan AI ladder carries one 40%
sign-up discount with bands C and D at ₱539 / ₱119; the Papic ladder is
expressed as five anchors; `LIVE_STUDIO` is `per_day`.

### Guard kept honest, not loosened

- `booking-fee-schedule-summary.test.ts`'s "the order description is derived,
  never a hard-coded rate" pin required `bookingFeeScheduleSummary()` to be
  called with **no argument**. Making the taper owner-editable is exactly what
  forced an argument (`liveSchedule`), so that regex encoded an incidental fact
  rather than the rule it exists to enforce. It now accepts no argument **or a
  single identifier** — never a literal, because
  `bookingFeeScheduleSummary({ rate: 0.05, ... })` is a hard-coded rate wearing
  a function call, and the sibling `(5%)`-literal assertion cannot see it. The
  blanket widening would have reopened that door through the argument.
  Mutation-checked red both ways (typed `(5%)`, inline schedule literal), and
  the second assertion proven to fire on its own.

SPEC IMPACT: None.

### Two blocking guards this PR had tripped

Both were its own code, and both had been hidden behind the failing unit step —
the aggregate never ran, so they only surfaced once the suite went green.

- **Radius tokens.** The AI-bands editor drew three ad-hoc corners. They now use
  the existing scale (`rounded-md` = 8px for the band badge and the toggle chip,
  matching the near-identical chip six lines up; `rounded-sm` = 4px for the 17px
  checkbox). 🪤 **This guard is ADVISORY locally and blocking only under CI's
  `RADIUS_LINT_STRICT=1`** — a local run exits 0 and prints a warning nobody
  reads. A guard that is advisory locally and blocking in CI will always be
  discovered late.
- **Vendor-layout revalidation — NARROWED, not baselined.** Saving the booking fee
  threw away the entire vendor dashboard shell, for every supplier, to refresh a
  number that shell never shows. Measured: the only component rendering the
  schedule in words is `vendor-tier-deltas.tsx`, mounted on `/vendors` alone, which
  the line above already covers; nothing under `/vendor-dashboard` renders it (the
  booking-fees page quotes the rate in a docblock, not in JSX) and its fee figures
  are per-order amounts stored at charge time, which a reprice does not move. Now
  page-scoped on `/vendor-dashboard/booking-fees`. **The baseline was deliberately
  NOT bumped** — a baseline is a bill, not a decision, and this bill did not need
  paying.
  🪤 `lint-vendor-layout-revalidate.mjs` **scans raw source and does not strip
  comments**, so a comment quoting the call it removed re-trips it. Named here, not
  worked around: the comment is worded without the literal.

SPEC IMPACT: None.
