## 2026-07-03 · feat(taxonomy): fold /admin/event-types into the Studio

The standalone **`/admin/event-types`** roster page is retired to
`redirect('/admin/taxonomy?view=vocab-event')` and its controls fold into the
Taxonomy Studio's **Vocabularies → Event types** bucket, so the Studio is the
single home for every event type. The bucket now shows BOTH lifecycle grains per
row, in labeled, plain-English clusters:

- **Category scoping** (the #2755 vocab controls) — relabel · reorder ·
  activate/deactivate (soft, `status` → `retired`) · add-new, plus a
  "Scope categories" link-through to the per-type category editor. Decides which
  categories the type offers.
- **Couple launch** (folded from `/admin/event-types`) — the **"Show in picker"**
  `enabled` lever (whether couples can create the type), the picker-card
  presentation editor (name · emoji · tagline · sort · onboarding href · hero
  photo), **Retire / Un-retire**, and link-throughs to the per-type **Onboarding
  profile** and **Onboarding content** editors. New roster rows are created here
  with the full shape (explicit snake_case key + name + emoji + tagline + sort).

Two status/pill signals per row: `Active`/`Retired` + `In picker`/`Hidden from
picker`, plus an `offers N/M` category-coverage count mirroring the legacy
roster's at-a-glance hint.

**State overlap (surfaced, deliberately not merged):** `event_type_vocab.status`
is written by both grains — scoping "Deactivate" (`setEventTypeVocabStatus`) and
launch "Retire" (`retireEventTypeVocab`) set the same `active`↔`retired` value.
They're shown as two separately-labeled buttons with distinguishing copy ("drops
from scoping pickers" vs "off the books for new events everywhere") because they're
framed for different admin intents; **Retire additionally forces `enabled=false`**
(a retired type can't be creatable), which "Deactivate" does not. The `enabled`
launch lever is written only by the launch grain.

Core write logic is shared, not duplicated: a new **`lib/event-types-mutations.ts`**
holds framework-free cores (`createEventTypeCore` · `updateEventTypeCore` ·
`setEventTypeEnabledCore` · `retireEventTypeCore` · `unretireEventTypeCore`) called
by BOTH the Studio actions and the retained legacy `/admin/event-types` roster
actions (kept for bookmarked form POSTs). Write shapes are byte-identical to the
pre-fold actions — a relocation, NOT a behavior change; couple-facing gating
semantics (what `enabled`/`status` mean and who reads them) are unchanged. Every
write is `admin_audit_log`-stamped (unchanged action names on the legacy path;
shared cores emit `event_types.*` actions).

The per-type sub-editors (`[eventType]/categories` · `/profile` · `/onboarding`)
stay as pages (substantial, kept-and-linked) and are reachable from the Studio
bucket; their "← Event types" back-links repoint to
`/admin/taxonomy?view=vocab-event`.

Nav/route cleanup for the retired top-level page: sidebar item, bottom-nav route
list, `nav-registry-defaults` seed (dated tombstone), `routes.ts` +
`route-meta.ts` helpers, `/admin/more` tile all removed; orphaned `PartyPopper`
icon imports dropped. Surviving-subpage cross-links kept. No migration
(`event_type_vocab` already carries every column).

SPEC IMPACT: None — admin-console IA consolidation only; no couple-facing gating,
schema, pricing, or SKU change. The as-built home for the event-type roster moves
from `/admin/event-types` to `/admin/taxonomy?view=vocab-event`.
