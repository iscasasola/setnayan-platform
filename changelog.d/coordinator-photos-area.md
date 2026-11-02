## 2026-08-06 · feat(coordinator): a coordinator may see the couple's guest photos — on approval

Owner: **"they can. but only upon approval."**

🔑 **NO NEW MECHANISM.** This adds ONE area — `photos` — to the delegate-permission
system the owner already switched on in July. Enforcement lands in exactly one
place, the same call every other area goes through. A photo-specific permission
would have been a second answer to "may they see this", and two answers
eventually disagree.

**Off by default**, written as an explicit `null` beside `budget` so the intent
is visible rather than inferred from absence. Approval means the couple raising
it on that coordinator's row; it can be granted at view or edit and taken back.

## 🚨 The dangerous half was the TypeScript, not the database

`public.moderator_area_level` already fails **closed** — its `ELSE NULL` covers
any area it does not name — so it needed no change. Its TypeScript mirror
`resolveAreaLevel` fails **open**: its tail returns `'edit'` for any delegate
carrying `edit_all`.

**Adding `photos` to the union alone would therefore have handed the couple's
guest photos to every existing delegate — including the accepted planner row
live in production right now — with no approval, no migration, and nothing on
screen to show it happened.** An explicit fail-closed branch is in the same
change, and a test asserts it against the exact shipped permissions shape.

## The rule is now testable, which it was not

`event-moderators.ts` opens with `import 'server-only'`, so nothing in it can be
imported by a unit test — the existing tests can only take **types** from it,
which are erased at compile time. **The permission rule was untestable**, and it
is the one thing here that must never be wrong. The area model moved to
`lib/delegate-areas.ts`, a module with no imports (same posture as
`lib/admin/queue-partition.ts`); `event-moderators.ts` re-exports it, so every
caller is untouched.

## 🪤 My own post-condition caught a false belief of mine

The migration first asserted that `anon` holds no SELECT grant on the photo
tables. **It failed — correctly.** `anon` *does* hold a stale table grant on
both; it is part of the known dead-anon-grant debt, deliberately not
mass-revoked. It is harmless because **no policy admits anon**, and a grant
without a policy reads nothing under RLS. The assertion now checks the property
that actually protects the photos: every policy on those tables is scoped to
`authenticated`.

**Verified:** 6 tests, all mutation-checked — restoring the fail-open, flipping
the default on, renaming the policy away, and bypassing the gate all go red.
Full suite 6,944 pass under `Asia/Manila` · scoped `tsc` clean · 13/13 lint
scripts clean · baseline regenerated: **exactly +2 policy lines**, both SELECT,
both routed through the single gate.

⏭ **Not in this change:** the couple-facing control that raises the area, and the
coordinator-side surface that renders the photos. Both are UI on top of a
permission that now exists and is refused by default.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06.
