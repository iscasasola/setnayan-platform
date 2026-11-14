## 2026-11-14 · fix(design): drop 160 dead hex fallbacks from colour tokens — template score 5,638 → 5,544, no pixel changes

Step 2 of the owner-approved "how do we reach 0%" plan (14 Nov 2026), stacked on the template-score ratchet.

`var(--token, #hex)` was written 160 times across 22 files for ten tokens that are defined on BOTH `:root` and `html.dark` in `app/globals.css` (`--sn-danger`, `--sn-success`, `--m-ink`, `--m-slate`, `--m-slate-2`, `--m-line`, `--m-paper`, `--m-orange`, `--m-orange-2`, `--m-mulberry`). A fallback only paints when its token is undefined, so these never painted — and many disagreed with the real token (`var(--m-ink, #1B1A17)` where `--m-ink` is `#2C2A29`). They are now plain `var(--token)`. Same colours in light and dark.

Template score by area (lower is better): supplier 873 → 873 · couple 2,541 → 2,533 · admin 1,346 → 1,284 · public 878 → 854. `lib/template-score.baseline.json` lowered with `template-score --write`.

Not changed, left for the owner (each would change how something looks): undefined tokens whose fallback IS the colour (`--m-grey`, `--sn-gold`, `--sn-cta`, `--sn-paper-2`, `--sn-line-soft`), raw `[#hex]` values whose nearest token differs in dark mode, `.button-primary` → `ActionButton` (44 px rectangle → 40 px pill), `<select>` → `PickMenu`, cards → rows, paragraphs → ⓘ, typewriter captions.

SPEC IMPACT: None.
