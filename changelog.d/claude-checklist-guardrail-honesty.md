## 2026-07-21 · test(checklist): derive the event-type roster and label the assertion that actually guards it

Fix-forward on PR #3464. The behaviour fix there (5 missing `CHECKLIST_EVENT_LABELS`
entries) was correct; its guardrail test mislabelled itself.

- `apps/web/lib/checklist-event-labels.test.ts` — the `EVENT_TYPE_CHECKLIST_DEFS`
  loop was commented as *"the load-bearing half"* that *"cannot go stale."* It
  passes against pre-fix code and can never catch this bug class: the at-risk
  types are exactly those with no dedicated def, which route through
  `GENERIC_EVENT_CHECKLIST_DEF` and never appear in that registry. The real
  guardrail was the hand-listed roster the comment called expendable.
- The roster is now **derived** from `ANCHOR_BY_TYPE` (`lib/event-anchor.ts`),
  whose keys are exactly the 14 active `event_type_vocab` rows — verified, not
  taken on trust. The comment claiming "there is no TS constant to import" was
  false and is gone.
- The decorative defs-loop assertion is deleted; its only non-decorative content
  (a def key must also be in the roster) survives as its own small test,
  explicitly labelled a consistency check rather than the guardrail.
- No `ANCHOR_BY_TYPE` ≡ `SPECIALTY_CATALOG` cross-check: both maps are already
  deep-equal-pinned to hand-listed 14s in their own suites
  (`lib/event-anchor.test.ts`, `lib/onboarding/specialty-catalog.test.ts`), so a
  cross-check here would detect nothing new while coupling the checklist suite to
  onboarding. The header says so instead of implying this file keeps the roster
  honest.
- Every one of the four tests was mutation-tested and the file now states, per
  test — in file/TAP order — what it can and cannot catch. No production code
  changed.

SPEC IMPACT: None — test-only change; no SKU, price, schema or product-behaviour
delta.
