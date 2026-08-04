# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(guest-site): build the bottom nav that was designed, instead of bolting onto the old one

Owner, on seeing it live: *"bottom nav is not following the design"* · *"the contents of the menu doesn't look clean and correct as what should have been planned"* · *"menu doesn't seem correct to what was supposed to be planned"*. All three were right.

**What had actually shipped** was the original bar — a row of uppercase mono **text** anchors — with a Camera inserted into the middle of it. The bar the owner steered through five rounds was never built; its rules were written (`lib/site-nav.ts`, #4074) and left unconnected, and the mount bolted one slot onto the old chrome.

**Now built to the design:**

- **Icon + label on every slot.** Never icons alone — the labelled grid every GCash user already knows, and the strongest convention in the PH market. A test rejects the old mono-uppercase chrome so it cannot creep back.
- **Camera in the middle**, in the CTA colour — the widest, easiest place for a thumb, because on the day taking pictures is what people are actually doing.
- **A locked camera keeps its slot** and wears a small padlock over the lens with its reason on hover. Absent says the wedding has no camera; dead says the app is broken; locked says the truth.
- **Watch has its OWN slot**, never the gallery's — a guest must not lose the photos the moment a broadcast begins (owner: *"papic button as well"*). Wired in both trees off the live-broadcast state.
- **Labels can never wrap** (`min-w-0` + nowrap + ellipsis): a wrapped label grows its slot and tilts the whole bar.
- **A home-indicator strip**, so labels never sit under an iPhone's home bar.

⚠ **The legibility guard caught the label at 11px** — under the floor for a guest-facing page read by older relatives in a dim reception. Raised to 12px. That guard has now caught the same class of mistake three times in two days and been right every time.

Verified: 6,374/6,374 unit tests, `tsc --noEmit` clean, `next lint` clean, guest-legibility clean. No migration, no flag. Mounted only where `siteMenuEnabled` — today the sample event.

SPEC IMPACT: None new — this finally implements the bar recorded in `DECISION_LOG.md` 2026-08-03. The full per-viewer resolver (`lib/site-nav.ts`) is still not the source of these slots; that remains the follow-up.
