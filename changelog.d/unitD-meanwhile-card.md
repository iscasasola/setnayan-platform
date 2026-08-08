## 2026-08-08 · design(#4): "Meanwhile" — a vendor delivered something you haven't seen

Unit D of the Warm Editorial Archive port — **the only genuinely new widget in the
whole event-Overview delta.** Purely additive: 107 insertions, **zero lines removed**.

Nothing on this page told a couple when a vendor delivered their photos. Now a quiet
card appears — *"Studio Hiraya delivered your gallery. Look →"* — and only when there
is something to say.

🚨 **THE DESIGN NAMED THE WRONG DATA SOURCE.** The frame points at `alaala/`, whose own
docblock says it holds *"no per-event data yet"* — it is catalog-driven. Built from
`booking_handovers` instead (`status='delivered'` AND `couple_acknowledged_at IS NULL`),
which is the row that actually means "a vendor delivered something you have not opened".
Every column was verified against the prod schema before use.

🪤 **AND THE PHANTOM-COLUMN GUARD CAUGHT ME MID-BUILD.** The first version selected an
`id` column. The table's primary key is **`handover_id`**. That is the exact failure this
codebase has been bitten by four times — a phantom column makes Supabase reject the
**whole query** and return null, so the card would simply never render and **nothing
would error**. `T1 · no .from().select() names a column the migrations never declared`
went red before it could ship. The guard earned its keep.

**No new machinery:**
- The read joins the **existing** `Promise.all` — one lean select, no extra round-trip.
- Vendor names come from the `eventVendors` array already loaded.
- **No dismiss state and no new action:** "Confirm receipt" in the vendor workspace is
  the shipped, idempotent dismissal, so acknowledging there clears this here. One
  mechanism, one place.

**Deliberate honesty choices:**
- **User client, not admin.** RLS is couple-on-event, so a coordinator viewing the page
  is denied → empty → card hides. For *this* card that fail-direction is right; it would
  be exactly wrong for a counter, which is why the zero≠failed rule is not applied here.
- **The thumbnail is a hatched placeholder.** A handover payload is a link or a file, not
  a resolvable preview — nothing is presigned and no image is faked.
- **The copy claims only what the row knows.** The frame's sample said *"84 photos from
  Studio Hiraya"*; neither the count nor the media kind is derivable, so neither is
  claimed.
- `event_vendor_id` carries **no foreign key** (the decoupled pattern), so a missing name
  falls back to "Your vendor" rather than rendering `undefined`.

Typecheck clean · all 12 `lint-*.mjs` clean · **7092/7092** tests green.

SPEC IMPACT: None.
