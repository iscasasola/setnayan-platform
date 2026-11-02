## 2026-09-08 · fix(vendor): one word per category — delete the second label map

`lib/vendors.ts` holds `VENDOR_CATEGORY_LABEL` (52 entries, one per
`vendor_category` enum value) and `displayServiceLabel`, whose docblock is
*"NEVER PRINT A DATABASE KEY AT A COUPLE"*. The Customer Card carried a
file-local `CATEGORY_LABELS` beside it, rendered `CATEGORY_LABELS[c] ?? c`.

**Measured — worse than it looked:**

- **24 of 52 categories had no entry**, so `funeral_home`, `crew_meals` and
  `av_production` printed as **raw enum keys** — and the call-time row wrote
  that key into a **persisted** `proposed_label` form value, so the key outlived
  the render.
- **10 of the 28 it did have disagreed** with the shared map ("Cake" vs "Cake
  maker", "Other" vs "Miscellaneous").

🔑 **The second definition was not the bug — its DRIFT was.** It was presumably
right the day it was written and fell behind as the enum grew from 28 values to
52. Nothing failed, because a missing key is a `??` away from looking deliberate.

**`VENDOR_CATEGORY_LABEL` is unchanged.** Three independent judges scored all ten
disputed wordings: **nine unanimous for canonical**, `misc` 2–1 for canonical.
That matters beyond copy — a sweep found the canonical label is also the **public
display name** of any Free/Verified vendor without a screen name
(`resolveVendorDisplayName`), is drawn on a 256px WebGL placard with no
truncation, and is snapshotted into `vendor_service_links.linked_label` rows a
map edit never revisits. Editing it was the risky option; the judges made it
unnecessary.

Also routed `app/[slug]/_components/supplier-desk.tsx`, which de-underscored the
slug inline and read **"Booked here for cake maker · band dj."**

**New guard** `lib/one-word-per-category.test.ts` + a baseline of the 8 known
offenders, each with a reason. It refuses a new category→label map and a new
private humaniser. The value test is the whole guard: a first cut counted any
string value and flagged seven files, **every one a false positive** — the repo
is full of legitimate slug→SLUG bridges (`photographer: 'photo_video'`), which
are not second names for a category.

📌 **Open, flagged not fixed:** `labelForVendorCategory` deliberately PREFERS
`WEDDING_TILE_LABEL` over the canonical map, so its casing still wins on those
surfaces ("Mobile Bar" vs "Mobile bar"). And a public wedding page can still
render `BAND_DJ` raw under CSS `uppercase`. Both are baselined, not hidden.

SPEC IMPACT: None. No product decision changes — this aligns two surfaces onto
the wording the canonical map already had. The `misc` wording ("Miscellaneous"
vs "Other") was split 2–1 and is left as the owner's call.
