## 2026-08-29 · fix(pricing): the Setnayan AI band the owner ticks is the band that charges, and its price is editable where he sets it

Owner 2026-08-29: *"i need to be able to edit the prices here as well (the
regular price) and the onboarding and pricing for setnayan AI must not be
hardcoded but rely on the data here"* — of `/admin/pricing?tab=setnayan-ai`.

### 🔴 The tick-box wrote a column that nothing charging ever read

Measured against production, not inferred. `event_type_vocab.ai_price_tier` —
the column that screen writes — had exactly **three readers**: the surface that
draws it, the action that writes it, and `setnayan_ai_price_tier()`, a
`SECURITY DEFINER` function whose only callers are **two test files**.

Every charge resolved the band from `AI_TIER_BY_EVENT_TYPE`, a **hardcoded map
in TypeScript**. `setnayanAiTierSkuForEventType` is a pure function with no I/O,
so moving a kind of celebration into a different band changed what the admin
screen said and **not one peso of what anybody paid**. A control that looks like
a price decision and is a no-op — the gate-with-no-handle shape, on money.

⚠ **Nobody was mispriced, and per-event pricing is ON in production**
(`setnayan_ai_per_event_pricing_enabled = true`). All 17 kinds carried identical
values in the column and in the map, so the two agreed *by never having been
used*. It was latent and would have fired on the owner's first use of the
feature he was given last week.

🔑 **The database already had it right and nothing called it.** The SQL function
reads the column correctly. Two correct implementations and one hardcoded one —
and the hardcoded one was the only one wired to money.

### The fix

`lib/setnayan-ai-band-source.ts` resolves the band from the owner's own screen.
The map survives as a **genuine last resort**, answering only when the row is
legitimately absent (an unseeded CI database, a kind nobody has banded) — which
is exactly what `AI_TIER_DEFAULT` was written for.

⚠ **A failed read REFUSES.** This is a second read on the money path, so it gets
SEC-7's treatment: discarding `error` would turn "the database would not answer"
into "this kind has no band", which resolves to the middle band and charges a
price nobody chose. That is the identical collapse SEC-7 removed one layer down.
An unrecognised value in the column also degrades rather than being cast through
to `AI_TIER_SKU[<garbage>]`.

### The regular price is editable there now

Three of the four AI prices previously had **no editor at all**: bands B, C and D
are `is_active = false` price *sources*, so on the main catalog screen they sit
in the retired shelf — the last place anybody looks for a live price. Only a
migration could move them.

🔑 **There is no sign-up field, deliberately.** Setnayan AI carries ONE discount
for the whole family (owner 2026-08-28); a per-band sign-up box would rebuild the
four drifted per-band discounts that ruling removed. The sign-up price is
computed from the family discount by the same function the family-wide save uses,
so one band edited here and the whole family edited there cannot disagree.
Tier E is refused rather than allowed to store a ₱0 that would read as a free
version somebody could switch on.

### Verification

`tsc` exit 0 · `test:unit` **11,395 pass / 0 fail** · the generated admin-job
checklist regenerated (**one** job added, its refused-when-empty field correctly
detected; nothing else moved) · the SEC-7 mock **extended, not loosened** — it
gained the ability to fail the band read, so the new read carries the same
coverage as the old one.

**3 mutations, each landed by measured occurrence count, all red** — including
reinstating the original defect (resolve the band from the map again), which two
tests catch.

SPEC IMPACT: The AI band assignment becomes load-bearing rather than decorative.
Add a `DECISION_LOG.md` row for 2026-08-29.
