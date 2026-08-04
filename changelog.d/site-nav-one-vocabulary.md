## 2026-08-04 · fix(guest-site): the event site's two nav modules can no longer drift apart

The event website has **two** navigation modules, and until now nothing compared them:

| Module | Status |
|---|---|
| `_lib/site-menu.ts` → `siteMenuTabs()` | **LIVE** — the bottom bar renders this |
| `_lib/site-nav.ts` → `resolveSiteNav()` | the **designed** per-viewer resolver, with **zero production consumers** |

One decides what guests actually see. The other encodes the rules the owner steered through five rounds. They have already disagreed **twice in two days** — a camera that vanished instead of locking, and menu tabs that hid themselves after the page beneath them had begun rendering. Both were invisible to CI, because each module passed its own tests and **no test asked whether they agreed**.

**Two changes:**

**1 · The resolver was missing the couple's own Story section.** Salvaged from the orphaned branch behind #4086 (which was written against the pre-redesign bar and is otherwise obsolete now that the designed bar has shipped): the `story` slot, slots that carry their own destination, and a slot whose destination the caller could not build now **LOCKS rather than pointing at `#`** — the dead button the bar exists to avoid. Plus its tests. `resolveSiteNav` has no production consumer, so this is inert by construction.

**2 · A cross-module vocabulary guard.** Six assertions: every live anchor is a slot the resolver knows; the only slots the resolver adds are the two that genuinely leave the page (camera, watch); a tab is spelled the same in both modules **phase for phase**; a section id renamed in one module fails rather than silently producing a tab that scrolls nowhere; and — deliberately — a test that the comparison is **not vacuous**, because a cross-module guard's own failure mode is going green by comparing two empty lists.

**⚠ The first draft of that guard was wrong, and the way it was wrong is the point.** It compared the modules at `phase: 'day'` and "found" two failures: a missing Details/Story tab, and a home tab reading `"Now"` instead of `"Home"`. **Both were the fixture's fault.** The resolver deliberately drops Details and Story once the wedding is happening (a guest then needs Now/Watch/Camera/Gallery, and the bar holds five) and deliberately renames home by phase. A cross-module guard that does not model the richer module's rules **reports its design as a defect** — the exact false-alarm shape this project has been bitten by twice today. The final version compares per-phase and carries that warning in its header.

**One real difference is now RECORDED rather than fixed:** the resolver renames home by phase (`Home` → `Now` on the day → `Recap` after); the live bar is fixed at `Home`. That is a capability the bar has not been given yet, not a rename to "correct" — pinned with a test that tells whoever connects them it is a real behaviour change, and to delete the test once the drift is closed.

**Not done here:** making the resolver the actual source of the bar's slots. That is the open follow-up, and it should land on top of the shipped designed bar rather than the old one. Verified: 6440/6440 unit tests, `tsc --noEmit` clean, lint clean. No migration, no flag, no behaviour change.

SPEC IMPACT: None.
