## 2026-07-31 · fix(inquiry): the event_vendors write could fail silently — now it reports

The Song Desk build order left one open code item: `vendor_services.category` is read as a
**canonical tile key** in `inquiry-actions.ts` but written into `event_vendors.category`, which is
the strict Postgres **enum** `vendor_category`. One column, two vocabularies that do not overlap.

**What the contract described, and what is actually worse.** The note said the violation would be
swallowed by a `catch {}`. Verified against the code: **it would not even reach the catch.**
`supabase.from(…).insert()` and `.update()` do **not throw** on a database error — they *return*
`{ error }`, and neither return value was being read. `throwOnError` appears **zero** times in this
file. So the failure mode was not a swallowing catch; it was an **unchecked error return**, which
is quieter still.

Confirmed against prod:

| | |
|---|---|
| `event_vendors.category` | enum `vendor_category` — 51 values (`band_dj`, `host_emcee`, `planner_coordinator`…) |
| `vendor_services.category` | plain **TEXT** — carries tile keys elsewhere (`live_band`, `host_mc`, `coordinator`) |
| `vendor_services` rows in prod | **0** — so this is latent, not currently firing |

`live_band` ∉ `vendor_category`, so a real row in the tile vocabulary fails with
`invalid input value for enum vendor_category` — the exact shape of the 2026-05-22
`guest_role: "bride"` incident. The couple's `event_vendors` row would simply never appear, with
no error anywhere.

### What this changes

Both writes now check their returned `error`, and the outer `catch` reports genuine throws. Every
fault goes to Sentry under `feature: 'inquiry-event-vendor-write'` with the **attempted `category`
value** as a tag.

**Still non-fatal by design.** The thread, the message and the service interests have already been
written by this point; failing a couple's inquiry over a bookkeeping row would be the worse
outcome, and the row is reconstructable from `thread_service_interests`.

**No PII** — internal IDs and a taxonomy key only, never the vendor's name or anything the couple
typed (0035 · no PII in logs).

### What this deliberately does NOT do

**It does not translate between the two vocabularies.** `vendor_services` has 0 rows in production,
so any mapping would be a guess about data that does not exist yet — and the build order defers it
explicitly (*"needs one real vendor service row to settle"*, and *never another hand-kept enum
list*). The existing `VENDOR_CATEGORY_CANONICAL` map runs legacy→tile; inverting it is ambiguous in
six places (`photographer` and `videographer` both → `photo_video`; `hair_stylist` and
`makeup_artist` both → `hmua`; `venue` and `accommodation` both → `reception`), so a reverse map
would have to invent a winner.

Instead, the fix **produces the evidence the deferred decision needs**: the first real occurrence
reports which vocabulary actually landed, and the call stops being a guess.

SPEC IMPACT: None — no schema, no policy, no behaviour change on the success path. The open
`vendor_services.category` vocabulary question stays open by design and is still recorded in
`Song_Desk_BUILD_ORDER_2026-07-27.md`.
