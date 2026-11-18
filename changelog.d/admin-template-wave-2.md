## 2026-11-14 · style(admin): template wave PR 2 — Studio, Ugat and eleven small admin screens follow the design template

Second admin-lane PR of the 14 Nov template wave (`design_template_sheet_2026-11-14_fable.html`). Style only: same words, same data, same actions.

Screens: Studio (songs · storytellers · real stories · recaps · referrals · reveal studio · social queue · spotlight awards · journal spotlights · discount codes · website · patiktok · mood-board tab) · Ugat (brain · menus · onboarding · screens) · supplier recommendations (the two dropdowns PR 1 did not reach) · menus · demo suppliers · Music Maker · editorial review · colours · hub music · search memory · pax changes · completions.

- Typewriter captions → the section label; mono pills → chip type; `sn-tile`/`sn-card` read-only boxes → plain rows on a hairline.
- Hand-made buttons → `ActionButton` (journal and spotlight forms, the website page picker's Open, discount-code Edit, Real Stories / storytellers links, Ugat's entity map, the menu editor's show/hide and reset — now 44 px icon buttons).
- Native selects → the ▾ picker (`FieldPick` in server forms, `PickMenu` in client screens); posted names unchanged.
- Discount-code status chips and banners read the shared chip tokens (`badgeStyle`) instead of typed colour codes.
- Page and section explainers → one line with the rest behind ⓘ, every word kept. Ugat's onboarding note stays on the page: the ⓘ wording guard reads the whole file and that screen's existing copy uses a retired word, which this style-only pass does not change.
- Deliberately left: Studio's and Ugat's own tab rails (moving them into the pinned-row ▾ is a design change, not a restyle); "couldn't read" warnings and live status lines.
- `founder-seats` left untouched — #7694 now edits it.
- Ratchet: `lib/template-score.baseline.json` lowered for the admin pages of both wave PRs only (30 entries, none raised); `label-contrast-dark.baseline.json` and `port-control-baseline.json` regenerated from the merged tree.

SPEC IMPACT: None — implements the approved design template; no decision changed.
