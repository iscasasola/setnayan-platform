# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(guest-site): the menu's camera follows the host's switch, not the calendar

**The rule was written correctly and then not used.** `lib/site-nav.ts` (#4074) states the owner's ruling exactly — *"the papic service will always run but the host of the event has the power to allow use and not allow use"* — but when the camera slot was mounted into the live bar (#4077) it was gated on `dayOfPhase === 'live'` / `isLive` instead.

So on a wedding more than a day away — i.e. **nearly every wedding** — the slot resolved to `null` and vanished. Not locked, not explained: gone. Exactly the outcome the ruling exists to prevent, on the surface it was written for.

**Neither half failed.** The resolver's tests passed because the resolver is right; the mount's tests passed because they only checked that a *closed* camera locks. Nothing compared the two.

**The fix, in two places, because one alone would have been undone from underneath:**

1. `loaders.ts` now resolves `hostCameraOpen` **unconditionally**. Previously the switch was only read during the live window, so on any other day the slot would have reverted to "closed" no matter what the component did. `publicCandidCameraActive` keeps its live-window rule — that drives the day-of bar, which genuinely has no meaning beforehand.
2. Both trees' camera slots now consult `hostCameraOpen` alone. A guest still gets their own roll first, then the couple's shared camera, then locked.

Two tests pin it: one rejects `isLive` / `dayOfPhase === 'live'` appearing in either camera block, the other rejects re-wrapping the switch read in a live-window check. **Mutation-verified** — reintroducing the calendar gate fails.

Verified: 6,341/6,341 unit tests, `tsc --noEmit` clean. No migration, no flag.

SPEC IMPACT: None — makes the mounted behaviour match the ruling already recorded in `DECISION_LOG.md` 2026-08-03 and encoded in `lib/site-nav.ts`.
