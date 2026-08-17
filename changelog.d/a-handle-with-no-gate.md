## 2026-08-17 · fix(guards): the mirror class — a handle with no gate — and a real blind spot in the detector I shipped this morning

`gates-have-handles` asks "can anything TURN THIS ON?". That is half the shape.
The other half shipped live and was found **by accident** on 2026-08-17, chasing
an unrelated question:

> `users.planner_mode` is written by a real, rendered control — the profile page's
> Guided / DIY choice, whose copy promises *"Guided shows the 9-step checklist on
> your Overview tab. DIY hides it so you can plan on your own."* The column has
> FIVE references in the whole repo, all five that page and its own action. The
> Overview never reads it. **A couple who picks DIY to hide the checklist still
> sees it.**

🔑 **To the person using the product both shapes are one bug: the setting does
nothing.** The existing guard passed `planner_mode` correctly and uselessly — the
column IS written. Nobody had asked the other half.

Adds `tests/db/handles-have-gates.db.test.ts` + a 16-line reasoned baseline.
It asks whether any file OUTSIDE the writing surface names the column — not "is
it selected anywhere", because `planner_mode` IS selected, by the page that writes
it, to render which option is ticked.

⚠ **A hit is a candidate, not a verdict**, and the guard says so: read-only-by-its-
own-surface is correct when the effect IS on that surface. It is a defect only
when the copy promises an effect elsewhere — a question no scanner can settle, so
the baseline carries the judgement.

## And it immediately found a defect in the detector I shipped this morning

The new guard flagged `events.geolocation_enabled` as "written by
`app/api/v1/events/[eventId]/route.ts`". Its only reference there is a column name
inside a multi-line `.select()`. **A select-list entry and an ES6 shorthand
property are the same characters** — `, column,` — so any column merely NAMED in a
select read as WRITTEN. That is the dangerous direction: it makes
`gates-have-handles` blind to genuine findings.

Fixed (`blankStringContents`), which **unmasked four columns the guard had been
silently passing**, now recorded separately rather than lumped together:

- 🔴 `events.geolocation_enabled` — a per-event geo switch with no writer and, in
  effect, no reader; V1 ships no public API, so even that select is unreachable.
  A privacy control that does not exist. Owner/DPO territory.
- 🔴 `vendor_profiles.show_team_bookings_in_backend_count` — a vendor preference
  no form, action or admin path writes.
- `events.is_sample` — legitimately writer-less: the curated sample event is
  seeded by migration and has 32 readers.
- `vendor_bot_config.auto_accept_enabled` — **not a finding, a detector
  limitation**: written via `.upsert({ …, ...parsed.patch })`, a spread, so the
  key never appears. ⚠ Deliberately NOT "fixed" by treating a spread as writing
  every column of the table — that would blind the guard to that whole table.

Mutation-proved three ways with occurrence counts: delete the `planner_mode`
baseline line (1→0) → red; neuter the outside-the-writer filter (1→0) → two tests
red; remove the string-blanking (1→0) → the ORIGINAL guard goes stale on its four
new lines, proving the fix is load-bearing.

Typecheck clean (from the installed binary). Unit guard 8/8, both db guards 4/4.

SPEC IMPACT: Recorded in DECISION_LOG.md 2026-08-17.
