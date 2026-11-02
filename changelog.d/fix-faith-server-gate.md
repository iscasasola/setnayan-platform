# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · fix(dashboard): ceremony/faith edit no longer rejects the 8 worldwide-expansion faiths server-side

The couple dashboard's ceremony/faith edit modal offers all 18 faiths, but `setEventCeremonyType` (`app/dashboard/[eventId]/actions.ts`) validated the primary pick against a hardcoded 10-value list — so the 8 worldwide-expansion faiths (aglipayan · LDS · SDA · JW · hindu · sikh · buddhist · orthodox, shipped in PR #1275) were silently rejected with "Invalid ceremony type" even though the modal offered them and the `events_ceremony_type_check` DB CHECK (widened by migration `20261120000000`, faith worldwide expansion) accepts them.

- **`lib/faith-registry.ts`** — added pure, case-sensitive validators `isAllowedCeremonyValue` / `isAllowedSecondaryCeremonyValue` (+ a `CeremonyValue` type and an `ALLOWED_SECONDARY_CEREMONY_VALUES` constant), all derived from the existing `ALLOWED_CEREMONY_VALUES` (every registry faith + `civil` + `mixed` = the 18-value lowercase keyspace that mirrors the DB CHECK). This is the same canonical source the onboarding commit already validates against — no new literal list minted.
- **`app/dashboard/[eventId]/actions.ts`** — deleted the stale hardcoded `ALLOWED_CEREMONY_TYPES` (10 values) + its `AllowedCeremonyType` type; the primary and secondary ceremony now validate via the registry helpers. Mirrors the onboarding server-side belt exactly: the picker only EMITS launch-active keys, the server accepts anything the owner COULD flip live; launch-gating of `coming_soon` faiths stays a UI concern, not enforced here.
- **`app/dashboard/[eventId]/_components/ceremony-type-modal.tsx`** — the edit modal's `normaliseInitial` pre-select used its own stale 7-key list, so re-opening the modal for an event already saved as `chinese`/`jewish`/`born_again` or any worldwide faith failed to pre-select the current value. It now narrows against the same 18 keys the radio group renders (`isCeremonyTypeKey`, newly exported from `app/_components/ceremony-type-radio-group.tsx`).
- **`lib/ceremony-validation.test.ts`** (new · node:test) — pins the helpers to the DB CHECK keyspace: all 18 accepted, the 8 worldwide faiths specifically accepted, exact lockstep with the CHECK list (fails on drift), Title-Case `faith_vocab` keys rejected (case-sensitive landmine — that is a DIFFERENT keyspace), garbage/non-string rejected, and secondary accepts every faith + civil but never `mixed`.

⚠ Landmine respected: the fix lives entirely in the LOWERCASE `ceremony_type` keyspace; no Title-Case `faith_vocab` key was lowercased or re-cased.

No migration — the DB CHECK already accepts all 18 (migration `20261120000000`); this only realigns the server validation to it.

SPEC IMPACT: None — corrective bugfix restoring already-shipped behavior (PR #1275 faith expansion); no new product surface, pricing, or schema.
