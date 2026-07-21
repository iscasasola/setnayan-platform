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
- A new `roster sources agree` test cross-checks `ANCHOR_BY_TYPE` against the
  independently-maintained `SPECIALTY_CATALOG` (equal key sets) and requires the
  checklist defs registry to be a subset, so a type half-added to the codebase
  fails loudly instead of quietly shrinking the derived roster.
- The decorative defs-loop assertion is deleted; its only non-decorative content
  (a def key must be inside the roster) survives inside the new test.
- Every one of the four tests was mutation-tested and the file now states, per
  test, what it can and cannot catch. No production code changed.

SPEC IMPACT: None — test-only change; no SKU, price, schema or product-behaviour
delta.
