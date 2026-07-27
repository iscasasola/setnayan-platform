## 2026-07-27 · fix(guards): one ceremony-type guard + the 3-clause admin gate on the editorial queue

Two live divergences, one root cause: **a rule written down in several places, which drifted.**

**1 · The ceremony-type guard — the WRITE path accepted faiths the READ paths rejected.**
`CeremonyType` is a 16-member union in `apps/web/lib/auspicious-date.ts`, but four
hand-rolled runtime guards narrowed it differently, and TypeScript could not catch it
because every list was a legal SUBSET of the union:

| site | role | members |
|---|---|---|
| `app/dashboard/[eventId]/date-selection/actions.ts` | WRITE | 16 |
| `app/dashboard/[eventId]/date-selection/page.tsx` | READ | 8 |
| `app/dashboard/[eventId]/wizard-actions.ts` | READ | 8 (with a comment claiming it matched both the union AND the write path — both halves false) |
| `lib/wedding-plan-groups.ts` | dead export, **zero importers** | 8 |

Reachable harm: a host picked Hindu (or Aglipayan / LDS / SDA / JW / Sikh / Buddhist) in
the guided flow, `setCeremonyTypeFromFlow` accepted it and persisted `events.ceremony_type`
+ `ceremony_type_locked_at`; on the next render the 8-member guard returned false,
`ceremonyType` collapsed to `null`, the radio group showed **nothing selected** even though
it was locked, and `suggestMeaningfulDates` routed the host into the
`ceremonyType === 'catholic' || ceremonyType === null` **Catholic seed-date branch**.
(Their date *reasons* were unaffected — `ceremonyOverlay` has no branch for those faiths, so
they already read the same as `null`. The harm is the lost selection + the Catholic routing.)

Fix: **one exported guard beside the union it guards.** `lib/auspicious-date.ts` now exports
`CEREMONY_TYPES` (the runtime value array) and `isCeremonyType`. The array is pinned to the
union in BOTH directions — `as const satisfies readonly CeremonyType[]` rejects a value that
is not a union member, and an exhaustiveness assertion rejects a union member missing from
the array (naming it in the error). Adding to one without the other now fails `tsc --noEmit`.
All three local copies deleted and replaced with the import; the dead 8-member export (and
its dead 8-member union) removed from `lib/wedding-plan-groups.ts`; the stale comment in
`wizard-actions.ts` corrected rather than moved.

**2 · The editorial-review admin gate dropped two of its three clauses.**
`apps/web/lib/admin/require-admin.ts` is canonical: it selects
`is_internal, is_team_member, account_type` and admits
`is_internal || is_team_member || account_type === 'admin'`.
`app/admin/editorial-review/[editorialId]/actions.ts` declared its OWN `requireAdmin` that
selected **`is_internal` only** — the single outlier among ~43 local copies — and ran that
authorization lookup through `createAdminClient()`, the RLS-bypassing service-role client.
Harm: a Setnayan team member (`is_team_member = true`, `is_internal = false`) could approve
payouts and verify vendors but got a hard "Unauthorized" on the editorial moderation queue —
unreachable for exactly the staff hired to work it.

Fix: the local copy now delegates to the canonical `requireAdminAction()` (the actions-side
gate — `requireAdmin()` calls `notFound()`, which is wrong inside a server action).
Authorization is resolved through the **user's own RLS-scoped client**; the service-role
client is still obtained and still does all the RLS-bypassing work
(`event_editorial` reads/writes, the `event_members` notification fan-out) — it just no
longer decides who the caller is. The 3-clause predicate was split into a pure,
dependency-free `lib/admin/admin-predicate.ts` (`isAdminProfile`, re-exported from
`require-admin.ts`) so the rule is unit-testable without `server-only`.

**Tests:** `lib/ceremony-type-guard.test.ts` + `lib/admin/editorial-review-admin-gate.test.ts`
(17 tests). Both carry neutralisation coverage: restoring an 8-member local guard fails
`every live ceremony_type guard is THE canonical import, not a local copy`; restoring the
`is_internal`-only check fails `the editorial review actions delegate to the canonical gate`.

**1b · The union widened 16 → 18 (`jewish`, `born_again`) — a correction, not a new faith.**
Four shipped sources already said 18: the `events_ceremony_type_check` DB CHECK, the
ceremony-type picker, `lib/faith-registry.ts`'s `ALLOWED_CEREMONY_VALUES`, and an
owner-activated `wedding_type_launch_status` row. Only `CeremonyType` said 16.

`born_again` has been `status='active'` since 2026-06-04 (migration `20260808000000`) — a
live, pickable chip. `setEventCeremonyType` accepts it and the DB stores it, so a Born Again
couple hit the exact defect above: read back as `null` → Catholic seed-date branch.
(`jewish` is the same shape but `coming_soon`, migration `20261123000000` — latent.) The
eight faiths the census led with (hindu/sikh/buddhist/lds/sda/jw/orthodox/aglipayan) are all
`coming_soon`, so `born_again` was the only LIVE victim.

**Verified inert before shipping**, not assumed. There is no `Record<CeremonyType, …>` and no
`switch` on this union anywhere; every consumer is an `if` chain that falls through to
`null`. Proved it behaviourally: hashed `computeAuspiciousReasons` +
`computeAuspiciousReasonsDetailed` + `suggestMeaningfulDates` over 730 dates × both
`chineseTradition` flags × 3 seed years, for all 16 pre-existing values **and** `null`,
before and after the widening — **all 17 hashes byte-identical**. `born_again` and `jewish`
hash identically to `hindu` (an existing member with no branch anywhere) and differently from
`catholic` and `null`, i.e. they add no behaviour and now escape the Catholic branch.
Nothing changes for any existing couple. That differential is pinned as a permanent test.

**Parity pin (closes the gap for good):** `tests/db/ceremony-type-check-parity.db.test.ts`
asserts `CEREMONY_TYPES` equals the `events_ceremony_type_check` allowed set exactly, read
via `pg_get_constraintdef` from a **full replay of every migration in order** (PGlite) — not
from a single migration file, since five separate migrations have widened this CHECK. It also
round-trips every value through a real `INSERT`, and pins `events_secondary_ceremony_check`
to "primary minus `mixed`". `lib/ceremony-validation.test.ts` already pinned
`faith-registry` to the same CHECK; the two now leave no gap between them.

**Noticed, NOT touched (reported for a later pass):**
- `app/dashboard/[eventId]/vendors/actions.ts` `CEREMONY_TYPE_VALUES` — a **7**-member list
  (no `chinese`, none of the 11 expansions) feeding `asCeremonyType`. A live subset.
- `app/dashboard/[eventId]/date-selection/_components/four-question-flow.tsx`
  `CEREMONY_OPTIONS` — 16 options, typed `CeremonyType | 'undecided'` so it is compile-time
  pinned to the union, but a non-exhaustive array literal: widening the union does NOT add
  chips. The guided flow still offers 16 and folds born-again under `christian`
  ("Born-again, evangelical, others"). Whether `born_again` should also be a guided-flow
  chip is a product call — untouched.
- `lib/paperwork.ts:66` and `lib/schedule.ts:206` — see the report.

SPEC IMPACT: None — no pricing, SKU, schema, or migration change, and no faith added to or
removed from any user-facing surface. `CeremonyType` widened 16 → 18 to match the DB CHECK,
the picker, `faith-registry`, and an owner-activated launch row that all already said 18;
proven behaviourally inert for every pre-existing value.
