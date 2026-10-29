## 2026-10-29 · fix(suppliers): a refused payment plan is seen, and an empty amount no longer looks like "50"

Measured on a real ₱395,000 stylist record: the couple entered ₱10,000 +
₱197,000 and left the Balance amount empty. Its placeholder read "50" next to
a "%" picker, so it looked filled. The server refused the plan, but the
reason was drawn in the scroll below the plan, out of sight, so the couple
could not tell whether Save had worked.

- The save refusal now shows in the pinned footer, right above Save.
- The amount placeholder reads "Amount" and the name placeholder reads
  "Name it, e.g. Balance", so neither looks like a typed value.
- The plan's total line now names the gap: "₱207,000 of ₱395,000 · ₱188,000 left"
  (or "· ₱9,500 over").

Guarded by `apps/web/app/dashboard/[eventId]/_components/a-refused-plan-is-seen.test.ts`.

SPEC IMPACT: None.
