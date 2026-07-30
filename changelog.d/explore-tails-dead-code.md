## 2026-07-30 · chore(explore): delete two dead modules, retire the stale copy + docblocks

Four disjoint tails from the Explore/vendors wave. Nothing here changes a user-visible
behaviour except one deliberate copy change.

**1. Deleted `vendors/_components/build-pin-mode.tsx`** — the abandoned "What's fixed?"
segmented control (Pin solver Phase 3a). `BuildPinModeControl` is mounted nowhere:
`build-pins.tsx`, the file that used to render it, is already gone. Two modules still
imported `readPinMode` from it — `build-compare.tsx` and `team-controls.tsx` — each to
stamp `pinMode` onto a saved plan snapshot. Both were no-ops in practice: `storePinMode`
was the only writer of the `setnayan:build-pin-mode:<eventId>` localStorage key and it
lived inside the deleted (unmounted) component, so `readPinMode` could only ever return
its `'budget'` default, and **no code anywhere reads `snapshot.pinMode` back** — it is
write-only data. Both call sites now pass `snapshot: currentPlan` unchanged. The optional
`PlanBuildSnapshot.pinMode` field stays in the type so old JSONB snapshots that carry it
still parse; its comment now says plainly that nothing writes it, so the next reader
doesn't go hunting for the author.

**2. Deleted `vendors/build-anchors-actions.ts`** — zero callers, verified with
`git grep -n "build-anchors-actions" origin/main` (one hit: the file's own docblock).
This is worth more than tidiness: `setAnchor` is a reachable `'use server'` action that
patches `events.event_date`, `events.estimated_budget_centavos` and `events.region` with
no UI in front of it. An unreferenced server action is still an exported RPC surface, so
deleting it removes an attack surface rather than merely dead lines.

⚠ **Corrects an earlier changelog claim.** `changelog.d/explore-team-merge.md` states
`setAnchor` is "not deleted — `onboarding-shell.tsx` still calls it". That is false:
`onboarding-shell.tsx` line ~2131 defines its own local `setAnchor` React helper for the
love-story anchor tiles and never imports the server action. The two names are unrelated.

**3. Copy: "＋ Add to your plan" → "＋ Add to your event"** (`ADD_TO_PLAN_HEADING`).
`EXPLORE_INFO_STRIP` in the same file called the same container "your plan", so it moves
with the heading — the ⓘ panel and the button the panel describes must not name the strip
two different things. The assertion in `explore-in-plan.test.ts` is updated in this PR so
the suite stays green.

**4. Two stale references to renamed things.** `build-requote-nudge.test.ts` described a
`runBuild3State` early-return "when `BUILD_3STATE_ENABLED` is off". The resolver was
renamed `proposeBuildFromQuotes` on 2026-07-29, and `build-3state-actions.ts` (~line 482)
already records that the flag guard **never existed** — `BUILD_3STATE_ENABLED` appears
nowhere outside comments. The docblock now states the real gate: reachable only from the
quote-fill row, which `vendors/page.tsx` mounts behind `isExploreReplanEnabled()`.
`budget-build.ts` said "`BuildLocked` renders below `Build3StateControl`"; that grid is
deleted and `BuildLocked` is now the only card in the Build slot.

SPEC IMPACT: None. The `ADD_TO_PLAN_HEADING` wording differs from the string quoted in
`Explore_Replan_BUILD_SPEC_2026-07-27.md` §11.3, but the spec's rule is "this copy lives
in one file", which still holds — the constant remains the single source and no JSX
inlines it.
