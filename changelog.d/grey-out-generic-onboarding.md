## 2026-09-11 · fix(onboarding): a blocked account is told at the entrance for gated life types too

Owner ruling 2026-09-11 (DECISION_LOG.md), last sentence: *"Same treatment
for any other one-at-a-time event type (the generic onboarding's 'You
already have one of these in planning')."* PR #5447 greyed the create-event
picker's Wedding tile and gated `/onboarding/wedding`'s entrance; PR #5446
fixed the end-of-flow dead end for a `wedding_exists`/`life_event_exists`
refusal. This closes the entrance gap for the five gated life types
(`life-event-gate.ts`: debut · christening · birthday · graduation ·
gender_reveal) — the only non-wedding types that cap at one in-planning
event per account.

- `apps/web/app/onboarding/[type]/page.tsx`: for a signed-in user on a gated
  type, reads the account's blocking event server-side
  (`getBlockingLifeEvent`, the same helper the create-event flow already
  uses) with the **default** candidate — no honoree named yet, i.e. "for
  myself", the same convention a blank honoree has always meant elsewhere in
  this app. Passed down as `entranceBlocking`. The read fails OPEN (never
  blocks page render) — this is a courtesy notice, not the enforcement
  point; the real cap is still `commitOnboardingEvent`, untouched.
- `apps/web/app/onboarding/[type]/_components/generic-onboarding.tsx`:
  `blockedBy` now seeds from `entranceBlocking`, and the **welcome
  screen** (`screens[0]`, the actual first screen) shows the notice + a
  link to the existing event, instead of only surfacing it on the
  `honoree` screen after a failed commit.

**Deliberately NOT the same treatment as wedding in one way, on purpose.**
The wedding cap is unconditional, so its entrance check is a hard dead end
(no wizard renders). The generic gate keys on the honoree — who the event
is FOR — which the wizard does not ask until a screen past the entrance, so
a hard block here would incorrectly stop someone about to name a different
celebrant, which the rule explicitly allows. The entrance check here is a
notice, not a wall: the wizard keeps rendering, and naming someone else on
the `honoree` screen still opens a new slot exactly as it does today.

**The create-event picker tile is deliberately NOT greyed for these five
types** (`event-type-picker.tsx` / `event-type-photo-picker.tsx` —
unchanged, and the new guard test pins that they stay unchanged). The rule
depends on an honoree the tile is tapped before ever asking — in the live
path (experience-quiz flag on) the picker routes straight into
`/onboarding/[type]` without collecting one — so "greyed with the reason"
cannot be computed at tap time. This is exactly the excepted case called
out by the ruling; recorded here rather than building a demo to prove it
one way or the other.

New guard:
`apps/web/app/onboarding/[type]/generic-onboarding-entrance-block.test.ts`
(source-anchored, mutation-tested — 5 sabotages: dropping the signed-in
guard, dropping the `entranceBlocking` prop pass-through, hardcoding
`blockedBy`'s initial state to `null`, breaking the welcome-screen link
target, and wiring a gated life type into the picker's `unavailableReasons`
— all confirmed RED, then restored from an explicit backup).

SPEC IMPACT: None — extends the existing owner-locked one-in-planning
life-event rule (`life-event-gate.ts`, council verdict 2026-07-17); no new
rule, no schema change.
