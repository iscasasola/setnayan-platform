## 2026-08-21 · refactor(marketing): Pa3D is now "3D Plan", Palogo is now "Logo Maker"

Owner rename, 2026-08-20: *"instead of Pa3D. say 3D Plan"* and *"Logo Maker (Free)"*.

**Labels only — every web address is unchanged.** `/pa3d` and `/palogo` still
resolve, their route folders are untouched, and the 19 in-code references to
those paths are byte-identical. Renaming the addresses would break every printed
link and everything Google has indexed, for a cosmetic win.

41 replacements across 7 files: the Studio rail entry names and descriptions,
both landing pages (title, meta, OpenGraph alt, structured-data name, FAQ copy),
the Alaala explainer, one aria-label docblock, and the studio-apps test prose.

🔑 **"3D Plan" is not a new name — it is the one the catalogue already used.**
`platform_retail_catalog_v2.SEATING_3D` has been titled **3D Plan** in
production all along; only the website still said Pa3D. This closes a drift
between what we charge for and what we call it, rather than inventing anything.

⚠ **Two identifiers had to be renamed by hand first**, because the obvious
find-and-replace produces `Logo MakerLandingPage` — not a valid identifier:
`Pa3DLandingPage` → `ThreeDPlanLandingPage`, `PalogoLandingPage` →
`LogoMakerLandingPage`. Each is a default export, declared once and referenced
nowhere else (verified by occurrence count, not by assumption).

⚠ **A THIRD NAME EXISTS FOR THE SAME PRODUCT AND IS NOT TOUCHED HERE.** The
monogram is `ANIMATED_MONOGRAM` / "Animated Monogram" in the live catalogue,
was "Palogo" on the website, and is now "Logo Maker". The site and the price
list therefore still disagree. Deliberately left alone: changing a catalogue
title is a pricing-surface edit and an owner call, not a side effect of a
marketing rename. Flagged for the owner.

Not verified locally: `npm run build` cannot complete on this machine (7 GB
heap, SIGTERM) — CI owns the build check. No local `node_modules` in this
checkout, so typecheck and unit tests are CI's too. Verified by hand instead:
zero product-name leftovers in `app/` and `lib/`, both route folders present,
both path strings unchanged, both renamed identifiers appearing exactly once.

SPEC IMPACT: None — the corpus already records the rename in `DECISION_LOG.md`
(2026-08-20 row on the front-door service framing).
