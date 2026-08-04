# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-02 · feat(design): the six-state system — Empty can no longer render over rows the reader was never permitted to see

`design#1` of the Design Programme (`WHATS_NEXT_Design_Programme_2026-08-01.md` §2), ported from the drafted archetype `prototypes/archetype_shell_command_states_2026-08-01.html` §03. Additive only — new files under `apps/web/app/_components/states/`, no existing component rewritten, nothing mounted yet.

**Why it is functional rather than aesthetic (and therefore not behind the owner-review gate):** an RLS denial and a permitted-but-empty read are the **same value** — `count: 0`, no error. A production surface once printed *"no requests yet"* over three real pending rows. Every surface in this app derives its state from a bare count today.

- **`surface-state.ts`** — `resolveSurfaceState()`, a pure resolver over the six states (`ideal · loading · empty · locked · denied · error`). Its load-bearing clause is `readPermitted !== true → 'denied'`: `undefined`, `null` and `false` all resolve to Denied, so Empty is unreachable unless permission was **positively proven**. Precedence is loading → error → locked → permission → count, with `locked` deliberately outranking the permission question (a free-tier reader should meet the gold upgrade gate, not a slate denial).
- **`surface-state.test.ts`** — sweeps all 216 input combinations and asserts Empty never appears without `readPermitted === true`, rather than hand-picking cases. **Mutation-verified:** loosening the clause to `=== false` fails 2 of 4 tests; the guard was watched failing before being trusted.
- **The five frames** — `EmptyState` (centred terracotta, teaches the one filling action, carries a "read permitted · 0 rows" audit line, and takes `readPermitted: true` as a *literal type* so `false` cannot be passed), `DeniedState` (left-anchored slate, names the scope and a person to ask, states in copy that contents may exist), `LockedState` (gold, ghosts the real feature behind the lock with one unlock step), `ErrorState` (three fixed beats — broke → survived → do — with surviving content still rendered and workable), and `loading-skeleton.tsx` (`SkeletonBlock`/`SkeletonRow`/`SkeletonList` — geometry copied 1:1, never a spinner). Distinct geometry per state is the point: the distinction survives a user who reads none of the words.

Verified: 6,269/6,269 unit tests, `tsc --noEmit` clean, `next lint` clean. No migration, no flag, no route change.

SPEC IMPACT: `WHATS_NEXT_Design_Programme_2026-08-01.md` — `design#1` moves from NOT STARTED to shipped-as-primitives (adoption by individual surfaces is follow-up work).
