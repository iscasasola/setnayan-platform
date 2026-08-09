## 2026-08-09 · fix(admin): a THIRD screen ranked the same queues its own way — and the guard's list was hand-typed

PR #4270 unified how two admin screens order the job queues and reported "no third
offender". That was wrong. The App Performance cockpit's Action Center kept a third
private rank table, and it put a **failed count above real open work** — the exact
inverse of the shared rule, whose whole point is that a degraded read is neither
urgent nor settled. Same fifteen queues, same digest, same SLA maths, three answers
to "what should I do first".

- `app/admin/app-performance/_components/action-center.tsx` — private `STATE_RANK`
  deleted; sorts with the shared `compareQueuePriority`. Behaviour change on that
  screen only: a queue whose count could not be read now sits **below** queues with
  open work inside SLA, instead of above them. Nothing else moves — overdue still
  first, busiest still breaks ties inside a band, a full tie still falls back to the
  card declaration order.
- `lib/admin/queue-priority.test.ts` — the surface list is no longer hand-typed. A
  new check walks `app/`, finds every file that reads the shared queue module,
  derives a due state and sorts, and fails **by name** if one is not in `SURFACES`.
  That is what missed the cockpit. Also: "calls the shared comparator" now requires
  a real CALL — `includes('compareQueuePriority')` was satisfied by the import line
  alone, so a surface could re-hardcode its table, keep the dead import, and stay
  green.
- `lib/admin/queue-counts.ts` — comment only. The comparator's docblock still said
  "two surfaces"; it now records all three and points at the derived list.

Mutation-tested from a green 9/9 baseline, each sabotage verified applied before
the run: re-hardcode the cockpit's table (2 red) · drop the cockpit from `SURFACES`
(red, named) · drop a brand-new unlisted ranking file into `app/` (red, named) ·
swap `ok`/`unknown` in the shared table (3 red) · name the comparator only in a
comment (red — the reviewer's shape from last round).

SPEC IMPACT: None. No product, pricing or schema decision — one internal admin
screen now orders its cards the same way the other two already do.
