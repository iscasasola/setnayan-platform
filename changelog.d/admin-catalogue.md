## 2026-11-19 · feat(admin): the Catalogue tab lands on its Home — the shared tab landing — and its ＋ opens the one New category form

#7693 (area build A3), rebuilt onto main's admin reorg v7 (`lib/admin/admin-pages.ts`) and its clean template.

- **Catalogue Home** — `/admin/catalogue` is the tab's landing (`ADMIN_TAB_LANDING.catalogue`, which held `null`
  "until #7693 lands"). It is the shared `TabLanding` every tab lands on, not a page of its own: head numbers
  (Categories · Services, read by the Categories page's `loadCategories`; Asking · Oldest, the Work digest's
  `service-requests` row), then one card per Catalogue page. A refused read prints "—" and the greeting says some
  counts could not be read — never 0.
- **One New category form** — the bar's Catalogue ＋ opens `/admin/categories?new=category`: the same
  `createTaxonomyNode` form the admin search box prepares, now drawn with the house rows (`FormRows` · `ChosenRow` ·
  `TypedRow`) and the shared button, with a near-match warning. A prepared form still never presses itself.
- **Dropped, because main's newer design replaced them:** the A3 Home's own Next card, Prices section and number
  strip; the Templates · Media · Design kit hubs (v7 puts their rows in Studio and Colours in Setup); the grouped
  `admin-tabs.ts` View ▾ (the shell reads `admin-pages.ts`); the `/admin/pricing` pill-strip removal (the Money clean
  port #8018 does it); the template-score `data-admin-next` exemption (no Next card is drawn any more).
- `/dev/admin-catalogue-lab` draws the Home (busy · empty · fail) and the New category form on fixtures.

SPEC IMPACT: `FEATURE_REGISTER.md` needs a row for `/admin/catalogue` (the three hub rows on specs branch
`claude/admin-catalogue` are no longer built).
