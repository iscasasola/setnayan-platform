## 2026-08-10 · fix(admin): a third screen ranked the same queues its own way — and inverted

`app/admin/app-performance/_components/action-center.tsx` kept a private
`STATE_RANK` over the SAME fifteen queues, the same `getAdminQueueDigest` and
the same `computeDueState` as `/admin/work` and `/admin` — but with `unknown`
ranked **above** `ok`, the exact inverse of the shared `QUEUE_DUE_RANK`, whose
docblock says a degraded read "must not be presented as either urgent or
settled". A queue whose count merely failed to load outranked one that was
genuinely fine, and an admin reading this cockpit and `/admin/work` was told two
different things were the most urgent thing to do. It now calls
`compareQueuePriority`; tie-break semantics are unchanged (bigger count first).

**Why the guard missed it, and what actually changed.** `lib/admin/queue-priority.test.ts`
listed its surfaces in a HAND-TYPED two-entry array, so this third surface was
never checked and two earlier attempts at the fix left it standing. The list is
now DERIVED FROM DISK: any file under `app/admin` whose code reads the queue
vocabulary and sorts is a ranking surface and must answer for itself. It
resolves to three today — including the one that was hiding — and a fourth
cannot escape it. Mutation-tested: restoring the private rank table turns the
guard red, reverting turns it green.

SPEC IMPACT: None — the shared order was already the decision; one surface
disagreed with it in code.
