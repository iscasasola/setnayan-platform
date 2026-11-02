## 2026-08-17 · fix(guards): my host-page guard cried wolf on somebody else's clean refactor

**Main was red and my guard was the reason.** PR #4496 pinned the exact inline
expression `ownerCapability !== null && ownerCapability.ownerEventId ===
event.event_id`. Within hours that was extracted — unchanged — into a shared
`viewerIsEventHost()` in `_lib/site-identity.ts`, which is a strict improvement:
`lib/owner-ribbon.ts` now asks the same question through the same function
instead of restating it. Behaviour identical. My assertion went red.

🚨 **And it went red ON MAIN, not on the PR.** #4496 was cut before the
extraction landed, and branch protection here is non-strict, so BEHIND merges
cleanly and CI never ran the combined tree. **A guard pinned to one spelling
turns another session's refactor into a broken build**, and neither PR can see
it coming.

🔑 **ASSERT THE RULE, NOT THE PHRASING.** Host-ness must come from a capability
that exists AND was minted for THIS event — wherever that comparison lives. Both
spellings are now accepted, and when the shared helper is in use it is held to
the rule itself, so moving the check into one place cannot hollow it out.

The result is stronger than what it replaced: the helper is the single home of
that rule for the body *and* the ribbon, and it is now guarded there.

Mutation-tested both branches, occurrence counts before → after:

| mutation | landed | result |
|---|---|---|
| derive host-ness from `ownerRibbon !== null` (the wrong way the helper's own docblock warns about) | 1 → 0 | ✅ red |
| hollow out the helper — drop the `ownerEventId` match | 1 → 0 | ✅ red |

SPEC IMPACT: None.
