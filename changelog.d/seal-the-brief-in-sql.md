## 2026-09-20 · feat(db): the booking-fee field rule moves into SQL — the brief is sealed at the RPC

**Follow-up to #5738, which named this hole in its own report.** `public.get_vendor_event_brief`
is SECURITY DEFINER and, since #5730, returns the venue name, the venue address, meal counts, the
day-of timeline and seat-plan status at EVERY stage. #5738 narrowed those fields on the PAGE
(`redactBriefForStage`), so a supplier could call
`/rest/v1/rpc/get_vendor_event_brief` straight from their own browser session — with the anon key
that ships in the page — and read exactly what the screen had just hidden. Four siblings whose only
callers are pages #5738 gated WHOLE had the same hole: `get_vendor_mood_board`,
`get_vendor_seat_plan`, `get_vendor_cocktail_editor`, `get_vendor_catering_metrics`.

**New migration `supabase/migrations/20271236283573_seal_the_brief_in_sql.sql`:**

- `platform_settings.fee_unlocks_event_enforced BOOLEAN` — **the switch the app and the database
  both read**, on the `setnayan_ai_paywall_enabled` precedent (non-secret config on the singleton,
  flipped from the admin console with no redeploy). **NULL by default, so nothing changes anywhere
  until the owner flips it.**
- `public.vendor_event_fee_gate_stage(UUID, BOOLEAN)` — `resolveEventAccessStage` in SQL, once.
  Returns `unlocked` | `booked_fee_due` | `quoting`. Resolves the caller's shop exactly as
  `fetchOwnVendorProfile` does, picks the deciding `booking_fee_charges` row (unsettled beats
  settled), and treats `paid` / `waived_free5` / `waived_import` as settled. **Fails open on every
  error and on no resolvable shop.** No role holds EXECUTE — every caller is a SECURITY DEFINER
  function running as the definer.
- `get_vendor_event_brief` — narrows the same five fields `redactBriefForStage` narrows
  (venue name + address · dietary · timeline · seat-plan detail · monogram), shape-preservingly, and
  adds a `withheld` array naming them. The key is **absent** when nothing was narrowed.
- The four siblings — refuse with `fee_unsettled` (42501) when the fee is unsettled, mirroring the
  whole-page gate #5738 put in front of each. Bodies reproduced VERBATIM from the migrations that
  last defined them (filename order and git-add order were checked to agree first); the only edit is
  one guard after `BEGIN`. **No GRANT statements** — `CREATE OR REPLACE` preserves the ACL, so
  `get_vendor_mood_board` and `get_vendor_cocktail_editor` keep the reviewed anon EXECUTE that
  `anon-rpc-surface.baseline.txt` records.

**THE FLAG, AND HOW THE TWO HALVES STAY IN STEP.** SQL cannot read
`NEXT_PUBLIC_FEE_UNLOCKS_EVENT`. `feeEnforcementFromSources` (pure, executed) makes the app
`env OR column` while the database is `column` alone, so the invariant is
**DATABASE ENFORCING ⇒ APP ENFORCING, never the reverse.** The only asymmetry possible is the safe
one — the env flag alone narrows the screen while the RPC still answers in full, which is exactly
the state #5738 shipped. The forbidden state (the database withholding a field the page believes it
is drawing, which renders as a wedding with nothing planned) cannot be produced by any pair of
inputs. Belt and braces: `reconcileStageWithPayload` treats the payload's own `withheld` list as
decisive, so a narrowing announces itself to the screen whatever the flag read returned, and
`redactBriefForStage` UNIONS that list into what it renders — without it the page would recompute
from already-null fields, find nothing, and stop naming what was taken.

- `apps/web/lib/event-access-stage.ts` — `feeEnforcementFromSources`, `withheldFromPayload`,
  `reconcileStageWithPayload`; `redactBriefForStage` unions the payload's list.
- `apps/web/lib/vendor-event-fee-access.server.ts` — `resolveFeeEnforcement` (cached) reads the
  column and ORs it with the env flag; both `resolveEventFeeGate` and `resolveEventFeeGates` pass it.
- `apps/web/app/vendor-dashboard/clients/[eventId]/page.tsx` — reconciles the stage with the payload.

**Guards:** `apps/web/tests/db/the-brief-is-sealed-in-sql.db.test.ts` — ONE table of cases drives
BOTH rules (each case asked of `resolveEventAccessStage` AND of the SQL gate against a real charge
row, and the two must agree); the field set compared to `redactBriefForStage` applied to the payload
the same function returns with the switch off; each of the four siblings refused per unsettled status
and SERVING a real payload once settled (the positive control); the fail-open case, by renaming
`booking_fee_charges` out from under the gate; and the switch-off case proving every function is
byte-identical to before. Plus the invariant truth table in
`apps/web/lib/event-access-stage.test.ts`. **Eight sabotages run, all red:** free-5 made to lock ·
the dietary narrowing deleted · the fail-open arm deleted · the mood-board guard deleted (1 of 4
occurrences, and only the mood-board case went red) · the `withheld` announcement deleted · the
switch defaulted to ON · `redactBriefForStage` made to ignore the payload's list · the DB switch
made not to reach the app.

**Exposure baseline regenerated** (`supabase/security/exposure-surface.baseline.txt`): exactly one
line added — `col public.platform_settings.fee_unlocks_event_enforced anon=- authenticated=S`. Anon
holds nothing on that table (20271014400000) and the column is a non-secret feature flag on the same
shelf as `setnayan_ai_paywall_enabled`. Fact count 6419 → 6420.

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-20 row recording that the booking-fee field rule is
enforced in the database and is switched by `platform_settings.fee_unlocks_event_enforced`, not by
the Vercel env var.
