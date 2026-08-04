# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · feat(guest-site): the bottom bar now renders what the rules resolved

The last piece of the event-website work: `resolveSiteNav` (#4074) was written, tested, and left **unconnected** — the live bar kept its own logic. This connects them, and takes every decision out of the component.

**Why the separation matters, concretely.** While the rules lived half in the resolver and half in the bar, they disagreed **twice in two days**: a camera that vanished instead of locking (the mount gated on the calendar while the resolver gated on the host's switch), and menu tabs that hid themselves after the page beneath them had started rendering. Both were invisible to CI — each half passed its own tests, and nothing compared them. `SiteMenuBar` now takes `slots: NavSlot[]` and settles nothing: not the phase, not a permission, not a destination. A test rejects it consulting `dayOfPhase`, `isLive`, `hostCameraOpen`, `papicGuest`, `anyChapterPublic` or `siteMenuTabs`. **A component that cannot decide cannot contradict a decision.**

**Also fixed while connecting it:**
- **The resolver had no Story slot.** It shipped with Home · Details · Camera · Watch · Gallery · Me — the couple's own words were simply missing from the design it was meant to encode. Added, before-the-day only: once the wedding is happening, Now/Watch/Camera/Gallery are what a guest needs and the bar holds five.
- **Slots now carry their own destination.** A live slot can never point at `#`, and a slot whose destination the caller could not build (no guest token, no stream) **LOCKS rather than pointing nowhere** — the dead button this bar exists to avoid. Two tests pin it.
- Both trees resolve from the same call, so they cannot drift into disagreeing about what phase it is.

Verified: 6,415/6,415 unit tests, `tsc --noEmit` clean. No migration, no flag. Mounted only where `siteMenuEnabled` — today the sample event.

SPEC IMPACT: None new — completes the bar recorded in `DECISION_LOG.md` 2026-08-03.
