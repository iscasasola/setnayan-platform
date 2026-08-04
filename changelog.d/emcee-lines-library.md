## 2026-08-01 · feat(emcee): My Lines — his script travels between weddings

Builds the owner-locked design: `Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`
(prototype: `Emcee_Script_Prototype_2026-08-01.html`).

**What was wrong with what shipped on Thursday.** PR #3977 gave a host a place to write his lines
for one wedding. On its own that is a **form**: an emcee does ~40 weddings a year saying nearly the
same things with the names swapped, and it made him retype all of it every time. The owner rejected
exactly that — *"the emcee should have the easiest and most efficient way to create their script."*

**What this adds — the half that travels.** The third instance of the split the owner locked on
2026-07-27 (*"his questionaire can be saved as his template. to use for succeeding customers"*),
already shipped twice as `vendor_songs ↔ event_song_picks` and
`vendor_activities ↔ event_activity_picks`:

| his craft — travels | the event's copy — dies with it |
|---|---|
| **`vendor_lines`** (new) | `vendor_block_scripts` (#3977, **unchanged**) |

**The structural guarantee: `vendor_lines` has NO `event_id`, by design.** A row cannot belong to a
wedding, so it cannot leak from one couple to the next — enforced by the schema, not by anyone's
diligence. Bodies are **templates carrying slot tokens, never real names**, so a stored line never
holds a real person either.

### The keying ladder — `lib/emcee-lines.ts`, 20 tests

`BLOCK_CUE` has 9 coarse block types; real moments are specific ("Money Dance"). Keying on type
alone would put one line on every `program` block — the wrong words in a host's mouth, while
looking helpful. So a three-rung ladder, surfaced honestly in the UI:

1. **exact** — his own named segment via the shipped `event_activity_picks.scheduled_block_id`
   bridge. The only rung marked `trusted`.
2. **by name** — normalized label. Fills, but the card says *"matched by name — glance it."*
3. **day-part** — block type, **and only for a type that occurs ONCE on this timeline**.
4. **no match → no fill.** "Nothing fits yet" is a correct answer.

🔴 **A repeated block type never auto-fills**, computed from the timeline in hand rather than
assumed from a constant — whether a type is a framing moment is a property of *this* wedding.

### The two rules that protect a person

- **A private moment never pre-fills, on any rung**, and a line authored on one is never reusable —
  "watch for Grace by the sound booth" is *last* wedding's coordinator. Checked before any key
  matching, so nothing can route around it. `publicFacing` fails toward silence.
- **Save is automatic** (spec 3.1 — an explicit button is curation homework skipped 40×/year), so
  the anonymization is mechanical: `toTemplate` swaps this couple's details back out, longest value
  first, before anything reaches the library.

### The page

New **Script** tab inside the shipped Customer Card at `/vendor-dashboard/clients/[eventId]` — not
a new route. Gated on the same `stage_script` entitlement as the day-of desk, narrowed by
`tilesForVendorCategories`, so exactly one trade sees it; a florist never does.

**Triage replaced the completion counter.** "Get these right — N" surfaces only what must not be got
wrong, including the case a written/blank binary misses entirely: **an ask sitting on top of a
library-filled line** (the stock send-off cannot know they want a circle of phone lights). Blanks he
would ad-lib stay silent.

Typography is a safety control: the read-aloud serif is **withheld** on a private moment so a glance
can never mistake staging notes for copy.

### Deliberately not here

`onConflict` is **not** used for the library write — `vendor_lines`' uniques are *partial* indexes
and PostgREST cannot infer one; read-then-write is explicit and correct. The library write is
best-effort but **reported to Sentry**, never silently discarded (the 2026-07-31 unchecked-error
lesson). The My Lines browse surface and the day-of delta are their own PRs.

### Verification

- `tsc --noEmit` **exit 0, 0 errors** (8 GB heap — the default OOMs on this repo).
- `next lint` clean on all six touched files.
- **`test:unit` 5,962 / 5,962** (20 new).
- Migration replayed **1010/1010** in the PGlite harness; **exposure baseline regenerated in this
  PR** — `anon=-` on every column of the new table.
- **Rehearsed against real prod schema in rolled-back transactions**: no `event_id` column · `anon`
  holds nothing · RLS on · a keyless row genuinely raises `23514` · a duplicate `(vendor, label)`
  genuinely raises `23505`. Both rolled back; prod untouched.

SPEC IMPACT: None — implements the locked spec as written. No pricing, no policy change to any
existing object.

---

## 2026-08-01 (same PR) · My Lines — the library screen, and the last spec item

Item **5**, the final one. `/vendor-dashboard/lines` — sibling of
`/vendor-dashboard/activities` (his named segments) and deliberately the same kind of screen: a
vendor-owned reusable list, plain form posts, no client state machine.

**Three rules the screen is built around, each of which could have gone wrong quietly:**

1. **It shows the TEMPLATE, slots and all** — `⟨the couple⟩`, never a filled preview. The promise is
   that a stored line carries no real person, and he should be able to *see* that. It is also how he
   learns to write a slot.
2. **Private notes are separated and labelled "never reused."** They are here so he can find them,
   not so they get used — `matchLines` already refuses them at the source, and this screen must not
   imply otherwise.
3. **Editing here never touches a wedding.** The library is upstream of every event copy, never
   retroactive. Silently rewriting a script he has already rehearsed would be the worst thing this
   screen could do — so `vendor_block_scripts` is not touched by any action on this page.

**Delete is soft, and that is load-bearing.** `deleted_at` rather than a real delete: every partial
unique carries `WHERE deleted_at IS NULL`, so retiring a line frees its key immediately and he can
write a fresh one for the same moment straight away. A hard delete would also be indistinguishable
from "never written".

**Rung 2 → rung 1 promotion.** He can attach a line to one of his named segments, turning a
matched-by-name guess into an exact match that holds forever — the same UUID travels to every
wedding. Attaching validates the segment is **his** first, so a stray id cannot bind his line to
someone else's segment.

Reachable from the Script tab in both states — the "drafted from your lines" banner when the
library is working, and a quiet line explaining the automatic save when it is still empty.

**All six items of the locked spec are now built.**

---

## 2026-08-04 · unblocked — the migration would have created nothing

Two things kept this PR red/dirty while it sat open since 2026-08-01.

**1 · The migration prefix had fallen below the applied head.** It shipped as
`20271029051678`; prod's head is `20271102113000` with **16 migrations already applied above
it**, and this one was not among them. Migrations apply once, in prefix order — so it would
have merged with green CI and created **nothing**: no `vendor_lines` table, and every screen
in this PR reading a relation that does not exist. Re-allocated to `20271102810371` via the
allocator; the SQL is unchanged.

**2 · The exposure baseline conflicted with main.** Resolved the documented way — take main's
version, then **regenerate** — never hand-merge a generated file. The resulting diff is exactly
this PR's own surface and nothing else: `public.vendor_lines` with `anon=-` on every column
(`REVOKE ALL … FROM anon, authenticated` then re-GRANT to `authenticated` only) and one policy
scoped by the canonical `current_vendor_ids()` helper. Anon reaches nothing.

⏭ **After merge, verify the OBJECT, not `schema_migrations`:** `SELECT
to_regclass('public.vendor_lines');` must be non-NULL.

SPEC IMPACT: None — no pricing, SKU or scope change.
