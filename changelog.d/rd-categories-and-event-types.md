## 2026-10-02 · feat(admin): "Categories & event types" — one page for supplier categories, event types and religions

Owner approval, DECISION_LOG 2026-10-02 ("'CATEGORIES & EVENT TYPES' — ONE ADMIN PAGE … APPROVED";
prototype `prototypes/supplier_categories_simple_2026-10-02_fable.html`).

- **New page `/admin/categories`.** One title dropdown (Supplier categories · Event types ·
  Religions), the list on the left with one search (and Show ▾ on categories), one panel on the
  right with a fixed section order, "+ Add" in place. Server-rendered; every choice is a PickMenu.
- **Replaced and removed:** the Taxonomy Studio and its search-words page (`/admin/taxonomy`,
  `/admin/taxonomy/aliases`), the event-type roster redirect and the three per-type pages
  (`/admin/event-types/<type>/categories|profile|onboarding`), the Traditions tab of `/admin/ugat`,
  and the `/admin/wedding-traditions` + `/admin/wedding-types` redirect pages. Every old address
  forwards (308, `lib/legacy-redirects.ts`); `/admin/taxonomy` keeps its query so the Studio's
  deep links (`?view=vocab-event`, `?open=<category>`, `?q=`) land on the same thing.
- **Actions moved, not copied** (`git mv` into `app/admin/categories/`). Server actions 1204 → 1200:
  the merged event-type Status ▾ (`setEventTypeStatus`) replaces four buttons' actions; dead
  ones gone (`createEventTypeVocab`, `moveTaxonomyNode`, `deleteTaxonomyNode`,
  `setCategoryEventTypes`, `setFolderEventTypes`). New writers: `renameCanonicalService` (the
  Tagalog name finally has one), `setServiceEventTypes` (the per-service event override had a
  column and no editor), `setFaithAskedOn`, `addTradeAlias`; "Suppliers can serve it" now saves
  through the shipped profile action.
- **Each link is edited in ONE place:** event type ↔ category on the event type; religion ↔
  service and religion ↔ event type ("Asked on") on the religion; the other side reads it.
- **Database** (`20271260148112_religion_asked_on_and_event_type_status.sql`):
  `faith_vocab.asked_on_event_types` (NULL = wedding only, validated against active event types);
  CHECKs that a retired event type is never in the picker and the wedding never leaves it;
  `canonical_service_aliases.source` admits `admin`. The traditions CHECK was already 17 religions
  + mixed in production (measured) — only the action's own list stopped at 8; it is widened here.
- Mapping a supplier's request now leaves their word as a waiting search word on the service.
- Fixed in passing: the category photo form posted the OLD ref first (a new upload or Clear saved
  nothing); a "What to expect" item could never be hidden (an unticked box posted nothing and the
  action defaulted to shown).

SPEC IMPACT: None
