## 2026-09-18 · feat(admin): admin search finds folders, categories, event types and faiths

`fetchAdminRows()` indexed only `platform_retail_catalog_v2` prices, so a
search for "feast" or "civil" answered nothing even though both are rows on
Taxonomy Studio. It now also indexes taxonomy folders and categories (via
`getTaxonomy()`, which has its own constant fallback) and `event_type_vocab` /
`faith_vocab` rows, landing on `/admin/taxonomy?open=<id>` for a category
(or its folder's first category) and `?view=vocab-event` / `?view=vocab-faith`
for event types and faiths.

SPEC IMPACT: None.
